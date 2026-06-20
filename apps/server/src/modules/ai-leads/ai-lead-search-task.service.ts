import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  Optional
} from '@nestjs/common';
import { isSuper } from '../../shared/permission-policy';
import { SystemNotificationService } from '../system-notification/system-notification.service';
import { SystemLogService } from '../system-log/system-log.service';
import type { SystemLogRecorder } from '../system-log/system-log.types';
import { AI_LEAD_QUEUE_CONFIG_STORE, AI_LEAD_SEARCH_TASK_QUEUE, AI_LEAD_SEARCH_TASK_STORE } from './ai-leads.tokens';
import { normalizeAiLeadQueueConcurrency } from './ai-lead-search-task-state';
import { toLeadSearchPublicResult } from './ai-lead-search-progress';
import type {
  AiLeadQueueConfigStore,
  AiLeadSearchTaskContext,
  AiLeadSearchTaskQueuePort,
  AiLeadSearchTaskRecord,
  AiLeadSearchTaskStatus,
  AiLeadSearchTaskStore,
  AiLeadSearchTaskUpdateGuard
} from './ai-lead-search-task.types';
import { toSearchTaskJobId } from './ai-lead-search-task-queue.service';
import { AiLeadSearchTaskWorkerHost } from './ai-lead-search-task-worker-host.service';

interface CreateAiLeadSearchTaskDto {
  requirement: string;
  targetLeadCount: number;
  keywordPlan: unknown;
}

@Injectable()
export class AiLeadSearchTaskService {
  constructor(
    @Inject(AI_LEAD_SEARCH_TASK_STORE) private readonly taskStore: AiLeadSearchTaskStore,
    @Inject(AI_LEAD_QUEUE_CONFIG_STORE) private readonly queueConfigStore: AiLeadQueueConfigStore,
    @Inject(AI_LEAD_SEARCH_TASK_QUEUE) private readonly taskQueue: AiLeadSearchTaskQueuePort,
    @Optional() @Inject(AiLeadSearchTaskWorkerHost) private readonly workerHost?: AiLeadSearchTaskWorkerHost,
    @Optional() @Inject(SystemLogService) private readonly systemLogService?: SystemLogRecorder,
    @Optional() @Inject(SystemNotificationService) private readonly notificationService?: SystemNotificationService
  ) {}

  /** Creates one queued search task for the current user and submits it to BullMQ. */
  async createTask(dto: CreateAiLeadSearchTaskDto, context: AiLeadSearchTaskContext = {}) {
    const user = this.requireUser(context);
    const requirement = dto.requirement.trim();
    const targetLeadCount = this.normalizeTargetLeadCount(dto.targetLeadCount);

    if (!requirement) {
      throw new BadRequestException('获客需求不能为空');
    }

    if (!dto.keywordPlan || typeof dto.keywordPlan !== 'object') {
      throw new BadRequestException('请先优化关键词，再开始采集');
    }

    const task = await this.taskStore.createTaskIfNoCurrent({
      userId: user.userId,
      userName: user.userName,
      organizationId: user.organizationId,
      organizationRole: user.organizationRole,
      requirement,
      targetLeadCount,
      keywordPlan: dto.keywordPlan,
      priority: 0
    });

    if (!task) {
      throw new ConflictException('当前已有待处理采集任务，请先处理后再重新采集');
    }

    try {
      const queueConfig = await this.queueConfigStore.getConfig();
      const concurrency = normalizeAiLeadQueueConcurrency(queueConfig.workerConcurrency);
      await this.taskQueue.applyGlobalConcurrency(concurrency);
      const job = await this.taskQueue.enqueueSearchTask({
        taskId: task.id,
        runVersion: task.runVersion,
        priority: task.priority
      });

      const queuedTask = await this.updateTaskOrThrow(task.id, { bullJobId: job.jobId }, this.taskGuard(task));
      await this.createTaskEventSafely({
        taskId: task.id,
        eventType: 'task_queued',
        toStatus: 'queued',
        title: '采集任务已排队'
      });

      return this.toVisibleTask(queuedTask, context);
    } catch (error) {
      await this.markTaskFailedAfterEnqueueError(task, error);
      throw error;
    }
  }

