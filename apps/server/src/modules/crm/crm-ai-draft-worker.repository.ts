import type { CrmStore } from './crm.types';

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
