import type { CrmAccountRecord, CrmArchiveSlimInput, CrmArchiveSlimmingListInput } from './crm.types';

/** Data port for CRM archived account slimming. */
export interface CrmArchiveSlimmingRepository {
  listAccountsForArchiveSlimming(input: CrmArchiveSlimmingListInput): Promise<CrmAccountRecord[]>;
  slimArchivedAccount(input: CrmArchiveSlimInput): Promise<CrmAccountRecord | null>;
}
