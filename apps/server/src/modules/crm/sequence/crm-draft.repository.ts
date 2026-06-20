import type { CrmStore } from '../crm.types';

export type CrmDraftRepository = Pick<
  CrmStore,
  | 'findMessageById'
  | 'getSequenceReviewItem'
  | 'updateMessage'
  | 'createMessageDraftVersion'
  | 'listMessageDraftVersions'
  | 'restoreMessageDraftVersion'
  | 'createTimelineEvent'
>;
