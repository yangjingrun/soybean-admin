import type { CrmAiDraftQueueConfigModel } from '../../../generated/prisma/models/CrmAiDraftQueueConfig';
import type { CrmAiDraftTaskModel } from '../../../generated/prisma/models/CrmAiDraftTask';
import type { CrmAiDraftTaskItemModel } from '../../../generated/prisma/models/CrmAiDraftTaskItem';
import {
  defaultCrmAiDraftItemConcurrency,
  defaultCrmAiDraftMaxAttempts,
  defaultCrmAiDraftRetryBackoffSeconds,
  maxCrmAiDraftItemConcurrency,
  normalizeCrmAiDraftItemConcurrency,
  normalizeCrmAiDraftMaxAttempts,
  normalizeCrmAiDraftRetryBackoffSeconds
} from '../crm-ai-draft-task-state';
import type {
  CrmAiDraftQueueConfigRecord,
  CrmAiDraftTaskCreateInput,
  CrmAiDraftTaskItemRecord,
  CrmAiDraftTaskRecord
} from '../crm.types';

const crmAiDraftQueueConfigKey = 'crm-ai-draft';

/** Creates the in-memory default for the CRM AI draft queue config. */
export function createDefaultAiDraftQueueConfig(): CrmAiDraftQueueConfigRecord {
  return {
    configKey: crmAiDraftQueueConfigKey,
    itemConcurrency: defaultCrmAiDraftItemConcurrency,
    maxItemConcurrency: maxCrmAiDraftItemConcurrency,
    maxActiveTasksPerUser: 1,
    maxActiveTasksPerOrg: 2,
    maxAttempts: defaultCrmAiDraftMaxAttempts,
    retryBackoffSeconds: [...defaultCrmAiDraftRetryBackoffSeconds],
    updatedById: null,
    updatedByName: null,
    updatedAt: new Date(0)
  };
}

/** Maps AI draft queue config and clamps persisted numeric settings to valid ranges. */
export function toAiDraftQueueConfigRecord(record: CrmAiDraftQueueConfigModel): CrmAiDraftQueueConfigRecord {
  return {
    configKey: record.configKey,
    itemConcurrency: normalizeCrmAiDraftItemConcurrency(record.itemConcurrency, record.maxItemConcurrency),
    maxItemConcurrency: normalizeCrmAiDraftItemConcurrency(record.maxItemConcurrency, maxCrmAiDraftItemConcurrency),
    maxActiveTasksPerUser: normalizePositiveConfigInteger(record.maxActiveTasksPerUser, 1),
    maxActiveTasksPerOrg: normalizePositiveConfigInteger(record.maxActiveTasksPerOrg, 2),
    maxAttempts: normalizeCrmAiDraftMaxAttempts(record.maxAttempts),
    retryBackoffSeconds: normalizeCrmAiDraftRetryBackoffSeconds(record.retryBackoffSeconds),
    updatedById: record.updatedById,
    updatedByName: record.updatedByName,
    updatedAt: record.updatedAt
  };
}

/** Maps one AI draft task row to the worker-facing domain record. */
export function toAiDraftTaskRecord(record: CrmAiDraftTaskModel): CrmAiDraftTaskRecord {
  return {
    id: record.id,
    organizationId: record.organizationId,
    organizationRole: record.organizationRole,
    ownerUserId: record.ownerUserId,
    ownerUserName: record.ownerUserName,
    status: record.status as CrmAiDraftTaskRecord['status'],
    runVersion: record.runVersion,
    bullJobId: record.bullJobId,
    requestedCount: record.requestedCount,
    successCount: record.successCount,
    skippedCount: record.skippedCount,
    failedCount: record.failedCount,
    retryingCount: record.retryingCount,
    runningCount: record.runningCount,
    pendingCount: record.pendingCount,
    effectiveConcurrency: record.effectiveConcurrency,
    maxAttempts: record.maxAttempts,
    failureReason: record.failureReason,
    progressState: record.progressState as CrmAiDraftTaskRecord['progressState'],
    resultSummary: record.resultSummary as CrmAiDraftTaskRecord['resultSummary'],
    readAt: record.readAt,
    notifiedAt: record.notifiedAt,
    startedAt: record.startedAt,
    finishedAt: record.finishedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

/** Counts AI draft task items by their current status. */
export function countAiDraftTaskItems(items: CrmAiDraftTaskCreateInput['items']) {
  return {
    successCount: items.filter(item => item.status === 'succeeded').length,
    skippedCount: items.filter(item => item.status === 'skipped').length,
    failedCount: items.filter(item => item.status === 'failed').length,
    retryingCount: items.filter(item => item.status === 'retrying').length,
    runningCount: items.filter(item => item.status === 'running').length,
    pendingCount: items.filter(item => (item.status ?? 'pending') === 'pending').length
  };
}

/** Maps one AI draft task item row and narrows status/failure/metadata fields. */
export function toAiDraftTaskItemRecord(record: CrmAiDraftTaskItemModel): CrmAiDraftTaskItemRecord {
  return {
    id: record.id,
    taskId: record.taskId,
    organizationId: record.organizationId,
    ownerUserId: record.ownerUserId,
    enrollmentId: record.enrollmentId,
    messageId: record.messageId,
    contactId: record.contactId,
    accountId: record.accountId,
    productLineId: record.productLineId,
    stepIndex: record.stepIndex,
    status: record.status as CrmAiDraftTaskItemRecord['status'],
    attemptCount: record.attemptCount,
    maxAttempts: record.maxAttempts,
    failureType: record.failureType as CrmAiDraftTaskItemRecord['failureType'],
    failureReason: record.failureReason,
    draftSubject: record.draftSubject,
    draftBodyText: record.draftBodyText,
    metadata: record.metadata as CrmAiDraftTaskItemRecord['metadata'],
    startedAt: record.startedAt,
    finishedAt: record.finishedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

/** Normalizes positive integer config values with a caller-provided fallback. */
export function normalizePositiveConfigInteger(value: unknown, fallback: number) {
  const numberValue = Number(value);

  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    return fallback;
  }

  return numberValue;
}
