import { crmSequenceEnrollmentStatuses, type CrmSequenceEnrollmentStatus } from '../crm.types';

export const activeSequenceBlockingStatuses: CrmSequenceEnrollmentStatus[] = [
  'draft_review_pending',
  'ready_to_send',
  'sequence_running',
  'paused'
];

export const stoppableSequenceStatuses = activeSequenceBlockingStatuses;

/** Any existing enrollment means the first development email has already been generated for this contact. */
export const firstDraftCreationBlockingStatuses: CrmSequenceEnrollmentStatus[] = [...crmSequenceEnrollmentStatuses];