  /** Interrupts a running task after the currently active external call returns. */
  async interruptTask(id: string, context: AiLeadSearchTaskContext = {}) {
    const task = await this.getOwnedTaskOrThrow(id, context);

    if (task.status !== 'running') {
      throw new ConflictException('只有采集中任务可以中断');
    }

    return this.toVisibleTask(
      await this.transitionTask(task, 'interrupted', 'task_interrupted', '采集任务已中断'),
      context
    );
  }

  /** Resumes an interrupted task by submitting a fresh BullMQ run version. */
  async resumeTask(id: string, context: AiLeadSearchTaskContext = {}) {
    const task = await this.getOwnedTaskOrThrow(id, context);

    if (task.status !== 'interrupted') {
      throw new ConflictException('只有已中断任务可以继续采集');
    }

    return this.toVisibleTask(await this.enqueueNextRun(task, 'task_resumed', '采集任务已继续'), context);
  }

  /** Retries a failed task while preserving completed query checkpoints. */
  async retryTask(id: string, context: AiLeadSearchTaskContext = {}) {
    const task = await this.getOwnedTaskOrThrow(id, context);

    if (task.status !== 'failed') {
      throw new ConflictException('只有失败任务可以重试');
    }

    const nextTask = await this.enqueueNextRun(task, 'task_retried', '采集任务已重试');
    await this.markTaskNotificationsReadSafely(task);

    return this.toVisibleTask(nextTask, context);
  }

  /** Discards a queued, interrupted, or failed task so it will no longer be restored. */
  async discardTask(id: string, context: AiLeadSearchTaskContext = {}) {
    const task = await this.getOwnedTaskOrThrow(id, context);
    const queuedJobId = task.status === 'queued' ? task.bullJobId : null;

    if (!['queued', 'interrupted', 'failed'].includes(task.status)) {
      throw new ConflictException('当前任务状态不支持放弃');
    }

    const nextTask = await this.transitionTask(task, 'discarded', 'task_discarded', '采集任务已放弃', {
      finishedAt: new Date()
    });

    if (queuedJobId) {
      await this.removeQueuedJobSafely(task.id, queuedJobId);
    }

    await this.markTaskNotificationsReadSafely(task);

    return this.toVisibleTask(nextTask, context);
  }

  /** Marks one completed auto-restored task as read. */
  async markTaskRead(id: string, context: AiLeadSearchTaskContext = {}) {
    const task = await this.getOwnedTaskOrThrow(id, context);

    if (task.status !== 'completed') {
      throw new ConflictException('只有已完成任务可以标记已读');
    }

    const nextTask = await this.updateTaskOrThrow(id, { readAt: new Date() }, this.taskGuard(task, 'completed'));
    await this.markTaskNotificationsReadSafely(task);

    return this.toVisibleTask(nextTask, context);
  }

  /** Reads the current task that should be restored for this user. */
  async getCurrentTask(context: AiLeadSearchTaskContext = {}) {
    const user = this.requireUser(context);

    const task = await this.taskStore.findCurrentTaskForUser(user.userId, user.organizationId);

    return task ? this.toVisibleTask(task, context) : null;
  }

  async getTaskById(id: string, context: AiLeadSearchTaskContext = {}) {
    return this.toVisibleTask(await this.getOwnedTaskOrThrow(id, context), context);
  }

