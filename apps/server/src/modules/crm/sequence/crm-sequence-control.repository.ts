import type {
  CrmBlacklistRecord,
  CrmSendStartInput,
  CrmSendStartRecord,
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
  startFirstMessageSend(input: CrmSendStartInput): Promise<CrmSendStartRecord | null>;
  stopSequenceEnrollment(input: CrmSequenceStopInput): Promise<CrmSequenceStopRecord | null>;
}
