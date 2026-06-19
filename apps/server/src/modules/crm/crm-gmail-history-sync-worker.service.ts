import { Inject, Injectable, Optional } from '@nestjs/common';
import { SystemLogService } from '../system-log/system-log.service';
import type { SystemLogRecorder } from '../system-log/system-log.types';
import { SystemNotificationService } from '../system-notification/system-notification.service';
import { CrmGmailHistoryExpiredError } from './crm-gmail-history.gateway';
import { CRM_GMAIL_HISTORY_GATEWAY, CRM_STORE } from './crm.tokens';
import { CrmGmailAuthorizationExpiredError } from './crm-gmail-watch.gateway';
import type {
  CrmGmailHistoryGateway,
  CrmGmailHistoryListResult,
  CrmGmailHistoryMessage,
  CrmGmailHistorySyncQueueJob,
  CrmGmailHistorySyncResult,
  CrmMailboxRecord,
  CrmMessageRecord,
  CrmStore
} from './crm.types';

type RecoveredCrmGmailHistoryResult = CrmGmailHistoryListResult & { historyExpired?: boolean };

@Injectable()
export class CrmGmailHistorySyncWorkerService {
  constructor(
    @Inject(CRM_STORE) private readonly store: CrmStore,
    @Inject(CRM_GMAIL_HISTORY_GATEWAY) private readonly gmailHistoryGateway: CrmGmailHistoryGateway,
    @Optional()
    @Inject(SystemLogService)
    private readonly systemLogService?: SystemLogRecorder,
    @Optional()
    @Inject(SystemNotificationService)
    private readonly systemNotificationService?: SystemNotificationService
  ) {}

  /** Runs one incremental Gmail History sync job and advances the mailbox checkpoint after processing. */
  async processHistorySyncJob(job: CrmGmailHistorySyncQueueJob): Promise<CrmGmailHistorySyncResult> {
    const mailbox = await this.store.findMailboxById({
      id: job.mailboxId,
      organizationId: job.organizationId,
      ownerUserId: job.ownerUserId
    });

    if (!mailbox) {
      return {
        status: 'skipped',
        reason: 'mailbox_not_found',
        mailboxId: job.mailboxId,
        fromHistoryId: null,
        toHistoryId: job.historyId,
        ingestedCount: 0,
        skippedMessageCount: 0
      };
    }

    if (mailbox.status !== 'active') {
      return {
        status: 'skipped',
        reason: 'mailbox_not_active',
        mailboxId: mailbox.id,
        fromHistoryId: mailbox.lastHistoryId,
        toHistoryId: job.historyId,
        ingestedCount: 0,
        skippedMessageCount: 0
      };
    }

    if (isHistoryIdAtOrBefore(job.historyId, mailbox.lastHistoryId)) {
      return {
        status: 'skipped',
        reason: 'stale_history',
        mailboxId: mailbox.id,
        fromHistoryId: mailbox.lastHistoryId,
        toHistoryId: job.historyId,
        ingestedCount: 0,
        skippedMessageCount: 0
      };
    }

    const history = await this.listHistoryOrRecover(job, mailbox);

    if (!history) {
      return {
        status: 'skipped',
        reason: 'authorization_expired',
        mailboxId: mailbox.id,
        fromHistoryId: mailbox.lastHistoryId,
        toHistoryId: job.historyId,
        ingestedCount: 0,
        skippedMessageCount: 0
      };
    }

    if (history.historyExpired) {
      await this.recordHistoryExpired(mailbox, job);

      return {
        status: 'skipped',
        reason: 'history_expired',
        mailboxId: mailbox.id,
        fromHistoryId: mailbox.lastHistoryId,
        toHistoryId: job.historyId,
        ingestedCount: 0,
        skippedMessageCount: 0
      };
    }

    const ingestResult = await this.ingestHistoryMessages(job, history.messages);
    const advancedMailbox = await this.store.advanceMailboxHistoryId({
      mailboxId: mailbox.id,
      organizationId: mailbox.organizationId,
      ownerUserId: mailbox.ownerUserId,
      fromHistoryId: mailbox.lastHistoryId,
      toHistoryId: history.nextHistoryId
    });

    if (!advancedMailbox) {
      return {
        status: 'skipped',
        reason: 'checkpoint_conflict',
        mailboxId: mailbox.id,
        fromHistoryId: mailbox.lastHistoryId,
        toHistoryId: history.nextHistoryId,
        ingestedCount: ingestResult.ingestedCount,
        skippedMessageCount: ingestResult.skippedMessageCount
      };
    }

    return {
      status: 'synced',
      mailboxId: advancedMailbox.id,
      fromHistoryId: mailbox.lastHistoryId,
      toHistoryId: advancedMailbox.lastHistoryId ?? history.nextHistoryId,
      ingestedCount: ingestResult.ingestedCount,
      skippedMessageCount: ingestResult.skippedMessageCount
    };
  }

