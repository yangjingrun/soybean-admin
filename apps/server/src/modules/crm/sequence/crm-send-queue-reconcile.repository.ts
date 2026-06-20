import type { CrmStore } from '../crm.types';

export type CrmSendQueueReconcileRepository = Pick<
  CrmStore,
  'listStaleQueuedMessages' | 'updateMessage' | 'createTimelineEvent'
>;
