import type { CrmStore } from '../crm.types';

export type CrmBatchSequenceStopRepository = Pick<
  CrmStore,
  | 'getSequenceReviewItem'
  | 'stopSequenceEnrollment'
>;
