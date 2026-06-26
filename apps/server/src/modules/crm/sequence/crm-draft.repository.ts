import type {
  CrmMessageDraftUpdateGuard,
  CrmMessageDraftVersionCreateInput,
  CrmMessageDraftVersionRecord,
  CrmMessageDraftVersionRestoreInput,
  CrmMessageRecord,
  CrmMessageUpdateInput,
  CrmSequenceReviewRecord,
  CrmTimelineEventCreateInput,
  CrmTimelineEventRecord
} from '../crm.types';

export interface CrmDraftRepository {
  findMessageById(args: { id: string; organizationId: string; ownerUserId?: string }): Promise<CrmMessageRecord | null>;
  getSequenceReviewItem(args: {
    id: string;
    organizationId: string;
    ownerUserId?: string;
  }): Promise<CrmSequenceReviewRecord | null>;
  updateMessage(
    id: string,
    organizationId: string,
    input: CrmMessageUpdateInput,
    guard?: CrmMessageDraftUpdateGuard
  ): Promise<CrmMessageRecord | null>;
  createMessageDraftVersion(input: CrmMessageDraftVersionCreateInput): Promise<CrmMessageDraftVersionRecord>;
  listMessageDraftVersions(args: {
    messageId: string;
    organizationId: string;
    ownerUserId?: string;
  }): Promise<CrmMessageDraftVersionRecord[]>;
  restoreMessageDraftVersion(input: CrmMessageDraftVersionRestoreInput): Promise<CrmMessageRecord | null>;
  createTimelineEvent(input: CrmTimelineEventCreateInput): Promise<CrmTimelineEventRecord>;
}
