import { Inject, Injectable, Optional } from '@nestjs/common';
import { createTaskNotificationMetadata, isStaleRunVersion, isTaskInStatus } from '../../shared/task-state';
import { requireEnabledCrmProductLineAiWritingConfig } from './crm-ai-draft-prompt';
import { CrmAiDraftService } from './crm-ai-draft.service';
import {
  classifyCrmAiDraftTaskItemFailure,
  getCrmAiDraftRetryBackoffSeconds,
  normalizeCrmAiDraftItemConcurrency
} from './crm-ai-draft-task-state';
import type {
  CrmAiDraftTaskItemRecord,
  CrmAiDraftTaskQueueJob,
  CrmAiDraftTaskRecord,
  CrmAiDraftTaskResultSummary
} from './crm-ai-draft-task.types';
import type { CrmAiDraftWorkerRepository } from './crm-ai-draft-worker.repository';
import { buildNextFollowUpDraft } from './crm-follow-up-draft';
import { buildPersonaMatch } from './crm-persona-match';
import { CRM_AI_DRAFT_WORKER_REPOSITORY } from './crm.tokens';
import type {
  CrmAiWritingStepIndex,
  CrmMessageStatus,
  CrmProductLineRecord,
  CrmSequenceEnrollmentStatus,
  CrmSequenceReviewRecord
} from './crm.types';
import { SystemNotificationService } from '../system-notification/system-notification.service';

const nextDraftEnrollmentStatuses: CrmSequenceEnrollmentStatus[] = ['ready_to_send', 'sequence_running'];
const blockingNextDraftMessageStatuses: CrmMessageStatus[] = ['draft_pending_review', 'queued', 'failed'];

class CrmAiDraftTaskInterruptedError extends Error {
  constructor() {
    super('CRM AI draft task interrupted');
    this.name = 'CrmAiDraftTaskInterruptedError';
  }
}

@Injectable()
export class CrmAiDraftTaskWorkerService {
  constructor(
    @Inject(CRM_AI_DRAFT_WORKER_REPOSITORY) private readonly store: CrmAiDraftWorkerRepository,
    @Inject(CrmAiDraftService)
    private readonly aiDraftService: CrmAiDraftService,
    @Optional()
    @Inject(SystemNotificationService)
    private readonly notificationService?: SystemNotificationService
  ) {}

  /** Processes one bulk AI draft task without touching Gmail or the send queue. */
  async processTaskJob(job: CrmAiDraftTaskQueueJob) {
    const task = await this.store.findAiDraftTaskById({
      id: job.taskId,
      organizationId: job.organizationId,
      ownerUserId: job.ownerUserId
    });

    if (!task || isStaleRunVersion(task, job.runVersion) || !isTaskInStatus(task, ['queued', 'running'])) {
      return;
    }

    const runningTask = await this.markRunning(task, job.runVersion);

    if (!runningTask) {
      return;
    }

    const items = (await this.store.listAiDraftTaskItems({ taskId: runningTask.id })).filter(item =>
      ['pending', 'retrying', 'running'].includes(item.status)
    );

    try {
      await runWithConcurrency(items, runningTask.effectiveConcurrency, item => this.processItem(runningTask, item));
      await this.assertTaskStillRunning(runningTask);
      await this.completeTask(runningTask);
    } catch (error) {
      if (error instanceof CrmAiDraftTaskInterruptedError) {
        return;
      }

      await this.failTask(runningTask, error);
    }
  }

  private async markRunning(task: CrmAiDraftTaskRecord, runVersion: number) {
    return this.store.updateAiDraftTask(
      task.id,
      {
        status: 'running',
        failureReason: null,
        startedAt: task.startedAt ?? new Date()
      },
      this.taskGuard(task, ['queued', 'running'], runVersion)
    );
  }

