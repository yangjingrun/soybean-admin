import { BadRequestException, Inject, Injectable, NotFoundException, Optional, ServiceUnavailableException } from '@nestjs/common';
import { createPageResult } from '../../../shared/pagination';
import { isOrganizationAdmin } from '../../../shared/permission-policy';
import { SystemLogService } from '../../system-log/system-log.service';
import type { SystemLogRecorder } from '../../system-log/system-log.types';
import { SystemNotificationService } from '../../system-notification/system-notification.service';
import { crmAiDraftActiveTaskStatuses } from '../crm-ai-draft-task-state';
import { CRM_AI_DRAFT_TASK_QUEUE, CRM_STORE } from '../crm.tokens';
import { CrmLoggerService } from '../shared/crm-logger.service';
import { CrmSettingsService } from '../settings/crm-settings.service';
import type {
  CrmAiDraftQueueConfigInput,
  CrmAiDraftTaskCreateItemInput,
  CrmAiDraftTaskQueuePort,
  CrmAiDraftTaskRecord,
  CrmSequenceReviewRecord,
  CrmUserContext
} from '../crm.types';
import type { CrmAiDraftTaskRepository } from './crm-ai-draft-task.repository';
import {
  countAiDraftTaskItemRecords,
  getAiDraftTaskItemSkipMessage,
  normalizeAiDraftTaskEnrollmentIds,
  normalizeAiDraftTaskPositiveInteger,
  toAiDraftQueueConfigView,
  toAiDraftTaskCreateLimitMessage,
  toAiDraftTaskItemView,
  toAiDraftTaskView
} from './crm-ai-draft-task.rules';

const defaultPage = 1;
const defaultPageSize = 20;
const maxPageSize = 100;

export interface CreateAiDraftTaskInput {
  enrollmentIds: string[];
}

export interface AiDraftTaskListQuery {
  current?: number;
  size?: number;
}

@Injectable()
export class CrmAiDraftTaskService {
  constructor(
    @Inject(CRM_STORE) private readonly repository: CrmAiDraftTaskRepository,
    @Optional()
    @Inject(CRM_AI_DRAFT_TASK_QUEUE)
    private readonly aiDraftTaskQueue?: CrmAiDraftTaskQueuePort | null,
    @Optional()
    @Inject(SystemNotificationService)
    private readonly systemNotificationService?: SystemNotificationService,
    @Optional()
    @Inject(CrmLoggerService)
    private readonly crmLogger?: CrmLoggerService,
    @Optional()
    @Inject(SystemLogService)
    private readonly systemLogService?: SystemLogRecorder,
    @Optional()
    @Inject(CrmSettingsService)
    private readonly settingsService?: CrmSettingsService
  ) {}

