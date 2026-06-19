import { Inject, Injectable } from '@nestjs/common';
import { CRM_GMAIL_HISTORY_GATEWAY, CRM_STORE } from './crm.tokens';
import type {
  CrmGmailHistoryGateway,
  CrmGmailHistorySyncQueueJob,
  CrmGmailHistorySyncResult,
  CrmStore
} from './crm.types';

@Injectable()
export class CrmGmailHistorySyncWorkerService {
  constructor(
    @Inject(CRM_STORE) private readonly store: CrmStore,
    @Inject(CRM_GMAIL_HISTORY_GATEWAY) private readonly gmailHistoryGateway: CrmGmailHistoryGateway
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

    const history = await this.gmailHistoryGateway.listHistory({
      mailbox,
      startHistoryId: mailbox.lastHistoryId,
      targetHistoryId: job.historyId
    });
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

  private async ingestHistoryMessages(
    job: CrmGmailHistorySyncQueueJob,
    messages: Awaited<ReturnType<CrmGmailHistoryGateway['listHistory']>>['messages']
  ) {
    let ingestedCount = 0;
    let skippedMessageCount = 0;

    for (const message of messages) {
      if (!message.replyToProviderMessageId) {
        skippedMessageCount += 1;
        continue;
      }

      const outboundMessage = await this.store.findSentMessageByProviderId({
        organizationId: job.organizationId,
        ownerUserId: job.ownerUserId,
        mailboxId: job.mailboxId,
        providerMessageId: message.replyToProviderMessageId
      });

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
}

function isHistoryIdAtOrBefore(historyId: string, lastHistoryId: string | null) {
  if (!lastHistoryId) return false;

  return BigInt(historyId) <= BigInt(lastHistoryId);
}