  /** Converts recoverable Gmail sync errors into local mailbox state changes. */
  private async listHistoryOrRecover(
    job: CrmGmailHistorySyncQueueJob,
    mailbox: CrmMailboxRecord
  ): Promise<RecoveredCrmGmailHistoryResult | null> {
    try {
      return await this.gmailHistoryGateway.listHistory({
        mailbox,
        startHistoryId: mailbox.lastHistoryId,
        targetHistoryId: job.historyId
      });
    } catch (error) {
      if (error instanceof CrmGmailHistoryExpiredError) {
        return {
          nextHistoryId: job.historyId,
          messages: [],
          historyExpired: true
        };
      }

      if (!(error instanceof CrmGmailAuthorizationExpiredError)) {
        throw error;
      }

      await this.store.markMailboxAuthorizationExpired({
        mailboxId: mailbox.id,
        organizationId: job.organizationId,
        ownerUserId: job.ownerUserId,
        reason: error.message,
        expiredAt: new Date()
      });

      return null;
    }
  }

  private async recordHistoryExpired(mailbox: CrmMailboxRecord, job: CrmGmailHistorySyncQueueJob) {
    const syncIssueMessage = 'Gmail History checkpoint 已过期，需要重新授权、手动同步或联系管理员处理';

    await Promise.all([
      this.store.updateMailbox(mailbox.id, {
        syncIssueType: 'history_expired',
        syncIssueAt: toSyncIssueDate(job.publishTime),
        syncIssueMessage
      }),
      this.systemLogService?.record({
        level: 'warn',
        status: 'failed',
        module: 'crm',
        action: 'gmail-history-expired',
        message: 'CRM Gmail History checkpoint 已过期',
        userId: mailbox.ownerUserId,
        userName: mailbox.ownerUserName ?? undefined,
        metadata: {
          organizationId: mailbox.organizationId,
          mailboxId: mailbox.id,
          provider: mailbox.provider,
          maskedEmail: mailbox.maskedEmail,
          fromHistoryId: mailbox.lastHistoryId,
          toHistoryId: job.historyId,
          pubsubMessageId: job.pubsubMessageId
        }
      }),
      this.systemNotificationService?.create({
        userId: mailbox.ownerUserId,
        userName: mailbox.ownerUserName,
        module: 'crm',
        type: 'crm_gmail_history_expired',
        title: 'Gmail 同步需要人工处理',
        content: `${mailbox.maskedEmail} 的 Gmail 增量同步 checkpoint 已过期，请重新授权、手动同步或联系管理员处理。`,
        targetType: 'crmMailbox',
        targetId: mailbox.id,
        routePath: '/crm/settings',
        metadata: {
          organizationId: mailbox.organizationId,
          mailboxId: mailbox.id,
          provider: mailbox.provider,
          maskedEmail: mailbox.maskedEmail,
          fromHistoryId: mailbox.lastHistoryId,
          toHistoryId: job.historyId,
          pubsubMessageId: job.pubsubMessageId
        }
      })
    ]);
  }

  private async ingestHistoryMessages(
    job: CrmGmailHistorySyncQueueJob,
    messages: Awaited<ReturnType<CrmGmailHistoryGateway['listHistory']>>['messages']
  ) {
    let ingestedCount = 0;
    let skippedMessageCount = 0;

    for (const message of messages) {
      const outboundMessage = await this.findOutboundMessageForHistoryMessage(job, message);

      if (!outboundMessage) {
        skippedMessageCount += 1;
        continue;
      }

      const ingested = await this.store.ingestCustomerReply({
        outboundMessageId: outboundMessage.id,
        organizationId: job.organizationId,
        ownerUserId: job.ownerUserId,
        subject: message.subject,
        bodyText: message.bodyText,
        receivedAt: message.receivedAt,
        providerThreadId: message.providerThreadId,
        providerMessageId: message.providerMessageId,
        messageType: message.messageType
      });

      if (ingested && !ingested.isDuplicate) {
        ingestedCount += 1;
      }
    }

    return { ingestedCount, skippedMessageCount };
  }

  private async findOutboundMessageForHistoryMessage(
    job: CrmGmailHistorySyncQueueJob,
    message: CrmGmailHistoryMessage
  ): Promise<CrmMessageRecord | null> {
    if (message.replyToProviderMessageId) {
      const replyToMessage = await this.store.findSentMessageByProviderId({
        organizationId: job.organizationId,
        ownerUserId: job.ownerUserId,
        mailboxId: job.mailboxId,
        providerMessageId: message.replyToProviderMessageId
      });

      if (replyToMessage) return replyToMessage;
    }

    if (!message.providerThreadId) {
      return null;
    }

    return this.store.findSentMessageByProviderThreadId({
      organizationId: job.organizationId,
      ownerUserId: job.ownerUserId,
      mailboxId: job.mailboxId,
      providerThreadId: message.providerThreadId
    });
  }
}

function isHistoryIdAtOrBefore(historyId: string, lastHistoryId: string | null) {
  if (!lastHistoryId) return false;

  return BigInt(historyId) <= BigInt(lastHistoryId);
}

function toSyncIssueDate(value?: string | null) {
  if (!value) return new Date();

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? new Date() : date;
}
