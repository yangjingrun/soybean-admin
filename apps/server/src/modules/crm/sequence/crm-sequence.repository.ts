import type { CrmStore } from '../crm.types';

export type CrmSequenceRepository = Pick<
  CrmStore,
  | 'findActiveEnrollmentByContact'
  | 'findActiveEnrollmentByAccount'
  | 'createSequenceDraftBundle'
  | 'listSequenceReviewItems'
  | 'getSequenceReviewItem'
>;
