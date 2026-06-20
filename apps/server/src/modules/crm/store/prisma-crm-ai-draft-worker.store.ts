import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { CrmAiDraftWorkerRepository } from '../crm-ai-draft-worker.repository';
import { PrismaCrmAiDraftTaskStore } from './prisma-crm-ai-draft-task.store';
import { PrismaCrmSequenceReviewStore } from './prisma-crm-sequence-review.store';
import { PrismaCrmSequenceStore } from './prisma-crm-sequence.store';
import { PrismaCrmSettingsStore } from './prisma-crm-settings.store';
import { PrismaCrmSuppressionStore } from './prisma-crm-suppression.store';

@Injectable()
export class PrismaCrmAiDraftWorkerStore implements CrmAiDraftWorkerRepository {
  private readonly aiDraftTaskStore: PrismaCrmAiDraftTaskStore;
  private readonly settingsStore: PrismaCrmSettingsStore;
  private readonly sequenceReviewStore: PrismaCrmSequenceReviewStore;
  private readonly sequenceStore: PrismaCrmSequenceStore;
  private readonly suppressionStore: PrismaCrmSuppressionStore;

  constructor(prisma: PrismaService) {
    this.aiDraftTaskStore = new PrismaCrmAiDraftTaskStore(prisma);
    this.settingsStore = new PrismaCrmSettingsStore(prisma);
    this.sequenceReviewStore = new PrismaCrmSequenceReviewStore(prisma);
    this.sequenceStore = new PrismaCrmSequenceStore(prisma);
    this.suppressionStore = new PrismaCrmSuppressionStore(prisma);
  }

  createAiDraftTask(
    ...args: Parameters<PrismaCrmAiDraftTaskStore['createAiDraftTask']>
  ): ReturnType<PrismaCrmAiDraftTaskStore['createAiDraftTask']> {
    return this.aiDraftTaskStore.createAiDraftTask(...args);
  }

  getAiDraftQueueConfig(
    ...args: Parameters<PrismaCrmSettingsStore['getAiDraftQueueConfig']>
  ): ReturnType<PrismaCrmSettingsStore['getAiDraftQueueConfig']> {
    return this.settingsStore.getAiDraftQueueConfig(...args);
  }

  findAiDraftTaskById(
    ...args: Parameters<PrismaCrmAiDraftTaskStore['findAiDraftTaskById']>
  ): ReturnType<PrismaCrmAiDraftTaskStore['findAiDraftTaskById']> {
    return this.aiDraftTaskStore.findAiDraftTaskById(...args);
  }

  listAiDraftTaskItems(
    ...args: Parameters<PrismaCrmAiDraftTaskStore['listAiDraftTaskItems']>
  ): ReturnType<PrismaCrmAiDraftTaskStore['listAiDraftTaskItems']> {
    return this.aiDraftTaskStore.listAiDraftTaskItems(...args);
  }

  updateAiDraftTask(
    ...args: Parameters<PrismaCrmAiDraftTaskStore['updateAiDraftTask']>
  ): ReturnType<PrismaCrmAiDraftTaskStore['updateAiDraftTask']> {
    return this.aiDraftTaskStore.updateAiDraftTask(...args);
  }

  updateAiDraftTaskItem(
    ...args: Parameters<PrismaCrmAiDraftTaskStore['updateAiDraftTaskItem']>
  ): ReturnType<PrismaCrmAiDraftTaskStore['updateAiDraftTaskItem']> {
    return this.aiDraftTaskStore.updateAiDraftTaskItem(...args);
  }

  getSequenceReviewItem(
    ...args: Parameters<PrismaCrmSequenceReviewStore['getSequenceReviewItem']>
  ): ReturnType<PrismaCrmSequenceReviewStore['getSequenceReviewItem']> {
    return this.sequenceReviewStore.getSequenceReviewItem(...args);
  }

  listSequenceReviewItemsByIds(
    ...args: Parameters<PrismaCrmSequenceReviewStore['listSequenceReviewItemsByIds']>
  ): ReturnType<PrismaCrmSequenceReviewStore['listSequenceReviewItemsByIds']> {
    return this.sequenceReviewStore.listSequenceReviewItemsByIds(...args);
  }

  createFollowUpDraftBundle(
    ...args: Parameters<PrismaCrmSequenceStore['createFollowUpDraftBundle']>
  ): ReturnType<PrismaCrmSequenceStore['createFollowUpDraftBundle']> {
    return this.sequenceStore.createFollowUpDraftBundle(...args);
  }

  listBlacklistEntriesByEmailHashes(
    ...args: Parameters<PrismaCrmSuppressionStore['listBlacklistEntriesByEmailHashes']>
  ): ReturnType<PrismaCrmSuppressionStore['listBlacklistEntriesByEmailHashes']> {
    return this.suppressionStore.listBlacklistEntriesByEmailHashes(...args);
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
