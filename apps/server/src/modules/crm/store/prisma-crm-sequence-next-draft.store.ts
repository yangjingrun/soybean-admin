import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { CrmNextDraftRepository } from '../sequence/crm-next-draft.repository';
import { PrismaCrmSequenceReviewStore } from './prisma-crm-sequence-review.store';
import { PrismaCrmSettingsStore } from './prisma-crm-settings.store';

@Injectable()
export class PrismaCrmSequenceNextDraftStore implements CrmNextDraftRepository {
  private readonly reviewStore: PrismaCrmSequenceReviewStore;
  private readonly settingsStore: PrismaCrmSettingsStore;

  constructor(prisma: PrismaService) {
    this.reviewStore = new PrismaCrmSequenceReviewStore(prisma);
    this.settingsStore = new PrismaCrmSettingsStore(prisma);
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

  createFollowUpDraftBundle(
    ...args: Parameters<PrismaCrmSequenceReviewStore['createFollowUpDraftBundle']>
  ): ReturnType<PrismaCrmSequenceReviewStore['createFollowUpDraftBundle']> {
    return this.reviewStore.createFollowUpDraftBundle(...args);
  }

  getGlobalConfig(
    ...args: Parameters<PrismaCrmSettingsStore['getGlobalConfig']>
  ): ReturnType<PrismaCrmSettingsStore['getGlobalConfig']> {
    return this.settingsStore.getGlobalConfig(...args);
  }

  findDefaultEmailTemplateGroup(
    ...args: Parameters<PrismaCrmSettingsStore['findDefaultEmailTemplateGroup']>
  ): ReturnType<PrismaCrmSettingsStore['findDefaultEmailTemplateGroup']> {
    return this.settingsStore.findDefaultEmailTemplateGroup(...args);
  }

  listActivePersonaProfiles(
    ...args: Parameters<PrismaCrmSettingsStore['listActivePersonaProfiles']>
  ): ReturnType<PrismaCrmSettingsStore['listActivePersonaProfiles']> {
    return this.settingsStore.listActivePersonaProfiles(...args);
  }
}