  private async processItem(task: CrmAiDraftTaskRecord, item: CrmAiDraftTaskItemRecord) {
    await this.assertTaskStillRunning(task);
    const runningItem = await this.store.updateAiDraftTaskItem(
      item.id,
      {
        status: 'running',
        attemptCount: item.attemptCount + 1,
        failureType: null,
        failureReason: null,
        startedAt: item.startedAt ?? new Date()
      },
      {
        taskId: task.id,
        organizationId: task.organizationId,
        ownerUserId: task.ownerUserId,
        status: ['pending', 'retrying', 'running']
      }
    );

    if (!runningItem) {
      return;
    }

    try {
      const generated = await this.generateItemDraft(task, runningItem);
      await this.assertTaskStillRunning(task);

      if (generated === undefined) {
        return;
      }

      if (generated === null) {
        await this.skipItem(task, runningItem, '当前草稿状态已变化，请刷新后重试');
        return;
      }

      await this.store.updateAiDraftTaskItem(
        runningItem.id,
        {
          status: 'succeeded',
          failureType: null,
          failureReason: null,
          draftSubject: generated.message.subject,
          draftBodyText: generated.message.bodyText,
          metadata: {
            generatedMessageId: generated.message.id,
            aiDraft: generated.aiDraft
          },
          finishedAt: new Date()
        },
        this.runningItemGuard(task)
      );
      await this.refreshTaskCounters(task);
    } catch (error) {
      if (error instanceof CrmAiDraftTaskInterruptedError) {
        throw error;
      }

      const failureType = classifyCrmAiDraftTaskItemFailure(error);
      const failureReason = error instanceof Error ? error.message : String(error);

      if (failureType === 'retryable' && runningItem.attemptCount < runningItem.maxAttempts) {
        const retryingItem = await this.markItemRetrying(task, runningItem, failureReason);

        if (!retryingItem) {
          return;
        }

        await this.waitForRetryBackoff(task, retryingItem.attemptCount);
        await this.processItem(task, retryingItem);
        return;
      }

      await this.store.updateAiDraftTaskItem(
        runningItem.id,
        {
          status: 'failed',
          failureType,
          failureReason,
          finishedAt: new Date()
        },
        this.runningItemGuard(task)
      );
      await this.refreshTaskCounters(task);
    }
  }

  private async generateItemDraft(task: CrmAiDraftTaskRecord, item: CrmAiDraftTaskItemRecord) {
    const reviewItem = await this.store.getSequenceReviewItem({
      id: item.enrollmentId,
      organizationId: task.organizationId,
      ownerUserId: task.ownerUserId
    });

    if (!reviewItem) {
      await this.skipItem(task, item, '邮件序列不存在或无权操作');
      return undefined;
    }

    const skipMessage = await this.getItemSkipMessage(reviewItem);

    if (skipMessage) {
      await this.skipItem(task, item, skipMessage);
      return undefined;
    }

    const sourceMessage = reviewItem.messages.at(-1)!;
    const stepIndex = toAiWritingStepIndex(sourceMessage.stepIndex + 1);
    const [globalConfig, defaultTemplateGroup, personaProfiles] = await Promise.all([
      this.store.getGlobalConfig(),
      this.store.findDefaultEmailTemplateGroup(task.organizationId),
      this.store.listActivePersonaProfiles(task.organizationId)
    ]);
    const personaMatch = buildPersonaMatch(personaProfiles, reviewItem.account, reviewItem.contact);
    const baseNextMessage = buildNextFollowUpDraft({
      item: reviewItem,
      sourceMessage,
      providerThreadId: sourceMessage.providerThreadId,
      baseTime: new Date(),
      followUpDelayDays: globalConfig.followUpDelayDays,
      personaProfile: personaMatch.templatePersona,
      templateGroup: defaultTemplateGroup,
      senderName: task.ownerUserName
    });

    if (!baseNextMessage) {
      await this.skipItem(task, item, '当前序列没有可生成的下一步草稿');
      return undefined;
    }

    const productLine = reviewItem.productLine as CrmProductLineRecord;
    const writingConfig = requireEnabledCrmProductLineAiWritingConfig(productLine.aiWritingConfig);
    const draft = await this.aiDraftService.generateDraft({
      account: {
        name: reviewItem.account.name,
        country: reviewItem.account.country,
        domain: reviewItem.account.domain,
        customerType: reviewItem.account.customerType
      },
      contact: {
        fullName: reviewItem.contact.fullName,
        title: reviewItem.contact.title,
        maskedEmail: reviewItem.contact.maskedEmail,
        emailStatus: reviewItem.contact.emailStatus
      },
      productLine: {
        id: productLine.id,
        name: productLine.name,
        targetCustomerType: productLine.targetCustomerType,
        coreSellingPoints: productLine.coreSellingPoints,
        moq: productLine.moq,
        leadTime: productLine.leadTime,
        paymentTerms: productLine.paymentTerms,
        certifications: productLine.certifications,
        catalogUrl: productLine.catalogUrl,
        websiteUrl: productLine.websiteUrl,
        commonModelsText: productLine.commonModelsText
      },
      writingConfig,
      stepIndex,
      previousMessages: reviewItem.messages.map(message => ({
        stepIndex: message.stepIndex,
        subject: message.subject,
        bodyText: message.bodyText
      })),
      senderName: task.ownerUserName
    });
    const nextMessage = {
      ...baseNextMessage,
      subject: draft.subject || baseNextMessage.subject,
      bodyText: draft.bodyText,
      metadata: createAiDraftMessageMetadata(draft.metadata)
    };
    const bundle = await this.store.createFollowUpDraftBundle({
      enrollmentId: reviewItem.enrollment.id,
      organizationId: task.organizationId,
      ownerUserId: task.ownerUserId,
      expectedEnrollmentStatus: nextDraftEnrollmentStatuses,
      blockingMessageStatuses: blockingNextDraftMessageStatuses,
      taskGuard: {
        taskId: task.id,
        runVersion: task.runVersion,
        status: 'running'
      },
      message: nextMessage,
      timelineEvent: {
        organizationId: nextMessage.organizationId,
        accountId: nextMessage.accountId,
        contactId: nextMessage.contactId,
        ownerUserId: task.ownerUserId,
        eventType: 'sequence_follow_up_draft_generated',
        title: '批量 AI 生成后续开发信草稿',
        content: nextMessage.subject,
        metadata: {
          enrollmentId: reviewItem.enrollment.id,
          personaProfileId: personaMatch.persona?.id ?? null,
          personaProfileName: personaMatch.persona?.name ?? null,
          personaMatchMethod: personaMatch.matchMethod,
          personaMatchedKeywords: personaMatch.matchedKeywords,
          personaFallbackReason: personaMatch.fallbackReason,
          stepIndex: nextMessage.stepIndex,
          aiDraft: draft.metadata
        }
      }
    });

    if (!bundle) {
      return null;
    }

    return {
      message: bundle.message,
      aiDraft: draft.metadata
    };
  }

