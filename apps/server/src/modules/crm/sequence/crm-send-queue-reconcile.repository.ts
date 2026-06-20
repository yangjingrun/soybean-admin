import type {
  CrmMessageDraftUpdateGuard,
  CrmMessageRecord,
  CrmMessageUpdateInput,
  CrmTimelineEventCreateInput,
  CrmTimelineEventRecord
} from '../crm.types';

export interface CrmSendQueueReconcileRepository {
  listStaleQueuedMessages(input: { before: Date; take: number }): Promise<CrmMessageRecord[]>;
  updateMessage(
    id: string,
    organizationId: string,
    input: CrmMessageUpdateInput,
    guard?: CrmMessageDraftUpdateGuard
  ): Promise<CrmMessageRecord | null>;
  createTimelineEvent(input: CrmTimelineEventCreateInput): Promise<CrmTimelineEventRecord>;
}
