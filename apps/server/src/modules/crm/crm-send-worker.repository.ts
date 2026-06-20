import type { CrmStore } from './crm.types';

/** Data port for guarded CRM email delivery and completion. */
export type CrmSendWorkerRepository = Pick<
  CrmStore,
  | 'claimFirstMessageSendDelivery'
  | 'completeFirstMessageSend'
  | 'failFirstMessageSend'
  | 'markMailboxAuthorizationExpired'
  | 'getGlobalConfig'
  | 'findDefaultEmailTemplateGroup'
>;