  /** Creates a local CRM AI draft task and queues pending items for review-only draft generation. */
  async createAiDraftTask(input: CreateAiDraftTaskInput, context: CrmUserContext) {
    const enrollmentIds = normalizeAiDraftTaskEnrollmentIds(input.enrollmentIds, 200);
    const items: CrmAiDraftTaskCreateItemInput[] = [];
    const reviewItems = await this.repository.listSequenceReviewItemsByIds({
      ids: enrollmentIds,
      organizationId: context.organizationId,
      ownerUserId: context.userId
    });
    const reviewItemById = new Map(reviewItems.map(item => [item.enrollment.id, item]));
    const blacklistedEmailHashes = await this.loadBlacklistedContactEmailHashes(context.organizationId, reviewItems);

    for (const enrollmentId of enrollmentIds) {
      const item = reviewItemById.get(enrollmentId) ?? null;

      if (!item) {
        items.push(this.createSkippedAiDraftTaskItem(enrollmentId, '邮件序列不存在或无权操作'));
        continue;
      }

      const skipMessage = getAiDraftTaskItemSkipMessage(item, blacklistedEmailHashes);

      if (skipMessage) {
        items.push(this.createSkippedAiDraftTaskItem(enrollmentId, skipMessage, item));
        continue;
      }

      // Next-draft rules already guarantee a source message before this point.
      const sourceMessage = item.messages.at(-1)!;
      items.push({
        enrollmentId: item.enrollment.id,
        messageId: null,
        contactId: item.contact.id,
        accountId: item.account.id,
        productLineId: item.productLine?.id ?? null,
        stepIndex: sourceMessage.stepIndex + 1,
        status: 'pending'
      });
    }

    const pendingCount = items.filter(item => (item.status ?? 'pending') === 'pending').length;
    const skippedCount = items.filter(item => item.status === 'skipped').length;
    const createResult = await this.repository.createAiDraftTask({
      organizationId: context.organizationId,
      organizationRole: context.organizationRole,
      ownerUserId: context.userId,
      ownerUserName: context.userName,
      status: pendingCount > 0 ? 'queued' : 'completed',
      requestedCount: enrollmentIds.length,
      items
    });
    const task = createResult.task;

    if (!task) {
      throw new BadRequestException(toAiDraftTaskCreateLimitMessage(createResult.limitReason));
    }

    const queuedTask =
      pendingCount > 0
        ? await this.enqueueAiDraftTaskIfPossible(task)
        : await this.completeSkippedAiDraftTask(task, {
            requestedCount: task.requestedCount,
            successCount: 0,
            skippedCount,
            failedCount: 0
          });
    const savedItems = await this.repository.listAiDraftTaskItems({
      taskId: task.id
    });

    await this.recordCrmLog('ai-draft-task-create', 'CRM 批量 AI 草稿任务创建', context, {
      taskId: task.id,
      requestedCount: task.requestedCount,
      pendingCount,
      skippedCount
    });

    return {
      task: toAiDraftTaskView(queuedTask),
      items: savedItems.map(toAiDraftTaskItemView)
    };
  }

  /** Returns the owner user's current active or unread AI draft task. */
  async getCurrentAiDraftTask(context: CrmUserContext) {
    const task = await this.repository.findCurrentAiDraftTaskForUser({
      organizationId: context.organizationId,
      ownerUserId: context.userId
    });

    if (!task) {
      return null;
    }

    return this.toAiDraftTaskDetail(task);
  }

  /** Lists AI draft tasks with organization-wide read scope for admins. */
  async listAiDraftTasks(context: CrmUserContext, query: AiDraftTaskListQuery = {}) {
    const current = normalizeAiDraftTaskPositiveInteger(query.current, defaultPage);
    const size = Math.min(normalizeAiDraftTaskPositiveInteger(query.size, defaultPageSize), maxPageSize);
    const result = await this.repository.listAiDraftTasks({
      organizationId: context.organizationId,
      ownerUserId: isOrganizationAdmin(context) ? undefined : context.userId,
      skip: (current - 1) * size,
      take: size
    });

    return createPageResult({
      current,
      size,
      total: result.total,
      records: result.records.map(toAiDraftTaskView)
    });
  }

  /** Reads one task detail with organization-admin read scope and owner member scope. */
  async getAiDraftTaskDetail(id: string, context: CrmUserContext) {
    const task = await this.requireScopedAiDraftTask(id, context);

    return this.toAiDraftTaskDetail(task);
  }