  private async getItemSkipMessage(item: CrmSequenceReviewRecord) {
    const nextDraftSkipMessage = this.getNextDraftSkipMessage(item);

    if (nextDraftSkipMessage) {
      return nextDraftSkipMessage;
    }

    if (item.contact.emailStatus === 'unsubscribed') {
      return '联系人已退订，不能继续开发';
    }

    const blacklistEntries = await this.store.listBlacklistEntriesByEmailHashes({
      organizationId: item.enrollment.organizationId,
      emailHashes: [item.contact.emailHash]
    });

    if (blacklistEntries.length > 0) {
      return '该邮箱已在组织黑名单中，不能继续开发';
    }

    if (!item.productLine || item.productLine.status !== 'active' || !item.productLine.aiWritingConfig?.enabled) {
      return '产品资料未启用 AI 写信';
    }

    const sourceMessage = item.messages.at(-1)!;
    const stepIndex = sourceMessage.stepIndex + 1;

    try {
      const writingConfig = requireEnabledCrmProductLineAiWritingConfig(item.productLine.aiWritingConfig);
      const stepConfig = writingConfig.steps.find(step => step.stepIndex === stepIndex);

      if (!stepConfig?.prompt) {
        return `产品资料缺少第 ${stepIndex} 封 AI 写信提示词`;
      }
    } catch (error) {
      return error instanceof Error ? error.message : '产品资料 AI 写信配置不完整';
    }

    return null;
  }

  private getNextDraftSkipMessage(item: CrmSequenceReviewRecord) {
    if (!nextDraftEnrollmentStatuses.includes(item.enrollment.status)) {
      return '当前序列状态不能生成下一封草稿';
    }

    const sourceMessage = item.messages.at(-1);

    if (!sourceMessage) {
      return '当前序列还没有可参考的开发信';
    }

    if (sourceMessage.stepIndex >= item.enrollment.totalSteps) {
      return '当前序列已达到最大步骤数';
    }

    if (item.messages.some(message => blockingNextDraftMessageStatuses.includes(message.status))) {
      return '已存在下一步草稿或待发送消息，请先处理后再生成';
    }

    return null;
  }

