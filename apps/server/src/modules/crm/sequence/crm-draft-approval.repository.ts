import type { CrmStore } from '../crm.types';

export type CrmDraftApprovalRepository = Pick<
  CrmStore,
  | 'findMessageById'
  | 'getSequenceReviewItem'
  | 'approveMessageDraft'
>;
