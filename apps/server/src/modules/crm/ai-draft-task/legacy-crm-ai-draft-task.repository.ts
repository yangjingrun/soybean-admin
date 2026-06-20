import { Inject, Injectable } from '@nestjs/common';
import { CRM_STORE } from '../crm.tokens';
import type { CrmStore } from '../crm.types';
import type { CrmAiDraftTaskRepository } from './crm-ai-draft-task.repository';

@Injectable()
export class LegacyCrmAiDraftTaskRepository implements CrmAiDraftTaskRepository {
  constructor(@Inject(CRM_STORE) private readonly store: CrmStore) {}

  listSequenceReviewItemsByIds(
    ...args: Parameters<CrmStore['listSequenceReviewItemsByIds']>
  ): ReturnType<CrmStore['listSequenceReviewItemsByIds']> {
    return this.store.listSequenceReviewItemsByIds(...args);
  }

  listBlacklistEntriesByEmailHashes(
    ...args: Parameters<CrmStore['listBlacklistEntriesByEmailHashes']>
  ): ReturnType<CrmStore['listBlacklistEntriesByEmailHashes']> {
    return this.store.listBlacklistEntriesByEmailHashes(...args);
  }

  createAiDraftTask(...args: Parameters<CrmStore['createAiDraftTask']>): ReturnType<CrmStore['createAiDraftTask']> {
    return this.store.createAiDraftTask(...args);
  }

  findCurrentAiDraftTaskForUser(
    ...args: Parameters<CrmStore['findCurrentAiDraftTaskForUser']>
  ): ReturnType<CrmStore['findCurrentAiDraftTaskForUser']> {
    return this.store.findCurrentAiDraftTaskForUser(...args);
  }

  findAiDraftTaskById(
    ...args: Parameters<CrmStore['findAiDraftTaskById']>
  ): ReturnType<CrmStore['findAiDraftTaskById']> {
    return this.store.findAiDraftTaskById(...args);
  }

  listAiDraftTasks(...args: Parameters<CrmStore['listAiDraftTasks']>): ReturnType<CrmStore['listAiDraftTasks']> {
    return this.store.listAiDraftTasks(...args);
  }

  listAiDraftTaskItems(
    ...args: Parameters<CrmStore['listAiDraftTaskItems']>
  ): ReturnType<CrmStore['listAiDraftTaskItems']> {
    return this.store.listAiDraftTaskItems(...args);
  }

  updateAiDraftTask(...args: Parameters<CrmStore['updateAiDraftTask']>): ReturnType<CrmStore['updateAiDraftTask']> {
    return this.store.updateAiDraftTask(...args);
  }

  updateAiDraftTaskItem(
    ...args: Parameters<CrmStore['updateAiDraftTaskItem']>
  ): ReturnType<CrmStore['updateAiDraftTaskItem']> {
    return this.store.updateAiDraftTaskItem(...args);
  }

  getAiDraftQueueConfig(
    ...args: Parameters<CrmStore['getAiDraftQueueConfig']>
  ): ReturnType<CrmStore['getAiDraftQueueConfig']> {
    return this.store.getAiDraftQueueConfig(...args);
  }

  saveAiDraftQueueConfig(
    ...args: Parameters<CrmStore['saveAiDraftQueueConfig']>
  ): ReturnType<CrmStore['saveAiDraftQueueConfig']> {
    return this.store.saveAiDraftQueueConfig(...args);
  }
}
