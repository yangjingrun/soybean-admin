import type { CrmStore } from '../crm.types';

export const CRM_PERSONA_PROFILE_REPOSITORY = Symbol('CRM_PERSONA_PROFILE_REPOSITORY');

export type CrmPersonaProfileRepository = Pick<
  CrmStore,
  | 'listPersonaProfiles'
  | 'listActivePersonaProfiles'
  | 'findPersonaProfileByName'
  | 'findPersonaProfileById'
  | 'createPersonaProfile'
  | 'updatePersonaProfile'
  | 'setDefaultPersonaProfile'
>;
