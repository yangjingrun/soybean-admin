import { HttpException } from '@nestjs/common';

export interface SequenceBatchOperationInput {
  ids: string[];
}

export type SequenceBatchItemStatus = 'success' | 'skipped' | 'failed';

export interface SequenceBatchItemResult {
  id: string;
  status: SequenceBatchItemStatus;
  message: string;
  enrollmentId?: string;
  messageId?: string;
  stepIndex?: number;
}

export interface SequenceBatchOperateResult {
  totalCount: number;
  successCount: number;
  skippedCount: number;
  failedCount: number;
  results: SequenceBatchItemResult[];
}

/** Runs sequence batch items with per-item isolation and computes summary counters. */
export async function runSequenceBatch(
  ids: string[],
  operate: (id: string) => Promise<SequenceBatchItemResult>
): Promise<SequenceBatchOperateResult> {
  const results: SequenceBatchItemResult[] = [];

  for (const id of ids) {
    results.push(await operate(id));
  }

  return {
    totalCount: ids.length,
    successCount: results.filter(item => item.status === 'success').length,
    skippedCount: results.filter(item => item.status === 'skipped').length,
    failedCount: results.filter(item => item.status === 'failed').length,
    results
  };
}

export function createSequenceBatchResult(
  id: string,
  status: SequenceBatchItemStatus,
  message: string,
  extra: Omit<SequenceBatchItemResult, 'id' | 'status' | 'message'> = {}
): SequenceBatchItemResult {
  return {
    id,
    status,
    message,
    ...extra
  };
}

/** Converts business exceptions to skipped items and unknown failures to failed items. */
export function createSequenceBatchExceptionResult(
  id: string,
  error: unknown,
  enrollmentId?: string
): SequenceBatchItemResult {
  const message = error instanceof Error ? error.message : String(error);
  const status: SequenceBatchItemStatus =
    error instanceof HttpException && error.getStatus() < 500 ? 'skipped' : 'failed';

  return createSequenceBatchResult(id, status, message, {
    enrollmentId
  });
}
