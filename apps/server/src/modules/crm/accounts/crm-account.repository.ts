import type {
  CrmAccountCreateInput,
  CrmAccountDetailRecord,
  CrmAccountListRecord,
  CrmAccountRecord,
  CrmAccountStatus,
  CrmAccountUpdateInput,
  CrmArchiveSlimInput,
  CrmArchiveSlimmingListInput,
  CrmArchivedFingerprintLookupInput,
  CrmArchivedFingerprintRecord,
  CrmArchivedFingerprintUpsertInput,
  CrmContactCreateInput,
  CrmContactRecord,
  CrmContactUpdateInput,
  CrmEmailStatus,
  CrmEmailVerificationCacheRecord,
  CrmEmailVerificationCacheUpsertInput,
  CrmLeadEnrichmentHistoryLookupInput,
  CrmLeadEnrichmentHistoryRecord,
  CrmLeadEnrichmentHistoryUpsertInput,
  CrmLeadImportPrecheckInput,
  CrmTimelineEventCreateInput,
  CrmTimelineEventRecord
} from '../crm.types';

export interface CrmAccountRepository {
  findAccountByDomain(organizationId: string, ownerUserId: string, domain: string): Promise<CrmAccountRecord | null>;
  findAccountsForLeadImportPrecheck(
    input: CrmLeadImportPrecheckInput & { organizationId: string; ownerUserId: string }
  ): Promise<CrmAccountRecord[]>;
  createAccount(input: CrmAccountCreateInput): Promise<CrmAccountRecord>;
  updateAccount(id: string, input: CrmAccountUpdateInput): Promise<CrmAccountRecord | null>;
  listAccountsForArchiveSlimming(input: CrmArchiveSlimmingListInput): Promise<CrmAccountRecord[]>;
  slimArchivedAccount(input: CrmArchiveSlimInput): Promise<CrmAccountRecord | null>;
  findContactByEmailHash(
    organizationId: string,
    ownerUserId: string,
    emailHash: string
  ): Promise<CrmContactRecord | null>;
  createContact(input: CrmContactCreateInput): Promise<CrmContactRecord>;
  updateContact(id: string, input: CrmContactUpdateInput): Promise<CrmContactRecord | null>;
  deleteContact(id: string): Promise<CrmContactRecord | null>;
  findContactById(args: { id: string; organizationId: string; ownerUserId?: string }): Promise<CrmContactRecord | null>;
  updateContactEmailStatus(id: string, emailStatus: CrmEmailStatus): Promise<CrmContactRecord | null>;
  findEmailVerificationCache(args: { emailHash: string }): Promise<CrmEmailVerificationCacheRecord | null>;
  upsertEmailVerificationCache(input: CrmEmailVerificationCacheUpsertInput): Promise<CrmEmailVerificationCacheRecord>;
  findArchivedFingerprints(input: CrmArchivedFingerprintLookupInput): Promise<CrmArchivedFingerprintRecord[]>;
  upsertArchivedFingerprint(input: CrmArchivedFingerprintUpsertInput): Promise<CrmArchivedFingerprintRecord>;
  findLeadEnrichmentHistories(input: CrmLeadEnrichmentHistoryLookupInput): Promise<CrmLeadEnrichmentHistoryRecord[]>;
  upsertLeadEnrichmentHistory(input: CrmLeadEnrichmentHistoryUpsertInput): Promise<CrmLeadEnrichmentHistoryRecord>;
  listAccounts(args: {
    organizationId: string;
    ownerUserId?: string;
    keyword?: string;
    contactTitle?: string;
    customerType?: string;
    region?: string;
    regionKeywords?: string[];
    status?: CrmAccountStatus;
    sourceTaskId?: string;
    updatedFrom?: Date;
    updatedTo?: Date;
    skip: number;
    take: number;
  }): Promise<{ records: CrmAccountListRecord[]; total: number }>;
  getAccountDetail(args: {
    id: string;
    organizationId: string;
    ownerUserId?: string;
  }): Promise<CrmAccountDetailRecord | null>;
  createTimelineEvent(input: CrmTimelineEventCreateInput): Promise<CrmTimelineEventRecord>;
}
