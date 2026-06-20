import type { CrmStore } from '../crm.types';

export type CrmSequenceControlRepository = Pick<
  CrmStore,
  'getSequenceReviewItem' | 'findBlacklistEntry' | 'startFirstMessageSend' | 'stopSequenceEnrollment'
>;
