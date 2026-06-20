import type {
  CrmMailboxAuthorizationExpiredInput,
  CrmMailboxAuthorizationExpiredRecord,
  CrmMailboxHistoryAdvanceInput,
  CrmMailboxProvider,
  CrmMailboxRecord,
  CrmMailboxUpdateInput,
  CrmMailboxWatchRenewalListInput
} from './crm.types';

/** Data port for Gmail watch renewal, webhook mailbox lookup and manual sync. */
export interface CrmGmailWatchRepository {
  findMailboxById(args: { id: string; organizationId: string; ownerUserId?: string }): Promise<CrmMailboxRecord | null>;
  findMailboxByProviderAndEmailHash(provider: CrmMailboxProvider, emailHash: string): Promise<CrmMailboxRecord | null>;
  updateMailbox(id: string, input: CrmMailboxUpdateInput): Promise<CrmMailboxRecord | null>;
  listMailboxesForWatchRenewal(input: CrmMailboxWatchRenewalListInput): Promise<CrmMailboxRecord[]>;
  markMailboxAuthorizationExpired(
    input: CrmMailboxAuthorizationExpiredInput
  ): Promise<CrmMailboxAuthorizationExpiredRecord | null>;
  advanceMailboxHistoryId(input: CrmMailboxHistoryAdvanceInput): Promise<CrmMailboxRecord | null>;
}
