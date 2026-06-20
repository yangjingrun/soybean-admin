import type { CrmStore } from '../crm.types';

export type CrmAiDraftTaskRepository = Pick<
  CrmStore,
  | 'createAiDraftTask'
  | 'findCurrentAiDraftTaskForUser'
  | 'findAiDraftTaskById'
  | 'listAiDraftTasks'
  | 'listAiDraftTaskItems'
  | 'updateAiDraftTask'
  | 'updateAiDraftTaskItem'
>;

export type CrmAiDraftTaskSourceRepository = Pick<
  CrmStore,
  'listSequenceReviewItemsByIds' | 'listBlacklistEntriesByEmailHashes'
>;
