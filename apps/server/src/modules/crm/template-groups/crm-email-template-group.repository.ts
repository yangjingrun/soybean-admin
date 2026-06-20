import type {
  CrmEmailTemplateGroupCreateInput,
  CrmEmailTemplateGroupListInput,
  CrmEmailTemplateGroupRecord,
  CrmEmailTemplateGroupUpdateInput,
  CrmGlobalConfigRecord,
  CrmPersonaProfileRecord
} from '../crm.types';

export const CRM_EMAIL_TEMPLATE_GROUP_REPOSITORY = Symbol('CRM_EMAIL_TEMPLATE_GROUP_REPOSITORY');

export interface CrmEmailTemplateGroupRepository {
  listEmailTemplateGroups(input: CrmEmailTemplateGroupListInput): Promise<{
    records: CrmEmailTemplateGroupRecord[];
    total: number;
  }>;
  findEmailTemplateGroupByName(organizationId: string, name: string): Promise<CrmEmailTemplateGroupRecord | null>;
  findEmailTemplateGroupById(args: { id: string; organizationId: string }): Promise<CrmEmailTemplateGroupRecord | null>;
  findDefaultEmailTemplateGroup(organizationId: string): Promise<CrmEmailTemplateGroupRecord | null>;
  createEmailTemplateGroup(input: CrmEmailTemplateGroupCreateInput): Promise<CrmEmailTemplateGroupRecord>;
  updateEmailTemplateGroup(
    id: string,
    organizationId: string,
    input: CrmEmailTemplateGroupUpdateInput
  ): Promise<CrmEmailTemplateGroupRecord | null>;
  setDefaultEmailTemplateGroup(id: string, organizationId: string): Promise<CrmEmailTemplateGroupRecord | null>;
  listActivePersonaProfiles(organizationId: string): Promise<CrmPersonaProfileRecord[]>;
  getGlobalConfig(): Promise<CrmGlobalConfigRecord>;
}
