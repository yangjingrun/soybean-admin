import { Inject, Injectable, Optional } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { createTaskNotificationMetadata, isStaleRunVersion } from '../../shared/task-state';
import { CrmService } from '../crm/crm.service';
import { SystemNotificationService } from '../system-notification/system-notification.service';
import type { SearchRequestTrace } from './ai-lead-search-orchestrator.service';
import { AiLeadSearchOrchestrator } from './ai-lead-search-orchestrator.service';
import { mapAiLeadTaskResultToCrmImportInputs } from './ai-lead-crm-import.adapter';
import {
  AiLeadHunterEnrichmentService,
  type AiLeadHunterEnrichmentResult
} from './ai-lead-hunter-enrichment.service';
import { createLeadSearchProgressEmitter, type LeadSearchProgressEvent } from './ai-lead-search-progress';
import { AI_LEAD_SEARCH_TASK_STORE } from './ai-leads.tokens';
import type { AiLeadSearchTaskQueueJob } from './ai-lead-search-task-queue.service';
import type {
  AiLeadSearchTaskEventInput,
  AiLeadSearchTaskRecord,
  AiLeadSearchTaskStore
} from './ai-lead-search-task.types';

class AiLeadSearchTaskInterruptedError extends Error {
  constructor() {
    super('AI lead search task interrupted');
    this.name = 'AiLeadSearchTaskInterruptedError';
  }
}

@Injectable()
export class AiLeadSearchTaskWorkerService {
  constructor(
    @Inject(AI_LEAD_SEARCH_TASK_STORE) private readonly taskStore: AiLeadSearchTaskStore,
    @Inject(AiLeadSearchOrchestrator) private readonly orchestrator: AiLeadSearchOrchestrator,
    @Optional() @Inject(SystemNotificationService) private readonly notificationService?: SystemNotificationService,
    @Optional() @Inject(CrmService) private readonly crmService?: CrmService,
    @Optional() @Inject(AiLeadHunterEnrichmentService)
    private readonly hunterEnrichmentService?: AiLeadHunterEnrichmentService
  ) {}

  /** Interrupts tasks left running by a previous process before accepting new jobs. */
  async interruptRunningTasksAfterRestart(activeBullJobIds: string[] = []) {
    const tasks = await this.taskStore.interruptRunningTasksForRecovery(activeBullJobIds);

    await Promise.all(
      tasks.map(task =>
        this.taskStore.createTaskEvent({
          taskId: task.id,
          eventType: 'task_interrupted_after_restart',
          fromStatus: 'running',
          toStatus: 'interrupted',
          title: '服务重启后自动中断采集任务',
          message: '任务可在前端继续采集。'
        })
      )
    );
  }

  /** Processes one BullMQ job and persists query checkpoints for resume/retry. */
  async processTaskJob(job: AiLeadSearchTaskQueueJob) {
    const task = await this.taskStore.findTaskById(job.taskId);

    if (!task || isStaleRunVersion(task, job.runVersion) || task.status === 'discarded') {
      return;
    }

    // 旧 job 不能把已中断/失败/完成的任务重新拉回 running。
    if (!['queued', 'running'].includes(task.status)) {
      return;
    }

    const runningTask = await this.markRunning(task, job.runVersion);

    if (!runningTask) {
      return;
    }

    const reporter = createLeadSearchProgressEmitter(randomUUID(), event =>
      this.persistProgressStateSafely(runningTask, event)
    );

    try {
      const result = await this.orchestrator.searchWithKeywordPlan(
        {
          requirement: task.requirement,
          targetLeadCount: task.targetLeadCount,
          keywordPlan: task.keywordPlan as Parameters<
            AiLeadSearchOrchestrator['searchWithKeywordPlan']
          >[0]['keywordPlan']
        },
        {
          user: {
            userId: task.userId,
            userName: task.userName || '',
            roles: [],
            organizationId: task.organizationId,
            organizationRole: task.organizationRole
          }
        },
        reporter,
        {
          executeQuery: (input, runDefault) =>
            this.executeQueryWithCheckpoint(task.id, job.runVersion, input, runDefault)
        }
      );

      await this.assertTaskStillRunning(task.id, job.runVersion);
      await this.completeTask(runningTask, result);
    } catch (error) {
      if (error instanceof AiLeadSearchTaskInterruptedError) {
        return;
      }

      const didFailTask = await this.failTask(runningTask, error);

      if (didFailTask) {
        throw error;
      }
    }
  }

