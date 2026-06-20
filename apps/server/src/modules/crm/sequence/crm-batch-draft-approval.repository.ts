import type { CrmDraftApprovalInput, CrmDraftApprovalRecord, CrmSequenceReviewRecord } from '../crm.types';

export interface CrmBatchDraftApprovalRepository {
  listSequenceReviewItemsByIds(args: {
    ids: string[];
    organizationId: string;
    ownerUserId?: string;
  }): Promise<CrmSequenceReviewRecord[]>;
  approveMessageDraft(input: CrmDraftApprovalInput): Promise<CrmDraftApprovalRecord | null>;
}
