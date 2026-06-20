import type { CrmStore } from './crm.types';

export const CRM_AI_DRAFT_WORKER_REPOSITORY = Symbol('CRM_AI_DRAFT_WORKER_REPOSITORY');

/** Data port for CRM AI draft task workers and worker host queue config. */
export type CrmAiDraftWorkerRepository = Pick<
  CrmStore,
  | 'getAiDraftQueueConfig'
  | 'findAiDraftTaskById'
  | 'listAiDraftTaskItems'
  | 'updateAiDraftTask'
  | 'updateAiDraftTaskItem'
  | 'getSequenceReviewItem'
  | 'createFollowUpDraftBundle'
  | 'listBlacklistEntriesByEmailHashes'
  | 'getGlobalConfig'
  | 'findDefaultEmailTemplateGroup'
  | 'listActivePersonaProfiles'
>;
