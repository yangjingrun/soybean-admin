import { resolveCurrentTask } from '../../shared/task-state';
import type { AiLeadSearchTaskRecord, AiLeadSearchTaskStatus } from './ai-lead-search-task.types';

export const defaultAiLeadQueueConcurrency = 2;
export const maxAiLeadQueueConcurrency = 10;
export const aiLeadActiveTaskStatuses: AiLeadSearchTaskStatus[] = ['queued', 'running', 'interrupted', 'failed'];

const currentTaskStatusWeight: Record<AiLeadSearchTaskStatus, number> = {
  queued: 0,
  running: 0,
  interrupted: 1,
  failed: 2,
  completed: 3,
  discarded: 99
};

/** Normalizes the global BullMQ worker concurrency configured from the admin UI. */
export function normalizeAiLeadQueueConcurrency(value: unknown) {
  const numberValue = Number(value);

  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    return defaultAiLeadQueueConcurrency;
  }

  return Math.min(numberValue, maxAiLeadQueueConcurrency);
}

/** Picks the one task that should be restored when the AI leads page opens. */
export function resolveCurrentAiLeadSearchTask(records: AiLeadSearchTaskRecord[]) {
  return resolveCurrentTask(records, {
    activeStatuses: aiLeadActiveTaskStatuses,
    unreadTerminalStatuses: ['completed'],
    statusWeight: currentTaskStatusWeight
  });
}

export function isAiLeadActiveTaskStatus(status: AiLeadSearchTaskStatus) {
  return aiLeadActiveTaskStatuses.includes(status);
}
