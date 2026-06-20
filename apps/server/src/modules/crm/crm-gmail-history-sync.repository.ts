import type {
  CrmCustomerReplyIngestInput,
  CrmCustomerReplyIngestRecord,
  CrmInboxThreadGmailStateSyncInput,
  CrmInboxThreadStatusUpdateRecord,
  CrmMailboxAuthorizationExpiredInput,
  CrmMailboxAuthorizationExpiredRecord,
  CrmMailboxHistoryAdvanceInput,
  CrmMailboxRecord,
  CrmMailboxUpdateInput,
  CrmMessageRecord,
  CrmTimelineEventCreateInput,
  CrmTimelineEventRecord
} from './crm.types';

/** Data port used by the Gmail History sync worker across mailbox, inbox, draft and timeline data. */
export interface CrmGmailHistorySyncRepository {
  findMailboxById(args: { id: string; organizationId: string; ownerUserId?: string }): Promise<CrmMailboxRecord | null>;
  advanceMailboxHistoryId(input: CrmMailboxHistoryAdvanceInput): Promise<CrmMailboxRecord | null>;
  markMailboxAuthorizationExpired(
    input: CrmMailboxAuthorizationExpiredInput
  ): Promise<CrmMailboxAuthorizationExpiredRecord | null>;
  updateMailbox(id: string, input: CrmMailboxUpdateInput): Promise<CrmMailboxRecord | null>;
  ingestCustomerReply(input: CrmCustomerReplyIngestInput): Promise<CrmCustomerReplyIngestRecord | null>;
  syncInboxThreadGmailState(input: CrmInboxThreadGmailStateSyncInput): Promise<CrmInboxThreadStatusUpdateRecord | null>;
  findSentMessageByProviderId(args: {
    organizationId: string;
    ownerUserId: string;
    mailboxId: string | null;
    providerMessageId: string;
  }): Promise<CrmMessageRecord | null>;
  findSentMessageByProviderThreadId(args: {
    organizationId: string;
    ownerUserId: string;
    mailboxId: string | null;
    providerThreadId: string;
  }): Promise<CrmMessageRecord | null>;
  createTimelineEvent(input: CrmTimelineEventCreateInput): Promise<CrmTimelineEventRecord>;
}
