import type { CrmStore } from '../crm.types';

export type CrmSuppressionRepository = Pick<
  CrmStore,
  | 'findBlacklistEntry'
  | 'listBlacklistEntriesByEmailHashes'
  | 'upsertBlacklistEntry'
  | 'listBlacklistEntries'
  | 'deleteBlacklistEntry'
>;
