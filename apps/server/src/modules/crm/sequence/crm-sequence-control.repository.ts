import type {
  CrmBlacklistRecord,
  CrmFirstMessageRetryInput,
  CrmFirstMessageRetryRecord,
  CrmFirstMessageReturnToEditInput,
  CrmFirstMessageReturnToEditRecord,
  CrmSendStartInput,
  CrmSendStartRecord,
  CrmSequenceResumeInput,
  CrmSequenceResumeRecord,
  CrmSequenceReviewRecord,
  CrmSequenceStopInput,
  CrmSequenceStopRecord
} from '../crm.types';

export interface CrmSequenceControlRepository {
  getSequenceReviewItem(args: {
    id: string;
    organizationId: string;
    ownerUserId?: string;
  }): Promise<CrmSequenceReviewRecord | null>;
  findBlacklistEntry(args: { organizationId: string; emailHash: string }): Promise<CrmBlacklistRecord | null>;
  listMailboxSendScheduleTimes(args: { organizationId: string; mailboxId: string }): Promise<Date[]>;
  startFirstMessageSend(input: CrmSendStartInput): Promise<CrmSendStartRecord | null>;
  stopSequenceEnrollment(input: CrmSequenceStopInput): Promise<CrmSequenceStopRecord | null>;
  returnFirstMessageToEdit(input: CrmFirstMessageReturnToEditInput): Promise<CrmFirstMessageReturnToEditRecord | null>;
  resumeSequenceEnrollment(input: CrmSequenceResumeInput): Promise<CrmSequenceResumeRecord | null>;
  retryFirstMessageSend(input: CrmFirstMessageRetryInput): Promise<CrmFirstMessageRetryRecord | null>;
}
