import type {
  CrmDueSendCandidateListInput,
  CrmDueSendCandidateRecord,
  CrmGlobalConfigRecord,
  CrmMailboxSendStateBatchInput,
  CrmMailboxSendStateRecord,
  CrmMessageDraftUpdateGuard,
  CrmMessageRecord,
  CrmMessageUpdateInput,
  CrmOwnerSendStateBatchInput,
  CrmOwnerSendStateRecord
} from './crm.types';

/** Data port for selecting and reserving due CRM send jobs. */
export interface CrmSendSchedulerRepository {
  getGlobalConfig(): Promise<CrmGlobalConfigRecord>;
  listDueSendCandidates(input: CrmDueSendCandidateListInput): Promise<CrmDueSendCandidateRecord[]>;
  listOwnerSendStates(input: CrmOwnerSendStateBatchInput): Promise<CrmOwnerSendStateRecord[]>;
  listMailboxSendStates(input: CrmMailboxSendStateBatchInput): Promise<CrmMailboxSendStateRecord[]>;
  updateMessage(
    id: string,
    organizationId: string,
    input: CrmMessageUpdateInput,
    guard?: CrmMessageDraftUpdateGuard
  ): Promise<CrmMessageRecord | null>;
}
