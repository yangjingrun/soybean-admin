import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException
} from '@nestjs/common';
import { createPageResult } from '../../../shared/pagination';
import { isOrganizationAdmin } from '../../../shared/permission-policy';
import { SystemLogService } from '../../system-log/system-log.service';
import type { SystemLogRecorder } from '../../system-log/system-log.types';
import { SystemNotificationService } from '../../system-notification/system-notification.service';
import { CRM_ACCOUNT_REPOSITORY, CRM_MAILBOX_REPOSITORY, CRM_SETTINGS_REPOSITORY } from '../crm.tokens';
import { crmAiDraftActiveTaskStatuses } from '../crm-ai-draft-task-state';
import {
  CRM_AI_DRAFT_TASK_QUEUE,
  CRM_AI_DRAFT_TASK_REPOSITORY,
  CRM_AI_DRAFT_TASK_SOURCE_REPOSITORY
} from '../crm.tokens';
import { resolveCrmSenderName } from '../shared/crm-context';
import { CrmLoggerService } from '../shared/crm-logger.service';
import { CrmSettingsService } from '../settings/crm-settings.service';
import type {
  CrmAiDraftQueueConfigInput,
  CrmAiDraftTaskCreateItemInput,
  CrmAiDraftTaskQueuePort,
  CrmAiDraftTaskRecord,
  CrmAccountRecord,
  CrmContactRecord,
  CrmSequenceReviewRecord,
  CrmUserContext
} from '../crm.types';
import type { CrmAccountRepository } from '../accounts/crm-account.repository';
import type { CrmMailboxRepository } from '../mailbox/crm-mailbox.repository';
import type { CrmSettingsRepository } from '../settings/crm-settings.repository';
import { createCrmOwnerFilter } from '../shared/crm-scope';
import { CrmSequenceEligibilityService } from '../sequence/crm-sequence-eligibility.service';
import { buildSequenceName } from '../sequence/crm-sequence-review-creation.service';
import type { CrmAiDraftTaskRepository, CrmAiDraftTaskSourceRepository } from './crm-ai-draft-task.repository';
import {
  countAiDraftTaskItemRecords,
  getAiDraftTaskItemSkipMessage,
  normalizeAiDraftTaskEnrollmentIds,
  normalizeAiDraftTaskPositiveInteger,
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

export interface FirstOutreachAiDraftTaskTargetInput {
  accountId: string;
  contactId: string;
}

export interface CreateFirstOutreachAiDraftTaskInput {
  targets: FirstOutreachAiDraftTaskTargetInput[];
  productLineId?: string | null;
  mailboxId?: string | null;
  policyId?: string | null;
}

export interface AiDraftTaskListQuery {
  current?: number;
  size?: number;
}

@Injectable()
export class CrmAiDraftTaskService {
  constructor(
    @Inject(CRM_AI_DRAFT_TASK_REPOSITORY) private readonly repository: CrmAiDraftTaskRepository,
    @Inject(CRM_AI_DRAFT_TASK_SOURCE_REPOSITORY) private readonly sourceRepository: CrmAiDraftTaskSourceRepository,
    @Inject(CRM_ACCOUNT_REPOSITORY) private readonly accountRepository: CrmAccountRepository,
    @Inject(CRM_SETTINGS_REPOSITORY) private readonly settingsRepository: CrmSettingsRepository,
    @Inject(CRM_MAILBOX_REPOSITORY) private readonly mailboxRepository: CrmMailboxRepository,
    @Inject(CrmSequenceEligibilityService)
    private readonly sequenceEligibilityService: CrmSequenceEligibilityService,
    @Inject(CrmSettingsService)
    private readonly settingsService: CrmSettingsService,
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
    private readonly systemLogService?: SystemLogRecorder
  ) {}

  /** Creates a local CRM AI draft task and queues pending items for review-only draft generation. */
  async createAiDraftTask(input: CreateAiDraftTaskInput, context: CrmUserContext) {
    const enrollmentIds = normalizeAiDraftTaskEnrollmentIds(input.enrollmentIds, 200);
    const items: CrmAiDraftTaskCreateItemInput[] = [];
    const reviewItems = await this.sourceRepository.listSequenceReviewItemsByIds({
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
      ownerUserName: resolveCrmSenderName(context),
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

  /** Creates placeholder sequences and queues first outreach AI generation in the background. */
  async createFirstOutreachAiDraftTask(input: CreateFirstOutreachAiDraftTaskInput, context: CrmUserContext) {
    const targets = normalizeFirstOutreachTargets(input.targets, 200);

    if (!input.mailboxId) {
      throw new BadRequestException('请选择发送邮箱');
    }

    const [productLine, mailbox, selectedPolicy, defaultPolicy] = await Promise.all([
      input.productLineId ? this.requireActiveProductLine(input.productLineId, context) : Promise.resolve(null),
      this.requireOwnedActiveMailbox(input.mailboxId, context),
      input.policyId ? this.requireActiveSequencePolicy(input.policyId, context) : Promise.resolve(null),
      input.policyId ? Promise.resolve(null) : this.settingsRepository.findDefaultSequencePolicy(context.organizationId)
    ]);
    const policy = selectedPolicy ?? defaultPolicy;
    const targetDetails: Array<{ account: CrmAccountRecord; contact: CrmContactRecord }> = [];

    for (const target of targets) {
      const detail = await this.requireScopedAccountAndContact(target.accountId, target.contactId, context);
      await this.sequenceEligibilityService.assertCanCreateSequenceReview({
        account: detail.account,
        contact: detail.contact,
        policy,
        context
      });
      targetDetails.push(detail);
    }

    const createResult = await this.repository.createFirstOutreachAiDraftTask({
      organizationId: context.organizationId,
      organizationRole: context.organizationRole,
      ownerUserId: context.userId,
      ownerUserName: resolveCrmSenderName(context),
      requestedCount: targetDetails.length,
      accountStatus: 'sequence_running',
      enrollments: targetDetails.map(({ account, contact }) => ({
        enrollment: {
          organizationId: context.organizationId,
          ownerUserId: context.userId,
          accountId: account.id,
          contactId: contact.id,
          productLineId: productLine?.id ?? null,
          mailboxId: mailbox.id,
          policyId: policy?.id ?? null,
          name: buildSequenceName(account, contact),
          status: 'draft_review_pending',
          currentStep: 1,
          totalSteps: 5,
          runVersion: 1,
          createdById: context.userId,
          createdByName: resolveCrmSenderName(context)
        },
        item: {
          accountId: account.id,
          contactId: contact.id,
          productLineId: productLine?.id ?? null,
          messageId: null
        }
      }))
    });
    const task = createResult.task;

    if (!task) {
      throw new BadRequestException(toAiDraftTaskCreateLimitMessage(createResult.limitReason));
    }

    const queuedTask = await this.enqueueAiDraftTaskIfPossible(task);
    const savedItems = await this.repository.listAiDraftTaskItems({
      taskId: task.id
    });

    await this.recordCrmLog('first-outreach-ai-draft-task-create', 'CRM 首封开发信后台生成任务创建', context, {
      taskId: task.id,
      requestedCount: task.requestedCount,
      enrollmentIds: createResult.enrollmentIds ?? []
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

  private async requireScopedAccountAndContact(accountId: string, contactId: string, context: CrmUserContext) {
    const detail = await this.accountRepository.getAccountDetail({
      id: accountId,
      organizationId: context.organizationId,
      ...createCrmOwnerFilter(context)
    });
    const contact = detail?.contacts.find(item => item.id === contactId) ?? null;

    if (!detail) {
      throw new NotFoundException('线索不存在');
    }

    if (!contact) {
      throw new NotFoundException('联系人不存在');
    }

    return {
      account: detail.account,
      contact
    };
  }

  private async requireActiveProductLine(id: string, context: CrmUserContext) {
    const productLine = await this.settingsRepository.findProductLineById({
      id,
      organizationId: context.organizationId
    });

    if (!productLine) {
      throw new NotFoundException('产品资料不存在');
    }

    if (productLine.status !== 'active') {
      throw new BadRequestException('产品资料已归档');
    }

    return productLine;
  }

  private async requireActiveSequencePolicy(id: string, context: CrmUserContext) {
    const policy = await this.settingsRepository.findSequencePolicyById({
      id,
      organizationId: context.organizationId
    });

    if (!policy) {
      throw new NotFoundException('序列策略不存在');
    }

    if (policy.status !== 'active') {
      throw new BadRequestException('序列策略已归档');
    }

    return policy;
  }

  private async requireOwnedActiveMailbox(id: string, context: CrmUserContext) {
    const mailbox = await this.mailboxRepository.findMailboxById({
      id,
      organizationId: context.organizationId,
      ownerUserId: context.userId
    });

    if (!mailbox) {
      throw new NotFoundException('邮箱不存在');
    }

    if (mailbox.status !== 'active') {
      throw new BadRequestException('邮箱未启用');
    }

    return mailbox;
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
    return this.settingsService.getAiDraftQueueConfig();
  }

  /** Saves AI draft queue configuration and applies runtime queue concurrency. */
  async saveAiDraftQueueConfig(input: CrmAiDraftQueueConfigInput, context: CrmUserContext) {
    return this.settingsService.saveAiDraftQueueConfig(input, context);
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

    const entries = await this.sourceRepository.listBlacklistEntriesByEmailHashes({
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

function normalizeFirstOutreachTargets(value: FirstOutreachAiDraftTaskTargetInput[], maxSize: number) {
  if (!Array.isArray(value)) {
    throw new BadRequestException('请选择可生成开发信的联系人');
  }

  const seenKeys = new Set<string>();
  const targets: FirstOutreachAiDraftTaskTargetInput[] = [];

  for (const item of value) {
    const accountId = typeof item?.accountId === 'string' ? item.accountId.trim() : '';
    const contactId = typeof item?.contactId === 'string' ? item.contactId.trim() : '';

    if (!accountId || !contactId) continue;

    const key = `${accountId}:${contactId}`;

    if (seenKeys.has(key)) continue;

    seenKeys.add(key);
    targets.push({ accountId, contactId });
  }

  if (targets.length === 0) {
    throw new BadRequestException('请选择可生成开发信的联系人');
  }

  if (targets.length > maxSize) {
    throw new BadRequestException(`一次最多选择 ${maxSize} 个联系人`);
  }

  return targets;
}