  /** Requeues retryable failed items on a terminal owner task. */
  async retryFailedAiDraftTask(id: string, context: CrmUserContext) {
    const task = await this.requireOwnedAiDraftTask(id, context);

    if (crmAiDraftActiveTaskStatuses.includes(task.status)) {
      throw new BadRequestException('AI 草稿任务仍在运行中，不能重试');
    }

    const items = await this.repository.listAiDraftTaskItems({ taskId: task.id });
    const retryableItems = items.filter(item => item.status === 'failed' && item.failureType === 'retryable');

    if (retryableItems.length === 0) {
      throw new BadRequestException('没有可重试的失败草稿');
    }

    for (const item of retryableItems) {
      await this.repository.updateAiDraftTaskItem(
        item.id,
        {
          status: 'pending',
          attemptCount: 0,
          failureType: null,
          failureReason: null,
          metadata: { ...item.metadata, nextRetryAt: null },
          startedAt: null,
          finishedAt: null
        },
        {
          taskId: task.id,
          organizationId: task.organizationId,
          ownerUserId: task.ownerUserId,
          status: 'failed'
        }
      );
    }

    const nextRunVersion = task.runVersion + 1;
    const updatedItems = await this.repository.listAiDraftTaskItems({
      taskId: task.id
    });
    const counts = countAiDraftTaskItemRecords(updatedItems);
    const queuedTask = await this.repository.updateAiDraftTask(
      task.id,
      {
        status: 'queued',
        runVersion: nextRunVersion,
        bullJobId: null,
        ...counts,
        failureReason: null,
        progressState: null,
        resultSummary: {
          requestedCount: task.requestedCount,
          successCount: counts.successCount,
          skippedCount: counts.skippedCount,
          failedCount: counts.failedCount
        },
        readAt: null,
        notifiedAt: null,
        startedAt: null,
        finishedAt: null
      },
      {
        organizationId: task.organizationId,
        ownerUserId: task.ownerUserId,
        status: ['completed', 'failed', 'cancelled'],
        runVersion: task.runVersion
      }
    );

    if (!queuedTask) {
      throw new BadRequestException('AI 草稿任务状态已变化，请刷新后重试');
    }

    const enqueuedTask = await this.enqueueAiDraftTaskIfPossible(queuedTask);

    await this.recordCrmLog('ai-draft-task-retry-failed', 'CRM 批量 AI 草稿任务重试失败项', context, {
      taskId: task.id,
      retryCount: retryableItems.length,
      runVersion: nextRunVersion
    });

    return this.toAiDraftTaskDetail(enqueuedTask);
  }

  /** Cancels an active owner AI draft task and marks unfinished items as skipped. */
  async cancelAiDraftTask(id: string, context: CrmUserContext) {
    const task = await this.requireOwnedAiDraftTask(id, context);

    if (!crmAiDraftActiveTaskStatuses.includes(task.status)) {
      throw new BadRequestException('AI 草稿任务已结束，不能取消');
    }

    const nextRunVersion = task.runVersion + 1;
    const bullJobId = task.bullJobId;
    const cancelledTask = await this.repository.updateAiDraftTask(
      task.id,
      {
        status: 'cancelled',
        runVersion: nextRunVersion,
        bullJobId: null,
        failureReason: '用户取消任务',
        readAt: null,
        finishedAt: new Date()
      },
      {
        organizationId: task.organizationId,
        ownerUserId: task.ownerUserId,
        status: crmAiDraftActiveTaskStatuses,
        runVersion: task.runVersion
      }
    );

    if (!cancelledTask) {
      throw new BadRequestException('AI 草稿任务状态已变化，请刷新后重试');
    }

    const items = await this.repository.listAiDraftTaskItems({ taskId: task.id });

    for (const item of items.filter(record => ['pending', 'running', 'retrying'].includes(record.status))) {
      await this.repository.updateAiDraftTaskItem(
        item.id,
        {
          status: 'skipped',
          failureType: 'business_skip',
          failureReason: '用户取消任务',
          finishedAt: new Date()
        },
        {
          taskId: task.id,
          organizationId: task.organizationId,
          ownerUserId: task.ownerUserId,
          status: ['pending', 'running', 'retrying']
        }
      );
    }

    if (bullJobId && this.aiDraftTaskQueue) {
      await this.aiDraftTaskQueue.removeTaskJob(bullJobId);
    }

    const updatedItems = await this.repository.listAiDraftTaskItems({
      taskId: task.id
    });
    const counts = countAiDraftTaskItemRecords(updatedItems);
    const refreshedTask =
      (await this.repository.updateAiDraftTask(
        task.id,
        {
          ...counts,
          resultSummary: {
            requestedCount: task.requestedCount,
            successCount: counts.successCount,
            skippedCount: counts.skippedCount,
            failedCount: counts.failedCount
          }
        },
        {
          organizationId: task.organizationId,
          ownerUserId: task.ownerUserId,
          status: 'cancelled',
          runVersion: nextRunVersion
        }
      )) ?? cancelledTask;

    await this.recordCrmLog('ai-draft-task-cancel', 'CRM 批量 AI 草稿任务取消', context, {
      taskId: task.id,
      runVersion: nextRunVersion
    });

    return this.toAiDraftTaskDetail(refreshedTask);
  }

