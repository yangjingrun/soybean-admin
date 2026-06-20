import type { CrmStore } from './crm.types';

/** Data port for selecting and reserving due CRM send jobs. */
export type CrmSendSchedulerRepository = Pick<
  CrmStore,
  'getGlobalConfig' | 'listDueSendCandidates' | 'listOwnerSendStates' | 'listMailboxSendStates' | 'updateMessage'
>;
