import type {
  CrmDraftApprovalInput,
  CrmDraftApprovalRecord,
  CrmMessageRecord,
  CrmSequenceReviewRecord
} from '../crm.types';

export interface CrmDraftApprovalRepository {
  findMessageById(args: { id: string; organizationId: string; ownerUserId?: string }): Promise<CrmMessageRecord | null>;
  getSequenceReviewItem(args: {
    id: string;
    organizationId: string;
    ownerUserId?: string;
  }): Promise<CrmSequenceReviewRecord | null>;
  approveMessageDraft(input: CrmDraftApprovalInput): Promise<CrmDraftApprovalRecord | null>;
}