  /** Saves and applies the global AI leads worker concurrency. */
  async saveQueueConfig(workerConcurrency: number, context: AiLeadSearchTaskContext = {}) {
    const user = this.requireUser(context);
    const concurrency = normalizeAiLeadQueueConcurrency(workerConcurrency);
    const record = await this.queueConfigStore.saveConfig({
      workerConcurrency: concurrency,
      updatedById: user.userId,
      updatedByName: user.userName
    });

    await this.taskQueue.applyGlobalConcurrency(record.workerConcurrency);
    this.workerHost?.setLocalConcurrency(record.workerConcurrency);
    await this.recordLog('save-queue-config', 'AI 获客任务配置已保存', context, {
      workerConcurrency: record.workerConcurrency
    });

    return record;
  }

  getQueueConfig() {
    return this.queueConfigStore.getConfig();
  }

  private async updateTaskOrThrow(
    id: string,
    patch: Parameters<AiLeadSearchTaskStore['updateTask']>[1],
    guard?: AiLeadSearchTaskUpdateGuard
  ) {
    const task = await this.taskStore.updateTask(id, patch, guard);

    if (!task) {
      throw new NotFoundException('采集任务不存在');
    }

    return task;
  }

  private async getOwnedTaskOrThrow(id: string, context: AiLeadSearchTaskContext) {
    const user = this.requireUser(context);
    const task = await this.taskStore.findTaskByIdForUser(id, user.userId, user.organizationId);

    if (!task) {
      throw new NotFoundException('采集任务不存在');
    }

    return task;
  }

  private async transitionTask(
    task: AiLeadSearchTaskRecord,
    status: AiLeadSearchTaskStatus,
    eventType: string,
    title: string,
    patch: Parameters<AiLeadSearchTaskStore['updateTask']>[1] = {}
  ) {
    const nextTask = await this.updateTaskOrThrow(
      task.id,
      {
        ...patch,
        status,
        errorMessage: status === 'discarded' ? null : patch.errorMessage
      },
      this.taskGuard(task)
    );

    await this.createTaskEventSafely({
      taskId: task.id,
      eventType,
      fromStatus: task.status,
      toStatus: status,
      title
    });

    return nextTask;
  }

  private async enqueueNextRun(task: AiLeadSearchTaskRecord, eventType: string, title: string) {
    const runVersion = task.runVersion + 1;
    const expectedJobId = toSearchTaskJobId(task.id, runVersion);
    const queueConfig = await this.queueConfigStore.getConfig();
    await this.taskQueue.applyGlobalConcurrency(normalizeAiLeadQueueConcurrency(queueConfig.workerConcurrency));

    const nextTask = await this.updateTaskOrThrow(
      task.id,
      {
        status: 'queued',
        runVersion,
        bullJobId: expectedJobId,
        progressState: null,
        result: null,
        errorMessage: null,
        readAt: null,
        startedAt: null,
        finishedAt: null
      },
      this.taskGuard(task)
    );

    let finalTask = nextTask;

    try {
      const job = await this.taskQueue.enqueueSearchTask({
        taskId: task.id,
        runVersion,
        priority: task.priority
      });

      const updatedTask = await this.taskStore.updateTask(
        task.id,
        { bullJobId: job.jobId },
        this.taskGuard(nextTask, 'queued')
      );
      finalTask =
        updatedTask ??
        (await this.taskStore.findTaskByIdForUser(task.id, task.userId, task.organizationId)) ??
        nextTask;
    } catch (error) {
      await this.markTaskFailedAfterEnqueueError(nextTask, error);
      throw error;
    }

    await this.createTaskEventSafely({
      taskId: task.id,
      eventType,
      fromStatus: task.status,
      toStatus: 'queued',
      title
    });

    return finalTask;
  }

  private requireUser(context: AiLeadSearchTaskContext) {
    if (!context.user?.userId) {
      throw new BadRequestException('用户信息不存在');
    }

    return context.user;
  }

  /** Hides raw search traces from ordinary users while keeping super-admin diagnostics intact. */
  private toVisibleTask(task: AiLeadSearchTaskRecord, context: AiLeadSearchTaskContext) {
    if ((context.user && isSuper(context.user)) || !task.result) {
      return task;
    }

    return {
      ...task,
      result: toOrdinaryUserTaskResult(task.result)
    };
  }