  /** Marks a terminal owner task as read and clears the paired system notification. */
  async markAiDraftTaskRead(id: string, context: CrmUserContext) {
    const task = await this.requireOwnedAiDraftTask(id, context);

    if (crmAiDraftActiveTaskStatuses.includes(task.status)) {
      throw new BadRequestException('AI 草稿任务未结束，不能标记已读');
    }

    const updatedTask = await this.repository.updateAiDraftTask(
      task.id,
      { readAt: new Date() },
      {
        organizationId: task.organizationId,
        ownerUserId: task.ownerUserId,
        status: ['completed', 'failed', 'cancelled'],
        runVersion: task.runVersion
      }
    );

    if (!updatedTask) {
      throw new BadRequestException('AI 草稿任务状态已变化，请刷新后重试');
    }

    await this.systemNotificationService?.markTargetReadForUser('crmAiDraftTask', task.id, context.userId);

    return {
      task: toAiDraftTaskView(updatedTask)
    };
  }

  /** Reads the current AI draft queue configuration. */
  async getAiDraftQueueConfig() {
    if (this.settingsService) {
      return this.settingsService.getAiDraftQueueConfig();
    }

    return toAiDraftQueueConfigView(await this.repository.getAiDraftQueueConfig());
  }

  /** Saves AI draft queue configuration and applies runtime queue concurrency. */
  async saveAiDraftQueueConfig(input: CrmAiDraftQueueConfigInput, context: CrmUserContext) {
    if (this.settingsService) {
      return this.settingsService.saveAiDraftQueueConfig(input, context);
    }

    const config = await this.repository.saveAiDraftQueueConfig({
      ...input,
      updatedById: context.userId,
      updatedByName: context.userName
    });

    await this.aiDraftTaskQueue?.applyGlobalConcurrency(config.maxActiveTasksPerOrg);
    await this.recordCrmLog('ai-draft-queue-config-save', 'CRM AI 草稿队列配置保存', context, {
      itemConcurrency: config.itemConcurrency,
      maxItemConcurrency: config.maxItemConcurrency,
      maxActiveTasksPerUser: config.maxActiveTasksPerUser,
      maxActiveTasksPerOrg: config.maxActiveTasksPerOrg,
      maxAttempts: config.maxAttempts
    });

    return toAiDraftQueueConfigView(config);
  }

  private async enqueueAiDraftTaskIfPossible(task: CrmAiDraftTaskRecord) {
    if (!this.aiDraftTaskQueue) {
      return task;
    }

    try {
      const { jobId } = await this.aiDraftTaskQueue.enqueueTask({
        taskId: task.id,
        organizationId: task.organizationId,
        ownerUserId: task.ownerUserId,
        runVersion: task.runVersion
      });
      const updatedTask = await this.repository.updateAiDraftTask(
        task.id,
        { bullJobId: jobId },
        {
          organizationId: task.organizationId,
          ownerUserId: task.ownerUserId,
          status: ['queued', 'running'],
          runVersion: task.runVersion
        }
      );

      return updatedTask ?? task;
    } catch (error) {
      const failureReason = error instanceof Error ? error.message : String(error);
      const failedTask = await this.repository.updateAiDraftTask(
        task.id,
        {
          status: 'failed',
          failureReason,
          readAt: null,
          finishedAt: new Date()
        },
        {
          organizationId: task.organizationId,
          ownerUserId: task.ownerUserId,
          status: 'queued',
          runVersion: task.runVersion
        }
      );

      throw new ServiceUnavailableException(failedTask?.failureReason || 'CRM 批量 AI 草稿队列不可用');
    }
  }

