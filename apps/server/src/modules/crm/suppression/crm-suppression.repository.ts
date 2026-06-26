import type {
  CrmBlacklistDeleteInput,
  CrmBlacklistListInput,
  CrmBlacklistRecord,
  CrmBlacklistUpsertInput
} from '../crm.types';

export interface CrmSuppressionRepository {
  findBlacklistEntry(args: { organizationId: string; emailHash: string }): Promise<CrmBlacklistRecord | null>;
  /** Batch loads organization blacklist entries by normalized email hashes. */
  listBlacklistEntriesByEmailHashes(args: {
    organizationId: string;
    emailHashes: string[];
  }): Promise<CrmBlacklistRecord[]>;
  upsertBlacklistEntry(input: CrmBlacklistUpsertInput): Promise<CrmBlacklistRecord>;
  listBlacklistEntries(input: CrmBlacklistListInput): Promise<{ records: CrmBlacklistRecord[]; total: number }>;
  deleteBlacklistEntry(input: CrmBlacklistDeleteInput): Promise<CrmBlacklistRecord | null>;
}
