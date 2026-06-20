import type { CrmStore } from '../crm.types';

export type CrmFollowUpApprovalRepository = Pick<
  CrmStore,
  | 'findMessageById'
  | 'getSequenceReviewItem'
  | 'approveMessageDraft'
>;
