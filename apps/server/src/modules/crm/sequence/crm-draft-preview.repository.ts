import type { CrmStore } from '../crm.types';

export type CrmDraftPreviewAccountRepository = Pick<CrmStore, 'getAccountDetail'>;

export type CrmDraftPreviewSettingsRepository = Pick<
  CrmStore,
  'findProductLineById' | 'findDefaultEmailTemplateGroup' | 'listActivePersonaProfiles'
>;

export type CrmDraftPreviewSequenceRepository = Pick<CrmStore, 'getSequenceReviewItem'>;
