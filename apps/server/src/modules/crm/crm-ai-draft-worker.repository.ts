import type {
  CrmAiDraftQueueConfigRecord,
  CrmAiDraftTaskItemRecord,
  CrmAiDraftTaskItemUpdateGuard,
  CrmAiDraftTaskItemUpdateInput,
  CrmAiDraftTaskRecord,
  CrmAiDraftTaskUpdateGuard,
  CrmAiDraftTaskUpdateInput
} from './crm-ai-draft-task.types';
import type {
  CrmBlacklistRecord,
  CrmEmailTemplateGroupRecord,
  CrmFirstOutreachDraftBundleCreateInput,
  CrmFirstOutreachDraftBundleRecord,
  CrmFollowUpDraftBundleCreateInput,
  CrmFollowUpDraftBundleRecord,
  CrmGlobalConfigRecord,
  CrmPersonaProfileRecord,
  CrmSequenceReviewRecord
} from './crm.types';

/** Data port for CRM AI draft task workers and worker host queue config. */
export interface CrmAiDraftWorkerRepository {
  getAiDraftQueueConfig(): Promise<CrmAiDraftQueueConfigRecord>;
  findAiDraftTaskById(input: {
    id: string;
    organizationId: string;
    ownerUserId?: string;
  }): Promise<CrmAiDraftTaskRecord | null>;
  listAiDraftTaskItems(input: { taskId: string }): Promise<CrmAiDraftTaskItemRecord[]>;
  updateAiDraftTask(
    id: string,
    patch: CrmAiDraftTaskUpdateInput,
    guard?: CrmAiDraftTaskUpdateGuard
  ): Promise<CrmAiDraftTaskRecord | null>;
  updateAiDraftTaskItem(
    id: string,
    patch: CrmAiDraftTaskItemUpdateInput,
    guard?: CrmAiDraftTaskItemUpdateGuard
  ): Promise<CrmAiDraftTaskItemRecord | null>;
  getSequenceReviewItem(args: {
    id: string;
    organizationId: string;
    ownerUserId?: string;
  }): Promise<CrmSequenceReviewRecord | null>;
  listMailboxSendScheduleTimes(args: { organizationId: string; mailboxId: string }): Promise<Date[]>;
  createFirstOutreachDraftBundle(
    input: CrmFirstOutreachDraftBundleCreateInput
  ): Promise<CrmFirstOutreachDraftBundleRecord | null>;
  createFollowUpDraftBundle(input: CrmFollowUpDraftBundleCreateInput): Promise<CrmFollowUpDraftBundleRecord | null>;
  listBlacklistEntriesByEmailHashes(args: {
    organizationId: string;
    emailHashes: string[];
  }): Promise<CrmBlacklistRecord[]>;
  getGlobalConfig(): Promise<CrmGlobalConfigRecord>;
  findDefaultEmailTemplateGroup(organizationId: string): Promise<CrmEmailTemplateGroupRecord | null>;
  listActivePersonaProfiles(organizationId: string): Promise<CrmPersonaProfileRecord[]>;
}
