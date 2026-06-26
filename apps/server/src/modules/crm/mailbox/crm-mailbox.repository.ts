import type {
  CrmMailboxAuthorizationExpiredInput,
  CrmMailboxAuthorizationExpiredRecord,
  CrmMailboxAuthorizationRevokeInput,
  CrmMailboxAuthorizationRevokeRecord,
  CrmMailboxCreateInput,
  CrmMailboxDeleteInput,
  CrmMailboxDeleteRecord,
  CrmMailboxHistoryAdvanceInput,
  CrmMailboxProvider,
  CrmMailboxRecord,
  CrmMailboxStatus,
  CrmMailboxUpdateInput,
  CrmMailboxWatchRenewalListInput
} from '../crm.types';

export interface CrmMailboxRepository {
  findMailboxByProviderAndEmailHash(provider: CrmMailboxProvider, emailHash: string): Promise<CrmMailboxRecord | null>;
  createMailbox(input: CrmMailboxCreateInput): Promise<CrmMailboxRecord>;
  listMailboxes(args: {
    organizationId: string;
    ownerUserId?: string;
    keyword?: string;
    status?: CrmMailboxStatus;
    skip: number;
    take: number;
  }): Promise<{ records: CrmMailboxRecord[]; total: number }>;
  findMailboxById(args: { id: string; organizationId: string; ownerUserId?: string }): Promise<CrmMailboxRecord | null>;
  updateMailbox(id: string, input: CrmMailboxUpdateInput): Promise<CrmMailboxRecord | null>;
  listMailboxesForWatchRenewal(input: CrmMailboxWatchRenewalListInput): Promise<CrmMailboxRecord[]>;
  markMailboxAuthorizationExpired(
    input: CrmMailboxAuthorizationExpiredInput
  ): Promise<CrmMailboxAuthorizationExpiredRecord | null>;
  revokeMailboxAuthorization(
    input: CrmMailboxAuthorizationRevokeInput
  ): Promise<CrmMailboxAuthorizationRevokeRecord | null>;
  deleteMailbox(input: CrmMailboxDeleteInput): Promise<CrmMailboxDeleteRecord | null>;
  advanceMailboxHistoryId(input: CrmMailboxHistoryAdvanceInput): Promise<CrmMailboxRecord | null>;
}
