import type { CrmAiDraftQueueConfigInput, CrmAiDraftQueueConfigRecord } from '../crm-ai-draft-task.types';
import type {
  CrmGlobalConfigInput,
  CrmGlobalConfigRecord,
  CrmOrganizationConfigInput,
  CrmOrganizationConfigRecord,
  CrmSendPreferenceInput,
  CrmSendPreferenceRecord
} from '../crm.types';
import type { CrmPersonaProfileRepository } from '../persona-profiles/crm-persona-profile.repository';
import type { CrmProductLineRepository } from '../product-lines/crm-product-line.repository';
import type { CrmSequencePolicyRepository } from '../sequence-policies/crm-sequence-policy.repository';
import type { CrmEmailTemplateGroupRepository } from '../template-groups/crm-email-template-group.repository';

export interface CrmSettingsRepository
  extends
    CrmProductLineRepository,
    CrmPersonaProfileRepository,
    CrmEmailTemplateGroupRepository,
    CrmSequencePolicyRepository {
  getGlobalConfig(): Promise<CrmGlobalConfigRecord>;
  saveGlobalConfig(input: CrmGlobalConfigInput): Promise<CrmGlobalConfigRecord>;
  getSendPreference(args: { organizationId: string; ownerUserId: string }): Promise<CrmSendPreferenceRecord | null>;
  saveSendPreference(input: CrmSendPreferenceInput): Promise<CrmSendPreferenceRecord>;
  getOrganizationConfig(organizationId: string): Promise<CrmOrganizationConfigRecord | null>;
  saveOrganizationConfig(input: CrmOrganizationConfigInput): Promise<CrmOrganizationConfigRecord>;
  getAiDraftQueueConfig(): Promise<CrmAiDraftQueueConfigRecord>;
  saveAiDraftQueueConfig(input: CrmAiDraftQueueConfigInput): Promise<CrmAiDraftQueueConfigRecord>;
}
