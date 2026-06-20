import type { CrmStore } from '../crm.types';

export type CrmNextDraftRepository = Pick<
  CrmStore,
  | 'getSequenceReviewItem'
  | 'listSequenceReviewItemsByIds'
  | 'getGlobalConfig'
  | 'findDefaultEmailTemplateGroup'
  | 'listActivePersonaProfiles'
  | 'createFollowUpDraftBundle'
>;
