import type { CrmStore } from './crm.types';

/** Data port used by the Gmail History sync worker across mailbox, inbox, draft and timeline data. */
export type CrmGmailHistorySyncRepository = Pick<
  CrmStore,
  | 'findMailboxById'
  | 'advanceMailboxHistoryId'
  | 'markMailboxAuthorizationExpired'
  | 'updateMailbox'
  | 'ingestCustomerReply'
  | 'syncInboxThreadGmailState'
  | 'findSentMessageByProviderId'
  | 'findSentMessageByProviderThreadId'
  | 'createTimelineEvent'
>;
