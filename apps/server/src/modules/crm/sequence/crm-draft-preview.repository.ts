import type {
  CrmAccountDetailRecord,
  CrmEmailTemplateGroupRecord,
  CrmPersonaProfileRecord,
  CrmProductLineRecord,
  CrmSequenceReviewRecord
} from '../crm.types';

export interface CrmDraftPreviewAccountRepository {
  getAccountDetail(args: {
    id: string;
    organizationId: string;
    ownerUserId?: string;
  }): Promise<CrmAccountDetailRecord | null>;
}

export interface CrmDraftPreviewSettingsRepository {
  findProductLineById(args: { id: string; organizationId: string }): Promise<CrmProductLineRecord | null>;
  findDefaultEmailTemplateGroup(organizationId: string): Promise<CrmEmailTemplateGroupRecord | null>;
  listActivePersonaProfiles(organizationId: string): Promise<CrmPersonaProfileRecord[]>;
}

export interface CrmDraftPreviewSequenceRepository {
  getSequenceReviewItem(args: {
    id: string;
    organizationId: string;
    ownerUserId?: string;
  }): Promise<CrmSequenceReviewRecord | null>;
}
