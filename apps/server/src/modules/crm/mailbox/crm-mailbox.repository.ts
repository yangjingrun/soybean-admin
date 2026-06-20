import type { CrmStore } from '../crm.types';

export type CrmMailboxRepository = Pick<
  CrmStore,
  | 'findMailboxByProviderAndEmailHash'
  | 'createMailbox'
  | 'listMailboxes'
  | 'findMailboxById'
  | 'updateMailbox'
  | 'listMailboxesForWatchRenewal'
  | 'markMailboxAuthorizationExpired'
  | 'advanceMailboxHistoryId'
>;
