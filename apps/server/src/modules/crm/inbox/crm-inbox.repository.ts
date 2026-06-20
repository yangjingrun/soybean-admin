import type { CrmStore } from '../crm.types';

export type CrmInboxRepository = Pick<
  CrmStore,
  | 'getOrganizationConfig'
  | 'findProductLineById'
  | 'findMessageById'
  | 'ingestCustomerReply'
  | 'listInboxThreads'
  | 'getInboxThread'
  | 'updateInboxThreadStatus'
  | 'syncInboxThreadGmailState'
  | 'confirmInboxMessageUnsubscribe'
  | 'saveInboxThreadReplyDraft'
  | 'replyInboxThread'
>;
