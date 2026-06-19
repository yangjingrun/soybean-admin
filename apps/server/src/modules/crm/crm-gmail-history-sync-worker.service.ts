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
        toHistoryId: job.historyId
      };
    }

    if (isHistoryIdAtOrBefore(job.historyId, mailbox.lastHistoryId)) {
      return {
        status: 'skipped',
        reason: 'stale_history',
        mailboxId: mailbox.id,
        fromHistoryId: mailbox.lastHistoryId,
        toHistoryId: job.historyId
      };
    }

    const history = await this.gmailHistoryGateway.listHistory({
      mailbox,
      startHistoryId: mailbox.lastHistoryId,
      targetHistoryId: job.historyId
    });
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
        toHistoryId: history.nextHistoryId
      };
    }

    return {
      status: 'synced',
      mailboxId: advancedMailbox.id,
      fromHistoryId: mailbox.lastHistoryId,
      toHistoryId: advancedMailbox.lastHistoryId ?? history.nextHistoryId
    };
  }
}

function isHistoryIdAtOrBefore(historyId: string, lastHistoryId: string | null) {
  if (!lastHistoryId) return false;

  return BigInt(historyId) <= BigInt(lastHistoryId);
}