  private async completeSkippedAiDraftTask(
    task: CrmAiDraftTaskRecord,
    summary: NonNullable<CrmAiDraftTaskRecord['resultSummary']>
  ) {
    const completedTask =
      (await this.repository.updateAiDraftTask(
        task.id,
        {
          resultSummary: summary,
          readAt: null,
          notifiedAt: new Date(),
          finishedAt: task.finishedAt ?? new Date()
        },
        {
          organizationId: task.organizationId,
          ownerUserId: task.ownerUserId,
          status: 'completed',
          runVersion: task.runVersion
        }
      )) ?? task;

    await this.systemNotificationService?.create({
      userId: task.ownerUserId,
      userName: task.ownerUserName,
      module: 'crm',
      type: 'crm_ai_draft_task_completed',
      title: '批量 AI 草稿任务已完成',
      content: '本次 CRM AI 草稿任务已结束，请回到邮件序列页查看跳过原因。',
      targetType: 'crmAiDraftTask',
      targetId: task.id,
      routePath: '/crm/email-sequences',
      metadata: {
        taskId: task.id,
        resultSummary: summary
      }
    });

    return {
      ...completedTask,
      resultSummary: completedTask.resultSummary ?? summary
    };
  }

  /** Batch loads organization blacklist hits for AI draft task validation. */
  private async loadBlacklistedContactEmailHashes(organizationId: string, items: CrmSequenceReviewRecord[]) {
    const emailHashes = Array.from(new Set(items.map(item => item.contact.emailHash).filter(Boolean)));

    if (emailHashes.length === 0) {
      return new Set<string>();
    }

    const entries = await this.repository.listBlacklistEntriesByEmailHashes({
      organizationId,
      emailHashes
    });

    return new Set(entries.map(entry => entry.emailHash));
  }

  private async requireScopedAiDraftTask(id: string, context: CrmUserContext) {
    const task = await this.repository.findAiDraftTaskById({
      id,
      organizationId: context.organizationId,
      ownerUserId: isOrganizationAdmin(context) ? undefined : context.userId
    });

    if (!task) {
      throw new NotFoundException('AI 草稿任务不存在');
    }

    return task;
  }

  private async requireOwnedAiDraftTask(id: string, context: CrmUserContext) {
    const task = await this.repository.findAiDraftTaskById({
      id,
      organizationId: context.organizationId,
      ownerUserId: context.userId
    });

    if (!task) {
      throw new NotFoundException('AI 草稿任务不存在或无权操作');
    }

    return task;
  }

  private async toAiDraftTaskDetail(task: CrmAiDraftTaskRecord) {
    const items = await this.repository.listAiDraftTaskItems({ taskId: task.id });

    return {
      task: toAiDraftTaskView(task),
      items: items.map(toAiDraftTaskItemView)
    };
  }

  private createSkippedAiDraftTaskItem(
    enrollmentId: string,
    failureReason: string,
    item?: CrmSequenceReviewRecord
  ): CrmAiDraftTaskCreateItemInput {
    return {
      enrollmentId,
      messageId: null,
      contactId: item?.contact.id ?? null,
      accountId: item?.account.id ?? null,
      productLineId: item?.productLine?.id ?? null,
      stepIndex: 0,
      status: 'skipped',
      failureType: 'business_skip',
      failureReason
    };
  }

  private recordCrmLog(action: string, message: string, context: CrmUserContext, metadata: Record<string, unknown>) {
    if (this.crmLogger) {
      return this.crmLogger.record(action, message, context, metadata);
    }

    return this.systemLogService?.record({
      level: 'info',
      status: 'success',
      module: 'crm',
      action,
      message,
      userId: context.userId,
      userName: context.userName,
      metadata
    });
  }
}
