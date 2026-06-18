import type { UserInfo } from '../auth/auth.types';

export type AiLeadSearchTaskStatus = 'queued' | 'running' | 'interrupted' | 'failed' | 'completed' | 'discarded';

export type AiLeadSearchTaskQueryStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface AiLeadSearchTaskRecord {
  id: string;
  userId: string;
  userName: string | null;
  requirement: string;
  targetLeadCount: number;
  keywordPlan: unknown;
  status: AiLeadSearchTaskStatus;
  priority: number;
  runVersion: number;
  progressState: unknown | null;
  result: unknown | null;
  errorMessage: string | null;
  bullJobId: string | null;
  readAt: Date | null;
  notifiedAt: Date | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AiLeadSearchTaskCreateInput {
  userId: string;
  userName?: string | null;
  requirement: string;
  targetLeadCount: number;
  keywordPlan: unknown;
  priority: number;
}

export interface AiLeadSearchTaskQueryRecord {
  id: string;
  taskId: string;
  requestKey: string;
  endpoint: 'search' | 'places';
  requestBody: unknown;
  status: AiLeadSearchTaskQueryStatus;
  result: unknown | null;
  errorMessage: string | null;
  orderIndex: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AiLeadSearchTaskQueryStartInput {
  taskId: string;
  requestKey: string;
  endpoint: 'search' | 'places';
  requestBody: unknown;
  orderIndex: number;
}

export interface AiLeadSearchTaskUpdateInput {
  status?: AiLeadSearchTaskStatus;
  priority?: number;
  runVersion?: number;
  progressState?: unknown | null;
  result?: unknown | null;
  errorMessage?: string | null;
  bullJobId?: string | null;
  readAt?: Date | null;
  notifiedAt?: Date | null;
  startedAt?: Date | null;
  finishedAt?: Date | null;
}

export interface AiLeadSearchTaskUpdateGuard {
  userId?: string;
  status?: AiLeadSearchTaskStatus | AiLeadSearchTaskStatus[];
  runVersion?: number;
}

export interface AiLeadSearchTaskEventInput {
  taskId: string;
  eventType: string;
  fromStatus?: AiLeadSearchTaskStatus | null;
  toStatus?: AiLeadSearchTaskStatus | null;
  title: string;
  message?: string | null;
  metadata?: unknown | null;
}

export interface AiLeadSearchTaskStore {
  createTask(input: AiLeadSearchTaskCreateInput): Promise<AiLeadSearchTaskRecord>;
  createTaskIfNoCurrent(input: AiLeadSearchTaskCreateInput): Promise<AiLeadSearchTaskRecord | null>;
  findCurrentTaskForUser(userId: string): Promise<AiLeadSearchTaskRecord | null>;
  findTaskById(id: string): Promise<AiLeadSearchTaskRecord | null>;
  findTaskByIdForUser(id: string, userId: string): Promise<AiLeadSearchTaskRecord | null>;
  updateTask(
    id: string,
    patch: AiLeadSearchTaskUpdateInput,
    guard?: AiLeadSearchTaskUpdateGuard
  ): Promise<AiLeadSearchTaskRecord | null>;
  interruptRunningTasksForRecovery(activeBullJobIds?: string[]): Promise<AiLeadSearchTaskRecord[]>;
  createTaskEvent(input: AiLeadSearchTaskEventInput): Promise<unknown>;
  findQueryByRequestKey(taskId: string, requestKey: string): Promise<AiLeadSearchTaskQueryRecord | null>;
  upsertRunningQuery(input: AiLeadSearchTaskQueryStartInput): Promise<AiLeadSearchTaskQueryRecord>;
  completeQuery(id: string, result: unknown): Promise<AiLeadSearchTaskQueryRecord>;
  failQuery(id: string, errorMessage: string): Promise<AiLeadSearchTaskQueryRecord>;
}

export interface AiLeadQueueConfigRecord {
  configKey: string;
  workerConcurrency: number;
  priorityStrategy: 'fifo';
  updatedAt: Date;
}

export interface AiLeadQueueConfigInput {
  workerConcurrency: number;
  updatedById?: string | null;
  updatedByName?: string | null;
}

export interface AiLeadQueueConfigStore {
  getConfig(): Promise<AiLeadQueueConfigRecord>;
  saveConfig(input: AiLeadQueueConfigInput): Promise<AiLeadQueueConfigRecord>;
}

export interface AiLeadSearchTaskQueuePort {
  enqueueSearchTask(input: { taskId: string; runVersion: number; priority: number }): Promise<{ jobId: string }>;
  removeSearchTaskJob(jobId: string): Promise<void>;
  applyGlobalConcurrency(concurrency: number): Promise<void>;
  listActiveSearchTaskJobIds?(): Promise<string[]>;
}

export interface AiLeadSearchTaskContext {
  user?: UserInfo | null;
}
