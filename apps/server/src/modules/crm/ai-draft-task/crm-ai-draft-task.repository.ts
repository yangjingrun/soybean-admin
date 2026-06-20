import type { CrmStore } from '../crm.types';

export type CrmAiDraftTaskRepository = Pick<
  CrmStore,
  | 'listSequenceReviewItemsByIds'
  | 'listBlacklistEntriesByEmailHashes'
  | 'createAiDraftTask'
  | 'findCurrentAiDraftTaskForUser'
  | 'findAiDraftTaskById'
  | 'listAiDraftTasks'
  | 'listAiDraftTaskItems'
  | 'updateAiDraftTask'
  | 'updateAiDraftTaskItem'
  | 'getAiDraftQueueConfig'
  | 'saveAiDraftQueueConfig'
>;
