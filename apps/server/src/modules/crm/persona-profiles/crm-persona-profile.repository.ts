import type {
  CrmPersonaProfileCreateInput,
  CrmPersonaProfileListInput,
  CrmPersonaProfileRecord,
  CrmPersonaProfileUpdateInput
} from '../crm.types';

export const CRM_PERSONA_PROFILE_REPOSITORY = Symbol('CRM_PERSONA_PROFILE_REPOSITORY');

export interface CrmPersonaProfileRepository {
  listPersonaProfiles(input: CrmPersonaProfileListInput): Promise<{
    records: CrmPersonaProfileRecord[];
    total: number;
  }>;
  listActivePersonaProfiles(organizationId: string): Promise<CrmPersonaProfileRecord[]>;
  findPersonaProfileByName(organizationId: string, name: string): Promise<CrmPersonaProfileRecord | null>;
  findPersonaProfileById(args: { id: string; organizationId: string }): Promise<CrmPersonaProfileRecord | null>;
  createPersonaProfile(input: CrmPersonaProfileCreateInput): Promise<CrmPersonaProfileRecord>;
  updatePersonaProfile(
    id: string,
    organizationId: string,
    input: CrmPersonaProfileUpdateInput
  ): Promise<CrmPersonaProfileRecord | null>;
  setDefaultPersonaProfile(id: string, organizationId: string): Promise<CrmPersonaProfileRecord | null>;
}
