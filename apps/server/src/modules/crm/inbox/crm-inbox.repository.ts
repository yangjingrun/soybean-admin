import type {
  CrmCustomerReplyIngestInput,
  CrmCustomerReplyIngestRecord,
  CrmInboxReplyDraftSaveInput,
  CrmInboxThreadDetailRecord,
  CrmInboxThreadGmailStateSyncInput,
  CrmInboxThreadListRecord,
  CrmInboxThreadReplyInput,
  CrmInboxThreadReplyRecord,
  CrmInboxThreadStatus,
  CrmInboxThreadStatusUpdateInput,
  CrmInboxThreadStatusUpdateRecord,
  CrmInboxUnsubscribeConfirmInput,
  CrmInboxUnsubscribeConfirmRecord
} from '../crm.types';

/** Narrow persistence contract for CRM inbox workflows only. */
export interface CrmInboxRepository {
  ingestCustomerReply(input: CrmCustomerReplyIngestInput): Promise<CrmCustomerReplyIngestRecord | null>;
  listInboxThreads(args: {
    organizationId: string;
    ownerUserId?: string;
    keyword?: string;
    status?: CrmInboxThreadStatus;
    mailboxId?: string;
    accountId?: string;
    contactId?: string;
    skip: number;
    take: number;
  }): Promise<{ records: CrmInboxThreadListRecord[]; total: number }>;
  getInboxThread(args: {
    id: string;
    organizationId: string;
    ownerUserId?: string;
  }): Promise<CrmInboxThreadDetailRecord | null>;
  updateInboxThreadStatus(input: CrmInboxThreadStatusUpdateInput): Promise<CrmInboxThreadStatusUpdateRecord | null>;
  syncInboxThreadGmailState(input: CrmInboxThreadGmailStateSyncInput): Promise<CrmInboxThreadStatusUpdateRecord | null>;
  confirmInboxMessageUnsubscribe(
    input: CrmInboxUnsubscribeConfirmInput
  ): Promise<CrmInboxUnsubscribeConfirmRecord | null>;
  saveInboxThreadReplyDraft(input: CrmInboxReplyDraftSaveInput): Promise<CrmInboxThreadDetailRecord | null>;
  replyInboxThread(input: CrmInboxThreadReplyInput): Promise<CrmInboxThreadReplyRecord | null>;
}
