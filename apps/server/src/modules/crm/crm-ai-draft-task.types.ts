export const crmAiDraftTaskStatuses = ['queued', 'running', 'completed', 'failed', 'cancelled'] as const;

export type CrmAiDraftTaskStatus = (typeof crmAiDraftTaskStatuses)[number];

export const crmAiDraftTaskItemStatuses = ['pending', 'running', 'retrying', 'succeeded', 'skipped', 'failed'] as const;

export type CrmAiDraftTaskItemStatus = (typeof crmAiDraftTaskItemStatuses)[number];

export type CrmAiDraftTaskItemFailureType = 'retryable' | 'business_skip' | 'fatal';

export interface CrmAiDraftTaskProgressState {
  currentItemId?: string | null;
  recentRetryableFailureCount?: number;
  effectiveConcurrencyReason?: string | null;
}

export interface CrmAiDraftTaskResultSummary {
  requestedCount: number;
  successCount: number;
  skippedCount: number;
  failedCount: number;
}

export interface CrmAiDraftTaskItemMetadata {
  kind?: 'first_outreach' | 'follow_up';
  generatedMessageId?: string | null;
  aiDraft?: unknown | null;
  nextRetryAt?: string | null;
}

export interface CrmAiDraftTaskRecord {
  id: string;
  organizationId: string;
  organizationRole: string | null;
  ownerUserId: string;
  ownerUserName: string | null;
  status: CrmAiDraftTaskStatus;
  runVersion: number;
  bullJobId: string | null;
  requestedCount: number;
  successCount: number;
  skippedCount: number;
  failedCount: number;
  retryingCount: number;
  runningCount: number;
  pendingCount: number;
  effectiveConcurrency: number;
  maxAttempts: number;
  failureReason: string | null;
  progressState: CrmAiDraftTaskProgressState | null;
  resultSummary: CrmAiDraftTaskResultSummary | null;
  readAt: Date | null;
  notifiedAt: Date | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CrmAiDraftTaskItemRecord {
  id: string;
  taskId: string;
  organizationId: string;
  ownerUserId: string;
  enrollmentId: string;
  messageId: string | null;
  contactId: string | null;
  accountId: string | null;
  productLineId: string | null;
  stepIndex: number;
  status: CrmAiDraftTaskItemStatus;
  attemptCount: number;
  maxAttempts: number;
  failureType: CrmAiDraftTaskItemFailureType | null;
  failureReason: string | null;
  draftSubject: string | null;
  draftBodyText: string | null;
  metadata: CrmAiDraftTaskItemMetadata | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CrmAiDraftQueueConfigRecord {
  configKey: string;
  itemConcurrency: number;
  maxItemConcurrency: number;
  maxActiveTasksPerUser: number;
  maxActiveTasksPerOrg: number;
  maxAttempts: number;
  retryBackoffSeconds: number[] | null;
  updatedById: string | null;
  updatedByName: string | null;
  updatedAt: Date;
}

export interface CrmAiDraftQueueConfigInput {
  itemConcurrency?: number;
  maxItemConcurrency?: number;
  maxActiveTasksPerUser?: number;
  maxActiveTasksPerOrg?: number;
  maxAttempts?: number;
  retryBackoffSeconds?: number[] | null;
  updatedById?: string | null;
  updatedByName?: string | null;
}

export interface CrmAiDraftTaskCreateItemInput {
  enrollmentId: string;
  messageId?: string | null;
  contactId?: string | null;
  accountId?: string | null;
  productLineId?: string | null;
  stepIndex: number;
  status?: CrmAiDraftTaskItemStatus;
  failureType?: CrmAiDraftTaskItemFailureType | null;
  failureReason?: string | null;
  metadata?: CrmAiDraftTaskItemMetadata | null;
}

export interface CrmAiDraftTaskCreateInput {
  organizationId: string;
  organizationRole?: string | null;
  ownerUserId: string;
  ownerUserName?: string | null;
  status?: CrmAiDraftTaskStatus;
  requestedCount: number;
  items: CrmAiDraftTaskCreateItemInput[];
}

export interface CrmFirstOutreachAiDraftTaskEnrollmentInput {
  enrollment: import('./crm.types').CrmSequenceEnrollmentCreateInput;
  item: Omit<CrmAiDraftTaskCreateItemInput, 'enrollmentId' | 'stepIndex' | 'status' | 'metadata'>;
}

export interface CrmFirstOutreachAiDraftTaskCreateInput {
  organizationId: string;
  organizationRole?: string | null;
  ownerUserId: string;
  ownerUserName?: string | null;
  requestedCount: number;
  enrollments: CrmFirstOutreachAiDraftTaskEnrollmentInput[];
  accountStatus: import('./crm.types').CrmAccountStatus;
}

export interface CrmFirstOutreachAiDraftTaskCreateResult extends CrmAiDraftTaskCreateResult {
  enrollmentIds?: string[];
}

export type CrmAiDraftTaskCreateLimitReason =
  | 'user_active_limit'
  | 'organization_active_limit'
  | 'concurrent_create_conflict';

export interface CrmAiDraftTaskCreateResult {
  task: CrmAiDraftTaskRecord | null;
  limitReason?: CrmAiDraftTaskCreateLimitReason;
}

export interface CrmAiDraftTaskUpdateInput {
  status?: CrmAiDraftTaskStatus;
  runVersion?: number;
  bullJobId?: string | null;
  successCount?: number;
  skippedCount?: number;
  failedCount?: number;
  retryingCount?: number;
  runningCount?: number;
  pendingCount?: number;
  effectiveConcurrency?: number;
  failureReason?: string | null;
  progressState?: CrmAiDraftTaskProgressState | null;
  resultSummary?: CrmAiDraftTaskResultSummary | null;
  readAt?: Date | null;
  notifiedAt?: Date | null;
  startedAt?: Date | null;
  finishedAt?: Date | null;
}

export interface CrmAiDraftTaskUpdateGuard {
  organizationId?: string;
  ownerUserId?: string;
  status?: CrmAiDraftTaskStatus | CrmAiDraftTaskStatus[];
  runVersion?: number;
}

export interface CrmAiDraftTaskItemUpdateInput {
  status?: CrmAiDraftTaskItemStatus;
  attemptCount?: number;
  failureType?: CrmAiDraftTaskItemFailureType | null;
  failureReason?: string | null;
  draftSubject?: string | null;
  draftBodyText?: string | null;
  metadata?: CrmAiDraftTaskItemMetadata | null;
  startedAt?: Date | null;
  finishedAt?: Date | null;
}

export interface CrmAiDraftTaskListInput {
  organizationId: string;
  ownerUserId?: string;
  skip: number;
  take: number;
}

export interface CrmAiDraftTaskItemUpdateGuard {
  taskId?: string;
  organizationId?: string;
  ownerUserId?: string;
  status?: CrmAiDraftTaskItemStatus | CrmAiDraftTaskItemStatus[];
}

export interface CrmAiDraftTaskQueueJob {
  taskId: string;
  organizationId: string;
  ownerUserId: string;
  runVersion: number;
}

export interface CrmAiDraftTaskQueuePort {
  enqueueTask(input: CrmAiDraftTaskQueueJob): Promise<{ jobId: string }>;
  removeTaskJob(jobId: string): Promise<void>;
  applyGlobalConcurrency(concurrency: number): Promise<void>;
}

export interface CrmAiDraftTaskStore {
  createAiDraftTask(input: CrmAiDraftTaskCreateInput): Promise<CrmAiDraftTaskCreateResult>;
  createFirstOutreachAiDraftTask(
    input: CrmFirstOutreachAiDraftTaskCreateInput
  ): Promise<CrmFirstOutreachAiDraftTaskCreateResult>;
  countActiveAiDraftTasksForUser(input: { organizationId: string; ownerUserId: string }): Promise<number>;
  countActiveAiDraftTasksForOrg(input: { organizationId: string }): Promise<number>;
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
  getAiDraftQueueConfig(): Promise<CrmAiDraftQueueConfigRecord>;
  saveAiDraftQueueConfig(input: CrmAiDraftQueueConfigInput): Promise<CrmAiDraftQueueConfigRecord>;
}
