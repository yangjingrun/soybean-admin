import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { CrmAiDraftTaskSourceRepository } from '../ai-draft-task/crm-ai-draft-task.repository';
import { PrismaCrmSequenceReviewStore } from './prisma-crm-sequence-review.store';
import { PrismaCrmSuppressionStore } from './prisma-crm-suppression.store';

@Injectable()
export class PrismaCrmAiDraftTaskSourceStore implements CrmAiDraftTaskSourceRepository {
  private readonly sequenceReviewStore: PrismaCrmSequenceReviewStore;
  private readonly suppressionStore: PrismaCrmSuppressionStore;

  constructor(prisma: PrismaService) {
    this.sequenceReviewStore = new PrismaCrmSequenceReviewStore(prisma);
    this.suppressionStore = new PrismaCrmSuppressionStore(prisma);
  }

  listSequenceReviewItemsByIds(
    ...args: Parameters<PrismaCrmSequenceReviewStore['listSequenceReviewItemsByIds']>
  ): ReturnType<PrismaCrmSequenceReviewStore['listSequenceReviewItemsByIds']> {
    return this.sequenceReviewStore.listSequenceReviewItemsByIds(...args);
  }

  listBlacklistEntriesByEmailHashes(
    ...args: Parameters<PrismaCrmSuppressionStore['listBlacklistEntriesByEmailHashes']>
  ): ReturnType<PrismaCrmSuppressionStore['listBlacklistEntriesByEmailHashes']> {
    return this.suppressionStore.listBlacklistEntriesByEmailHashes(...args);
  }
}
