import type { CrmSequenceReviewRecord, CrmSequenceStopInput, CrmSequenceStopRecord } from '../crm.types';

export interface CrmBatchSequenceStopRepository {
  getSequenceReviewItem(args: {
    id: string;
    organizationId: string;
    ownerUserId?: string;
  }): Promise<CrmSequenceReviewRecord | null>;
  stopSequenceEnrollment(input: CrmSequenceStopInput): Promise<CrmSequenceStopRecord | null>;
}
