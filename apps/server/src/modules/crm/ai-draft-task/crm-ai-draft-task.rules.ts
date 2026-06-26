import { BadRequestException } from '@nestjs/common';
import { requireEnabledCrmProductLineAiWritingConfig } from '../crm-ai-draft-prompt';
import type {
  CrmAiDraftQueueConfigRecord,
  CrmAiDraftTaskCreateLimitReason,
  CrmAiDraftTaskItemRecord,
  CrmAiDraftTaskRecord,
  CrmSequenceReviewRecord
} from '../crm.types';
import { getNextDraftSkipMessage } from '../sequence/crm-next-draft-rules';

/** Normalizes a user-selected enrollment id batch for AI draft task creation. */
export function normalizeAiDraftTaskEnrollmentIds(value: string[], maxSize: number) {
  if (!Array.isArray(value)) {
    throw new BadRequestException('请选择邮件序列');
  }

  const ids = [...new Set(value.map(item => item.trim()).filter(Boolean))];

  if (ids.length === 0) {
    throw new BadRequestException('请选择邮件序列');
  }

  if (ids.length > maxSize) {
    throw new BadRequestException(`一次最多选择 ${maxSize} 条邮件序列`);
  }

  return ids;
}

/** Normalizes pagination values while preserving the existing CRM defaults. */
export function normalizeAiDraftTaskPositiveInteger(
  value: number | string | undefined,
  fallback: number,
  min = 1,
  max = Number.MAX_SAFE_INTEGER
) {
  if (value === undefined || value === '') {
    return fallback;
  }

  const numberValue = Number(value);
  if (!Number.isInteger(numberValue) || numberValue < min) return fallback;

  return Math.min(numberValue, max);
}

/** Returns the business skip reason for a next-step AI draft task item. */
export function getAiDraftTaskItemSkipMessage(item: CrmSequenceReviewRecord, blacklistedEmailHashes: Set<string>) {
  const nextDraftSkipMessage = getNextDraftSkipMessage(item);

  if (nextDraftSkipMessage) {
    return nextDraftSkipMessage;
  }

  if (item.contact.emailStatus === 'unsubscribed') {
    return '联系人已退订，不能继续开发';
  }

  if (blacklistedEmailHashes.has(item.contact.emailHash)) {
    return '该邮箱已在组织黑名单中，不能继续开发';
  }

  if (!item.productLine || item.productLine.status !== 'active' || !item.productLine.aiWritingConfig?.enabled) {
    return '产品资料未启用 AI 写信';
  }

  try {
    requireEnabledCrmProductLineAiWritingConfig(item.productLine.aiWritingConfig);
  } catch (error) {
    return error instanceof Error ? error.message : '产品资料 AI 写信配置不完整';
  }

  return null;
}

/** Converts active-cap reasons into the existing CRM task creation copy. */
export function toAiDraftTaskCreateLimitMessage(reason: CrmAiDraftTaskCreateLimitReason | undefined) {
  if (reason === 'organization_active_limit') {
    return '当前组织进行中的 AI 草稿任务已达到上限，请稍后再试';
  }

  if (reason === 'concurrent_create_conflict') {
    return 'AI 草稿任务创建冲突，请稍后重试';
  }

  return '当前用户已有进行中的 AI 草稿任务，请完成后再创建';
}

/** Counts task items by terminal and active status for task summary refreshes. */
export function countAiDraftTaskItemRecords(items: CrmAiDraftTaskItemRecord[]) {
  return {
    successCount: items.filter(item => item.status === 'succeeded').length,
    skippedCount: items.filter(item => item.status === 'skipped').length,
    failedCount: items.filter(item => item.status === 'failed').length,
    retryingCount: items.filter(item => item.status === 'retrying').length,
    runningCount: items.filter(item => item.status === 'running').length,
    pendingCount: items.filter(item => item.status === 'pending').length
  };
}

/** Converts persisted task dates into API-facing ISO strings. */
export function toAiDraftTaskView(record: CrmAiDraftTaskRecord) {
  return {
    ...record,
    readAt: record.readAt?.toISOString() ?? null,
    notifiedAt: record.notifiedAt?.toISOString() ?? null,
    startedAt: record.startedAt?.toISOString() ?? null,
    finishedAt: record.finishedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

/** Converts persisted task item dates into API-facing ISO strings. */
export function toAiDraftTaskItemView(record: CrmAiDraftTaskItemRecord) {
  return {
    ...record,
    startedAt: record.startedAt?.toISOString() ?? null,
    finishedAt: record.finishedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

/** Converts queue config dates into API-facing ISO strings. */
export function toAiDraftQueueConfigView(record: CrmAiDraftQueueConfigRecord) {
  return {
    ...record,
    updatedAt: record.updatedAt.toISOString()
  };
}