  private async executeQueryWithCheckpoint(
    taskId: string,
    runVersion: number,
    input: { request: SearchRequestTrace; requestKey: string; requestIndex: number },
    runDefault: () => Promise<unknown>
  ) {
    await this.assertTaskStillRunning(taskId, runVersion);
    const existingQuery = await this.taskStore.findQueryByRequestKey(taskId, input.requestKey);

    if (existingQuery?.status === 'completed') {
      return existingQuery.result;
    }

    const query = await this.taskStore.upsertRunningQuery({
      taskId,
      requestKey: input.requestKey,
      endpoint: input.request.endpoint,
      requestBody: input.request.requestBody,
      orderIndex: input.requestIndex
    });

    try {
      const result = await runDefault();
      await this.taskStore.completeQuery(query.id, result);
      await this.assertTaskStillRunning(taskId, runVersion);

      return result;
    } catch (error) {
      await this.assertTaskStillRunning(taskId, runVersion);
      await this.taskStore.failQuery(query.id, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  private async assertTaskStillRunning(taskId: string, runVersion: number) {
    const latestTask = await this.taskStore.findTaskById(taskId);

    if (!latestTask || latestTask.status !== 'running' || isStaleRunVersion(latestTask, runVersion)) {
      throw new AiLeadSearchTaskInterruptedError();
    }
  }

  private async markRunning(task: AiLeadSearchTaskRecord, runVersion: number) {
    const runningTask = await this.taskStore.updateTask(
      task.id,
      {
        status: 'running',
        errorMessage: null,
        startedAt: task.startedAt ?? new Date()
      },
      {
        status: ['queued', 'running'],
        runVersion
      }
    );

    if (!runningTask) {
      return null;
    }

    await this.createTaskEventSafely({
      taskId: task.id,
      eventType: 'task_started',
      fromStatus: task.status,
      toStatus: 'running',
      title: '采集任务开始执行'
    });

    return runningTask;
  }

  private async completeTask(task: AiLeadSearchTaskRecord, result: unknown) {
    const notifiedAt = new Date();
    const completedTask = await this.taskStore.updateTask(
      task.id,
      {
        status: 'completed',
        result,
        errorMessage: null,
        finishedAt: new Date(),
        readAt: null,
        notifiedAt
      },
      this.runningTaskGuard(task)
    );

    if (!completedTask) {
      throw new AiLeadSearchTaskInterruptedError();
    }

    await this.importCrmLeadsSafely(completedTask, result);
    await this.createTaskEventSafely({
      taskId: task.id,
      eventType: 'task_completed',
      fromStatus: 'running',
      toStatus: 'completed',
      title: '采集任务已完成'
    });
    await this.createTaskNotificationSafely(task, 'task_completed', '采集任务已完成', 'AI 获客采集任务已完成');
  }

  /** Imports completed search candidates into CRM without blocking task completion. */
  private async importCrmLeadsSafely(task: AiLeadSearchTaskRecord, result: unknown) {
    const inputs = mapAiLeadTaskResultToCrmImportInputs(task.id, result);

    if (!this.crmService || inputs.length === 0) {
      return;
    }

    const inputsToImport = await this.enrichCrmInputsWithHunterSafely(task.id, inputs);
    let successCount = 0;
    let failureCount = 0;
    let firstErrorMessage: string | null = null;

    for (const input of inputsToImport) {
      try {
        await this.crmService.importAccountFromLead(input, {
          userId: task.userId,
          userName: task.userName || '',
          roles: [],
          organizationId: task.organizationId,
          organizationRole: task.organizationRole
        });
        successCount += 1;
      } catch (error) {
        failureCount += 1;
        firstErrorMessage ||= error instanceof Error ? error.message : String(error);
      }
    }

    if (failureCount > 0) {
      await this.createTaskEventSafely({
        taskId: task.id,
        eventType: 'crm_import_failed',
        title: 'CRM 线索导入失败',
        message: firstErrorMessage,
        metadata: {
          successCount,
          failureCount
        }
      });
    }
  }

  private async enrichCrmInputsWithHunterSafely(
    taskId: string,
    inputs: ReturnType<typeof mapAiLeadTaskResultToCrmImportInputs>
  ) {
    if (!this.hunterEnrichmentService) {
      return inputs;
    }

    try {
      const result = await this.hunterEnrichmentService.enrichCrmImportInputs(inputs);

      if (result.attemptedCount > 0 || result.enrichedCount > 0 || result.failedCount > 0) {
        await this.createTaskEventSafely({
          taskId,
          eventType: 'crm_hunter_enrichment_completed',
          title: 'Hunter 联系人补全完成',
          message: result.firstErrorMessage,
          metadata: toHunterEnrichmentEventMetadata(result)
        });
      }

      return result.inputs;
    } catch (error) {
      const firstErrorMessage = error instanceof Error ? error.message : String(error);

      await this.createTaskEventSafely({
        taskId,
        eventType: 'crm_hunter_enrichment_failed',
        title: 'Hunter 联系人补全失败',
        message: firstErrorMessage,
        metadata: {
          attemptedCount: 0,
          enrichedCount: 0,
          failedCount: 1,
          firstErrorMessage
        }
      });

      return inputs;
    }
  }

  private async failTask(task: AiLeadSearchTaskRecord, error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const notifiedAt = new Date();
    const failedTask = await this.taskStore.updateTask(
      task.id,
      {
        status: 'failed',
        errorMessage: message,
        finishedAt: new Date(),
        notifiedAt
      },
      this.runningTaskGuard(task)
    );

    if (!failedTask) {
      return false;
    }

    await this.createTaskEventSafely({
      taskId: task.id,
      eventType: 'task_failed',
      fromStatus: 'running',
      toStatus: 'failed',
      title: '采集任务失败',
      message
    });
    await this.createTaskNotificationSafely(task, 'task_failed', '采集任务失败', message || 'AI 获客采集任务失败');

    return true;
  }

  /** Creates a notification without letting notification delivery rewrite task status. */
  private async createTaskNotificationSafely(
    task: AiLeadSearchTaskRecord,
    type: string,
    title: string,
    content: string
  ) {
    try {
      await this.createTaskNotification(task, type, title, content);
    } catch (error) {
      await this.createTaskEventSafely({
        taskId: task.id,
        eventType: 'task_notification_failed',
        title: '任务通知创建失败',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async createTaskNotification(task: AiLeadSearchTaskRecord, type: string, title: string, content: string) {
    await this.notificationService?.create({
      userId: task.userId,
      userName: task.userName,
      module: 'ai-leads',
      type,
      title,
      content,
      targetType: 'aiLeadSearchTask',
      targetId: task.id,
      routePath: '/ai-leads',
      metadata: createTaskNotificationMetadata(task.id)
    });
  }

  /** Persist progress for resume display without letting progress storage fail the worker run. */
  private async persistProgressStateSafely(task: AiLeadSearchTaskRecord, event: LeadSearchProgressEvent) {
    try {
      await this.taskStore.updateTask(task.id, { progressState: event }, this.runningTaskGuard(task));
    } catch (error) {
      await this.createTaskEventSafely({
        taskId: task.id,
        eventType: 'task_progress_persist_failed',
        title: '任务进度保存失败',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /** Writes task events as operational breadcrumbs only, never as blockers for status or notification flow. */
  private async createTaskEventSafely(input: AiLeadSearchTaskEventInput) {
    try {
      await this.taskStore.createTaskEvent(input);
    } catch {
      // 事件只用于排查，不能反向影响任务状态和通知链路。
    }
  }

  private runningTaskGuard(task: AiLeadSearchTaskRecord) {
    return {
      status: 'running' as const,
      runVersion: task.runVersion
    };
  }
}

function toHunterEnrichmentEventMetadata(result: AiLeadHunterEnrichmentResult) {
  return {
    attemptedCount: result.attemptedCount,
    enrichedCount: result.enrichedCount,
    failedCount: result.failedCount,
    firstErrorMessage: result.firstErrorMessage
  };
}
