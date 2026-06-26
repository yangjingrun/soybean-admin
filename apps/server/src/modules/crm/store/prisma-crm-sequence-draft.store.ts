import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { CrmDraftRepository } from '../sequence/crm-draft.repository';
import { PrismaCrmAccountStore } from './prisma-crm-account.store';
import { PrismaCrmMessageDraftStore } from './prisma-crm-message-draft.store';
import { PrismaCrmSequenceReviewStore } from './prisma-crm-sequence-review.store';

@Injectable()
export class PrismaCrmSequenceDraftStore implements CrmDraftRepository {
  private readonly accountStore: PrismaCrmAccountStore;
  private readonly messageDraftStore: PrismaCrmMessageDraftStore;
  private readonly reviewStore: PrismaCrmSequenceReviewStore;

  constructor(@Inject(PrismaService) prisma: PrismaService) {
    this.accountStore = new PrismaCrmAccountStore(prisma);
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

  updateMessage(
    ...args: Parameters<PrismaCrmMessageDraftStore['updateMessage']>
  ): ReturnType<PrismaCrmMessageDraftStore['updateMessage']> {
    return this.messageDraftStore.updateMessage(...args);
  }

  createMessageDraftVersion(
    ...args: Parameters<PrismaCrmMessageDraftStore['createMessageDraftVersion']>
  ): ReturnType<PrismaCrmMessageDraftStore['createMessageDraftVersion']> {
    return this.messageDraftStore.createMessageDraftVersion(...args);
  }

  listMessageDraftVersions(
    ...args: Parameters<PrismaCrmMessageDraftStore['listMessageDraftVersions']>
  ): ReturnType<PrismaCrmMessageDraftStore['listMessageDraftVersions']> {
    return this.messageDraftStore.listMessageDraftVersions(...args);
  }

  restoreMessageDraftVersion(
    ...args: Parameters<PrismaCrmMessageDraftStore['restoreMessageDraftVersion']>
  ): ReturnType<PrismaCrmMessageDraftStore['restoreMessageDraftVersion']> {
    return this.messageDraftStore.restoreMessageDraftVersion(...args);
  }

  createTimelineEvent(
    ...args: Parameters<PrismaCrmAccountStore['createTimelineEvent']>
  ): ReturnType<PrismaCrmAccountStore['createTimelineEvent']> {
    return this.accountStore.createTimelineEvent(...args);
  }
}
