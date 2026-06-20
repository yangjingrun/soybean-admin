import type { CrmStore } from '../crm.types';

export type CrmAccountRepository = Pick<
  CrmStore,
  | 'findAccountByDomain'
  | 'createAccount'
  | 'updateAccount'
  | 'listAccountsForArchiveSlimming'
  | 'slimArchivedAccount'
  | 'findContactByEmailHash'
  | 'createContact'
  | 'updateContact'
  | 'findContactById'
  | 'updateContactEmailStatus'
  | 'findEmailVerificationCache'
  | 'upsertEmailVerificationCache'
  | 'findArchivedFingerprints'
  | 'upsertArchivedFingerprint'
  | 'listAccounts'
  | 'getAccountDetail'
  | 'createTimelineEvent'
>;
