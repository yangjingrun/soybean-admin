import type { CrmStore } from './crm.types';

export const CRM_ARCHIVE_SLIMMING_REPOSITORY = Symbol('CRM_ARCHIVE_SLIMMING_REPOSITORY');

/** Data port for CRM archived account slimming. */
export type CrmArchiveSlimmingRepository = Pick<
  CrmStore,
  'listAccountsForArchiveSlimming' | 'slimArchivedAccount'
>;