  private async skipItem(task: CrmAiDraftTaskRecord, item: CrmAiDraftTaskItemRecord, reason: string) {
    await this.store.updateAiDraftTaskItem(
      item.id,
      {
        status: 'skipped',
        failureType: 'business_skip',
        failureReason: reason,
        finishedAt: new Date()
      },
      this.runningItemGuard(task)
    );
    await this.refreshTaskCounters(task);
  }

  private async markItemRetrying(task: CrmAiDraftTaskRecord, item: CrmAiDraftTaskItemRecord, failureReason: string) {
    const config = await this.store.getAiDraftQueueConfig();
    const retryAfterSeconds = getCrmAiDraftRetryBackoffSeconds(config.retryBackoffSeconds ?? [], item.attemptCount);
    const nextRetryAt = new Date(Date.now() + retryAfterSeconds * 1000);
    const retryingItem = await this.store.updateAiDraftTaskItem(
      item.id,
      {
        status: 'retrying',
        failureType: 'retryable',
        failureReason,
        metadata: {
          ...item.metadata,
          nextRetryAt: nextRetryAt.toISOString()
        },
        finishedAt: null
      },
      this.runningItemGuard(task)
    );

    await this.recordRetryableFailure(task);
    await this.refreshTaskCounters(task);

    return retryingItem;
  }

  private async recordRetryableFailure(task: CrmAiDraftTaskRecord) {
    const recentRetryableFailureCount = (task.progressState?.recentRetryableFailureCount ?? 0) + 1;
    const shouldSlowDown = recentRetryableFailureCount >= 2 && task.effectiveConcurrency > 1;

    await this.store.updateAiDraftTask(
      task.id,
      {
        ...(shouldSlowDown ? { effectiveConcurrency: 1 } : {}),
        progressState: {
          ...task.progressState,
          recentRetryableFailureCount,
          effectiveConcurrencyReason: shouldSlowDown
            ? 'retryable_failures_clustered'
            : task.progressState?.effectiveConcurrencyReason
        }
      },
      this.taskGuard(task, 'running')
    );

    task.progressState = {
      ...task.progressState,
      recentRetryableFailureCount,
      effectiveConcurrencyReason: shouldSlowDown
        ? 'retryable_failures_clustered'
        : task.progressState?.effectiveConcurrencyReason
    };

    if (shouldSlowDown) {
      task.effectiveConcurrency = 1;
    }
  }

  private async waitForRetryBackoff(task: CrmAiDraftTaskRecord, attemptCount: number) {
    const config = await this.store.getAiDraftQueueConfig();
    const retryAfterSeconds = getCrmAiDraftRetryBackoffSeconds(config.retryBackoffSeconds ?? [], attemptCount);

    if (retryAfterSeconds > 0) {
      await sleep(retryAfterSeconds * 1000);
    }

    await this.assertTaskStillRunning(task);
  }

  private async completeTask(task: CrmAiDraftTaskRecord) {
    const summary = await this.refreshTaskCounters(task);
    const hasUnfinishedItems = await this.hasUnfinishedItems(task);
    const status = summary.failedCount > 0 || hasUnfinishedItems ? 'failed' : 'completed';
    const completedTask = await this.store.updateAiDraftTask(
      task.id,
      {
        status,
        failureReason:
          status === 'failed' ? (hasUnfinishedItems ? '部分草稿未完成，请重试失败项' : '部分草稿生成失败') : null,
        resultSummary: summary,
        readAt: null,
        notifiedAt: new Date(),
        finishedAt: new Date()
      },
      this.taskGuard(task, 'running')
    );

    if (!completedTask) {
      throw new CrmAiDraftTaskInterruptedError();
    }

    await this.createTaskNotificationSafely(
      completedTask,
      status === 'failed' ? 'crm_ai_draft_task_failed' : 'crm_ai_draft_task_completed',
      status === 'failed' ? '批量 AI 草稿任务部分失败' : '批量 AI 草稿任务已完成',
      status === 'failed'
        ? '部分 CRM AI 草稿生成失败，请回到邮件序列页查看。'
        : 'CRM AI 草稿已生成，请回到邮件序列页审核。'
    );
  }

