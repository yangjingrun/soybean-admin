import type { CrmStore } from '../crm.types';

export const CRM_EMAIL_TEMPLATE_GROUP_REPOSITORY = Symbol('CRM_EMAIL_TEMPLATE_GROUP_REPOSITORY');

export type CrmEmailTemplateGroupRepository = Pick<
  CrmStore,
  | 'listEmailTemplateGroups'
  | 'findEmailTemplateGroupByName'
  | 'findEmailTemplateGroupById'
  | 'findDefaultEmailTemplateGroup'
  | 'createEmailTemplateGroup'
  | 'updateEmailTemplateGroup'
  | 'setDefaultEmailTemplateGroup'
  | 'listActivePersonaProfiles'
  | 'getGlobalConfig'
>;
