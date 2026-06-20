import type {
  CrmEmailTemplateGroupRecord,
  CrmFollowUpDraftBundleCreateInput,
  CrmFollowUpDraftBundleRecord,
  CrmGlobalConfigRecord,
  CrmPersonaProfileRecord,
  CrmSequenceReviewRecord
} from '../crm.types';

export interface CrmNextDraftRepository {
  getSequenceReviewItem(args: {
    id: string;
    organizationId: string;
    ownerUserId?: string;
  }): Promise<CrmSequenceReviewRecord | null>;
  listSequenceReviewItemsByIds(args: {
    ids: string[];
    organizationId: string;
    ownerUserId?: string;
  }): Promise<CrmSequenceReviewRecord[]>;
  getGlobalConfig(): Promise<CrmGlobalConfigRecord>;
  findDefaultEmailTemplateGroup(organizationId: string): Promise<CrmEmailTemplateGroupRecord | null>;
  listActivePersonaProfiles(organizationId: string): Promise<CrmPersonaProfileRecord[]>;
  createFollowUpDraftBundle(input: CrmFollowUpDraftBundleCreateInput): Promise<CrmFollowUpDraftBundleRecord | null>;
}
