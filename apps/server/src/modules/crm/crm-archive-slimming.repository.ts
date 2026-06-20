import type { CrmStore } from './crm.types';

/** Data port for CRM archived account slimming. */
export type CrmArchiveSlimmingRepository = Pick<
  CrmStore,
  'listAccountsForArchiveSlimming' | 'slimArchivedAccount'
>;