  private async failTask(task: CrmAiDraftTaskRecord, error: unknown) {
    const failedTask = await this.store.updateAiDraftTask(
      task.id,
      {
        status: 'failed',
        failureReason: error instanceof Error ? error.message : String(error),
        resultSummary: await this.refreshTaskCounters(task),
        readAt: null,
        notifiedAt: new Date(),
        finishedAt: new Date()
      },
      this.taskGuard(task, 'running')
    );

    if (!failedTask) {
      return;
    }

    await this.createTaskNotificationSafely(
      failedTask,
      'crm_ai_draft_task_failed',
      '批量 AI 草稿任务失败',
      failedTask.failureReason || 'CRM AI 草稿生成失败，请回到邮件序列页查看。'
    );
  }

  private async refreshTaskCounters(task: CrmAiDraftTaskRecord): Promise<CrmAiDraftTaskResultSummary> {
    const items = await this.store.listAiDraftTaskItems({ taskId: task.id });
    const counts = countItems(items);
    const summary = {
      requestedCount: task.requestedCount,
      successCount: counts.successCount,
      skippedCount: counts.skippedCount,
      failedCount: counts.failedCount
    };

    await this.store.updateAiDraftTask(
      task.id,
      {
        ...counts,
        resultSummary: summary
      },
      this.taskGuard(task, 'running')
    );

    return summary;
  }

  private async hasUnfinishedItems(task: CrmAiDraftTaskRecord) {
    const items = await this.store.listAiDraftTaskItems({ taskId: task.id });
    return items.some(item => ['pending', 'retrying', 'running'].includes(item.status));
  }

  private async assertTaskStillRunning(task: CrmAiDraftTaskRecord) {
    const latestTask = await this.store.findAiDraftTaskById({
      id: task.id,
      organizationId: task.organizationId,
      ownerUserId: task.ownerUserId
    });

    if (!latestTask || isStaleRunVersion(latestTask, task.runVersion) || !isTaskInStatus(latestTask, ['running'])) {
      throw new CrmAiDraftTaskInterruptedError();
    }
  }

  /** Creates a notification without letting notification delivery rewrite task status. */
  private async createTaskNotificationSafely(task: CrmAiDraftTaskRecord, type: string, title: string, content: string) {
    await this.notificationService?.create({
      userId: task.ownerUserId,
      userName: task.ownerUserName,
      module: 'crm',
      type,
      title,
      content,
      targetType: 'crmAiDraftTask',
      targetId: task.id,
      routePath: '/crm/email-sequences',
      metadata: createTaskNotificationMetadata(task.id, {
        resultSummary: task.resultSummary
      })
    });
  }

  private taskGuard(
    task: CrmAiDraftTaskRecord,
    status: CrmAiDraftTaskRecord['status'] | CrmAiDraftTaskRecord['status'][],
    runVersion = task.runVersion
  ) {
    return {
      organizationId: task.organizationId,
      ownerUserId: task.ownerUserId,
      status,
      runVersion
    };
  }

  private runningItemGuard(task: CrmAiDraftTaskRecord) {
    return {
      taskId: task.id,
      organizationId: task.organizationId,
      ownerUserId: task.ownerUserId,
      status: 'running' as const
    };
  }
}

async function runWithConcurrency<T>(items: T[], concurrency: number, handler: (item: T) => Promise<void>) {
  const workerCount = Math.min(items.length, normalizeCrmAiDraftItemConcurrency(concurrency));
  let nextIndex = 0;

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const item = items[nextIndex];
        nextIndex += 1;
        await handler(item);
      }
    })
  );
}

function countItems(items: CrmAiDraftTaskItemRecord[]) {
  return {
    successCount: items.filter(item => item.status === 'succeeded').length,
    skippedCount: items.filter(item => item.status === 'skipped').length,
    failedCount: items.filter(item => item.status === 'failed').length,
    retryingCount: items.filter(item => item.status === 'retrying').length,
    runningCount: items.filter(item => item.status === 'running').length,
    pendingCount: items.filter(item => item.status === 'pending').length
  };
}

function toAiWritingStepIndex(value: number): CrmAiWritingStepIndex {
  if (value < 1 || value > 5) {
    throw new Error(`Unsupported AI writing step index: ${value}`);
  }

  return value as CrmAiWritingStepIndex;
}

function sleep(ms: number) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

function createAiDraftMessageMetadata(aiDraft: unknown) {
  return { aiDraft };
}
