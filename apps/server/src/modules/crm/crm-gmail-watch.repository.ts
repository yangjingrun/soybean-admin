import type { CrmStore } from './crm.types';

/** Data port for Gmail watch renewal, webhook mailbox lookup and manual sync. */
export type CrmGmailWatchRepository = Pick<
  CrmStore,
  | 'findMailboxById'
  | 'findMailboxByProviderAndEmailHash'
  | 'updateMailbox'
  | 'listMailboxesForWatchRenewal'
  | 'markMailboxAuthorizationExpired'
  | 'advanceMailboxHistoryId'
>;
