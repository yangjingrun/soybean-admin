import { Inject, Injectable } from '@nestjs/common';
import { parseGmailPubSubPushPayload } from './crm-gmail-pubsub';
import { CRM_GMAIL_HISTORY_SYNC_QUEUE, CRM_GMAIL_WATCH_REPOSITORY } from './crm.tokens';
import type { CrmGmailWatchRepository } from './crm-gmail-watch.repository';
import type { CrmGmailHistorySyncQueuePort, CrmGmailPubSubPushResult } from './crm.types';

@Injectable()
export class CrmGmailWebhookService {
  constructor(
    @Inject(CRM_GMAIL_WATCH_REPOSITORY) private readonly store: CrmGmailWatchRepository,
    @Inject(CRM_GMAIL_HISTORY_SYNC_QUEUE) private readonly historySyncQueue: CrmGmailHistorySyncQueuePort
  ) {}

  /** Handles one Gmail Pub/Sub push by resolving the mailbox and enqueueing incremental History sync. */
  async handlePubSubPush(payload: unknown): Promise<CrmGmailPubSubPushResult> {
    const parsed = parseGmailPubSubPushPayload(payload);
    const mailbox = await this.store.findMailboxByProviderAndEmailHash('gmail', parsed.emailHash);

    if (!mailbox) {
      return {
        queued: false,
        reason: 'mailbox_not_found',
        historyId: parsed.historyId,
        pubsubMessageId: parsed.pubsubMessageId
      };
    }

    if (mailbox.status !== 'active') {
      return {
        queued: false,
        reason: 'mailbox_not_active',
        mailboxId: mailbox.id,
        historyId: parsed.historyId,
        pubsubMessageId: parsed.pubsubMessageId
      };
    }

    const { jobId } = await this.historySyncQueue.enqueueHistorySync({
      mailboxId: mailbox.id,
      organizationId: mailbox.organizationId,
      ownerUserId: mailbox.ownerUserId,
      emailAddress: parsed.emailAddress,
      emailHash: parsed.emailHash,
      historyId: parsed.historyId,
      pubsubMessageId: parsed.pubsubMessageId,
      publishTime: parsed.publishTime?.toISOString() ?? null
    });

    return {
      queued: true,
      mailboxId: mailbox.id,
      historyId: parsed.historyId,
      pubsubMessageId: parsed.pubsubMessageId,
      jobId
    };
  }
}
