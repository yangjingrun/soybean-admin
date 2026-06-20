import type { CrmStore } from '../crm.types';

export type CrmBatchDraftApprovalRepository = Pick<
  CrmStore,
  | 'listSequenceReviewItemsByIds'
  | 'approveMessageDraft'
>;