  private normalizeTargetLeadCount(value: number) {
    if (!Number.isInteger(value) || value < 1 || value > 200) {
      throw new BadRequestException('请输入 1-200 的采集数量');
    }

    return value;
  }

  private async markTaskFailedAfterEnqueueError(task: AiLeadSearchTaskRecord, error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const failedTask = await this.taskStore.updateTask(
      task.id,
      {
        status: 'failed',
        errorMessage: message,
        finishedAt: new Date()
      },
      this.taskGuard(task, 'queued')
    );

    if (!failedTask) {
      return;
    }

    await this.createTaskEventSafely({
      taskId: task.id,
      eventType: 'task_enqueue_failed',
      fromStatus: 'queued',
      toStatus: 'failed',
      title: '采集任务入队失败',
      message
    });
  }

  private async removeQueuedJobSafely(taskId: string, jobId: string) {
    try {
      await this.taskQueue.removeSearchTaskJob(jobId);
    } catch (error) {
      await this.createTaskEventSafely({
        taskId,
        eventType: 'task_job_remove_failed',
        title: '采集任务队列任务移除失败',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async markTaskNotificationsReadSafely(task: AiLeadSearchTaskRecord) {
    try {
      await this.notificationService?.markTargetReadForUser('aiLeadSearchTask', task.id, task.userId);
    } catch (error) {
      await this.createTaskEventSafely({
        taskId: task.id,
        eventType: 'task_notification_read_failed',
        title: '任务通知标记已读失败',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /** Writes task timeline events without letting audit failures alter task state. */
  private async createTaskEventSafely(input: Parameters<AiLeadSearchTaskStore['createTaskEvent']>[0]) {
    try {
      await this.taskStore.createTaskEvent(input);
    } catch (error) {
      await this.recordTaskEventFailure(input, error);
    }
  }

  private async recordTaskEventFailure(input: Parameters<AiLeadSearchTaskStore['createTaskEvent']>[0], error: unknown) {
    try {
      await this.systemLogService?.record({
        level: 'error',
        status: 'failed',
        module: 'ai-leads',
        action: 'task-event-write-failed',
        message: 'AI 获客任务事件写入失败',
        errorMessage: error instanceof Error ? error.message : String(error),
        metadata: {
          taskId: input.taskId,
          eventType: input.eventType
        }
      });
    } catch {
      // 事件和日志都失败时不影响任务主状态。
    }
  }

  private taskGuard(task: AiLeadSearchTaskRecord, status: AiLeadSearchTaskStatus = task.status) {
    return {
      userId: task.userId,
      status,
      runVersion: task.runVersion
    } satisfies AiLeadSearchTaskUpdateGuard;
  }

  private recordLog(
    action: string,
    message: string,
    context: AiLeadSearchTaskContext,
    metadata: Record<string, unknown>
  ) {
    return this.systemLogService?.record({
      level: 'info',
      status: 'success',
      module: 'ai-leads',
      action,
      message,
      userId: context.user?.userId,
      userName: context.user?.userName,
      metadata
    });
  }
}

function toOrdinaryUserTaskResult(result: unknown) {
  if (!isRecord(result)) {
    return result;
  }

  if (isRecord(result.summary)) {
    return {
      ...result,
      serperResults: []
    };
  }

  if (
    Array.isArray(result.serperRequests) &&
    Array.isArray(result.serperResults) &&
    Array.isArray(result.decisions) &&
    Array.isArray(result.candidates) &&
    typeof result.stopReason === 'string'
  ) {
    return toLeadSearchPublicResult(result as unknown as Parameters<typeof toLeadSearchPublicResult>[0]);
  }

  return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export type { CreateAiLeadSearchTaskDto };
