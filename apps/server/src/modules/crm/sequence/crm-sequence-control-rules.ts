import type { CrmSequenceEnrollmentStatus } from '../crm.types';

export const activeSequenceBlockingStatuses: CrmSequenceEnrollmentStatus[] = [
  'draft_review_pending',
  'ready_to_send',
  'sequence_running',
  'paused'
];

export const stoppableSequenceStatuses = activeSequenceBlockingStatuses;
