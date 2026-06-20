import type {
  CrmAiDraftTaskCreateInput,
  CrmAiDraftTaskCreateResult,
  CrmAiDraftTaskItemRecord,
  CrmAiDraftTaskItemUpdateGuard,
  CrmAiDraftTaskItemUpdateInput,
  CrmAiDraftTaskListInput,
  CrmAiDraftTaskRecord,
  CrmAiDraftTaskUpdateGuard,
  CrmAiDraftTaskUpdateInput
} from '../crm-ai-draft-task.types';
import type { CrmBlacklistRecord, CrmSequenceReviewRecord } from '../crm.types';

export interface CrmAiDraftTaskRepository {
  createAiDraftTask(input: CrmAiDraftTaskCreateInput): Promise<CrmAiDraftTaskCreateResult>;
  findCurrentAiDraftTaskForUser(input: {
    organizationId: string;
    ownerUserId: string;
  }): Promise<CrmAiDraftTaskRecord | null>;
  findAiDraftTaskById(input: {
    id: string;
    organizationId: string;
    ownerUserId?: string;
  }): Promise<CrmAiDraftTaskRecord | null>;
  listAiDraftTasks(input: CrmAiDraftTaskListInput): Promise<{ records: CrmAiDraftTaskRecord[]; total: number }>;
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
}

export interface CrmAiDraftTaskSourceRepository {
  /** Batch loads sequence review records by ids inside one organization and optional owner scope. */
  listSequenceReviewItemsByIds(args: {
    ids: string[];
    organizationId: string;
    ownerUserId?: string;
  }): Promise<CrmSequenceReviewRecord[]>;
  /** Batch loads organization blacklist entries by normalized email hashes. */
  listBlacklistEntriesByEmailHashes(args: {
    organizationId: string;
    emailHashes: string[];
  }): Promise<CrmBlacklistRecord[]>;
}
