import type {
  CrmAiDraftTaskItemFailureType,
  CrmAiDraftTaskRecord,
  CrmAiDraftTaskStatus
} from './crm-ai-draft-task.types';
import { resolveCurrentTask } from '../../shared/task-state';

export const defaultCrmAiDraftItemConcurrency = 3;
export const maxCrmAiDraftItemConcurrency = 5;
export const defaultCrmAiDraftMaxAttempts = 3;
export const defaultCrmAiDraftRetryBackoffSeconds = [30, 60, 120] as const;
export const crmAiDraftActiveTaskStatuses: CrmAiDraftTaskStatus[] = ['queued', 'running'];

const currentTaskStatusWeight: Record<CrmAiDraftTaskStatus, number> = {
  queued: 0,
  running: 0,
  failed: 1,
  completed: 2,
  cancelled: 99
};

/** Normalizes per-task AI draft item concurrency into the configured safe range. */
export function normalizeCrmAiDraftItemConcurrency(value: unknown, max = maxCrmAiDraftItemConcurrency) {
  const numberValue = Number(value);
  const maxValue = normalizePositiveInteger(max, maxCrmAiDraftItemConcurrency);
  const cappedMax = Math.min(maxValue, maxCrmAiDraftItemConcurrency);

  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    return Math.min(defaultCrmAiDraftItemConcurrency, cappedMax);
  }

  return Math.min(numberValue, cappedMax);
}

/** Normalizes item retry attempts while keeping the product default stable. */
export function normalizeCrmAiDraftMaxAttempts(value: unknown) {
  return normalizePositiveInteger(value, defaultCrmAiDraftMaxAttempts);
}

/** Normalizes retry backoff seconds to the configured three-step retry schedule. */
export function normalizeCrmAiDraftRetryBackoffSeconds(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) {
    return [...defaultCrmAiDraftRetryBackoffSeconds];
  }

  const seconds = value.map(item => Number(item));

  if (seconds.some(item => !Number.isInteger(item) || item < 0)) {
    return [...defaultCrmAiDraftRetryBackoffSeconds];
  }

  return seconds;
}

/** Picks the task that should be shown as current for the CRM user. */
export function resolveCurrentCrmAiDraftTask(records: CrmAiDraftTaskRecord[]) {
  return resolveCurrentTask(records, {
    activeStatuses: crmAiDraftActiveTaskStatuses,
    unreadTerminalStatuses: ['completed', 'failed'],
    statusWeight: currentTaskStatusWeight
  });
}

export function isCrmAiDraftTaskActiveStatus(status: CrmAiDraftTaskStatus) {
  return crmAiDraftActiveTaskStatuses.includes(status);
}

/** Classifies AI/provider failures that are worth retrying without hiding business skips. */
export function classifyCrmAiDraftTaskItemFailure(error: unknown): CrmAiDraftTaskItemFailureType {
  const status = readErrorNumber(error, ['status', 'statusCode']);
  const code = readErrorString(error, ['code', 'name']).toLowerCase();
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  if (status === 408 || status === 409 || status === 425 || status === 429 || (status >= 500 && status < 600)) {
    return 'retryable';
  }

  if (
    ['timeout', 'etimedout', 'econnreset', 'econnrefused', 'enotfound', 'eai_again'].some(item => code.includes(item))
  ) {
    return 'retryable';
  }

  if (/(rate limit|throttl|timeout|temporar|try again|5\d\d|network)/i.test(message)) {
    return 'retryable';
  }

  return 'fatal';
}

export function getCrmAiDraftRetryBackoffSeconds(backoffSeconds: number[], attemptCount: number) {
  const normalized = normalizeCrmAiDraftRetryBackoffSeconds(backoffSeconds);
  const index = Math.max(0, Math.min(attemptCount - 1, normalized.length - 1));

  return normalized[index] ?? defaultCrmAiDraftRetryBackoffSeconds[0];
}

function normalizePositiveInteger(value: unknown, fallback: number) {
  const numberValue = Number(value);

  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    return fallback;
  }

  return numberValue;
}

function readErrorNumber(error: unknown, keys: string[]) {
  if (!error || typeof error !== 'object') {
    return 0;
  }

  for (const key of keys) {
    const value = (error as Record<string, unknown>)[key];
    const numberValue = Number(value);

    if (Number.isInteger(numberValue)) {
      return numberValue;
    }
  }

  return 0;
}

function readErrorString(error: unknown, keys: string[]) {
  if (!error || typeof error !== 'object') {
    return '';
  }

  return keys.map(key => String((error as Record<string, unknown>)[key] ?? '')).join(' ');
}
