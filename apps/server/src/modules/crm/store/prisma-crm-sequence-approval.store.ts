import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { CrmBatchDraftApprovalRepository } from '../sequence/crm-batch-draft-approval.repository';
import type { CrmDraftApprovalRepository } from '../sequence/crm-draft-approval.repository';
import type { CrmFollowUpApprovalRepository } from '../sequence/crm-follow-up-approval.repository';
import { PrismaCrmMessageDraftStore } from './prisma-crm-message-draft.store';
import { PrismaCrmSequenceReviewStore } from './prisma-crm-sequence-review.store';

@Injectable()
export class PrismaCrmSequenceApprovalStore
  implements CrmDraftApprovalRepository, CrmFollowUpApprovalRepository, CrmBatchDraftApprovalRepository
{
  private readonly messageDraftStore: PrismaCrmMessageDraftStore;
  private readonly reviewStore: PrismaCrmSequenceReviewStore;

  constructor(prisma: PrismaService) {
    this.messageDraftStore = new PrismaCrmMessageDraftStore(prisma);
    this.reviewStore = new PrismaCrmSequenceReviewStore(prisma);
  }

  findMessageById(
    ...args: Parameters<PrismaCrmMessageDraftStore['findMessageById']>
  ): ReturnType<PrismaCrmMessageDraftStore['findMessageById']> {
    return this.messageDraftStore.findMessageById(...args);
  }

  getSequenceReviewItem(
    ...args: Parameters<PrismaCrmSequenceReviewStore['getSequenceReviewItem']>
  ): ReturnType<PrismaCrmSequenceReviewStore['getSequenceReviewItem']> {
    return this.reviewStore.getSequenceReviewItem(...args);
  }

  listSequenceReviewItemsByIds(
    ...args: Parameters<PrismaCrmSequenceReviewStore['listSequenceReviewItemsByIds']>
  ): ReturnType<PrismaCrmSequenceReviewStore['listSequenceReviewItemsByIds']> {
    return this.reviewStore.listSequenceReviewItemsByIds(...args);
  }

  approveMessageDraft(
    ...args: Parameters<PrismaCrmMessageDraftStore['approveMessageDraft']>
  ): ReturnType<PrismaCrmMessageDraftStore['approveMessageDraft']> {
    return this.messageDraftStore.approveMessageDraft(...args);
  }
}
