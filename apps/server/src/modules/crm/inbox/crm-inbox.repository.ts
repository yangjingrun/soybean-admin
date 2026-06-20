import type { CrmStore } from '../crm.types';

export type CrmInboxRepository = Pick<
  CrmStore,
  | 'ingestCustomerReply'
  | 'listInboxThreads'
  | 'getInboxThread'
  | 'updateInboxThreadStatus'
  | 'syncInboxThreadGmailState'
  | 'confirmInboxMessageUnsubscribe'
  | 'saveInboxThreadReplyDraft'
  | 'replyInboxThread'
>;
