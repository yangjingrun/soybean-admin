import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  classifyCrmAiDraftTaskItemFailure,
  crmAiDraftActiveTaskStatuses,
  defaultCrmAiDraftItemConcurrency,
  defaultCrmAiDraftMaxAttempts,
  getCrmAiDraftRetryBackoffSeconds,
  maxCrmAiDraftItemConcurrency,
  isCrmAiDraftTaskActiveStatus,
  normalizeCrmAiDraftItemConcurrency,
  normalizeCrmAiDraftMaxAttempts,
  normalizeCrmAiDraftRetryBackoffSeconds,
  resolveCurrentCrmAiDraftTask
} from './crm-ai-draft-task-state';
import type { CrmAiDraftTaskRecord } from './crm-ai-draft-task.types';

describe('crm ai draft task state helpers', () => {
  it('keeps the configured default and maximum queue limits', () => {
    assert.equal(defaultCrmAiDraftItemConcurrency, 3);
    assert.equal(maxCrmAiDraftItemConcurrency, 5);
    assert.equal(defaultCrmAiDraftMaxAttempts, 3);
  });

  it('normalizes item concurrency to a positive integer within the configured max', () => {
    assert.equal(normalizeCrmAiDraftItemConcurrency(undefined), 3);
    assert.equal(normalizeCrmAiDraftItemConcurrency(0), 3);
    assert.equal(normalizeCrmAiDraftItemConcurrency(2.5), 3);
    assert.equal(normalizeCrmAiDraftItemConcurrency(1), 1);
    assert.equal(normalizeCrmAiDraftItemConcurrency(4, 4), 4);
    assert.equal(normalizeCrmAiDraftItemConcurrency(8), 5);
    assert.equal(normalizeCrmAiDraftItemConcurrency(8, 4), 4);
    assert.equal(normalizeCrmAiDraftItemConcurrency(0, 2), 2);
    assert.equal(normalizeCrmAiDraftItemConcurrency(undefined, 1), 1);
  });

  it('normalizes max attempts and retry backoff seconds', () => {
    assert.equal(normalizeCrmAiDraftMaxAttempts(undefined), 3);
    assert.equal(normalizeCrmAiDraftMaxAttempts(0), 3);
    assert.equal(normalizeCrmAiDraftMaxAttempts(2), 2);
    assert.equal(normalizeCrmAiDraftMaxAttempts(2.5), 3);
    assert.deepEqual(normalizeCrmAiDraftRetryBackoffSeconds(undefined), [30, 60, 120]);
    assert.deepEqual(normalizeCrmAiDraftRetryBackoffSeconds([10, 20, 30]), [10, 20, 30]);
    assert.deepEqual(normalizeCrmAiDraftRetryBackoffSeconds([10, 0, 30]), [10, 0, 30]);
    assert.deepEqual(normalizeCrmAiDraftRetryBackoffSeconds([10, -1, 30]), [30, 60, 120]);
    assert.equal(getCrmAiDraftRetryBackoffSeconds([5, 10], 1), 5);
    assert.equal(getCrmAiDraftRetryBackoffSeconds([5, 10], 3), 10);
  });

  it('classifies transient AI/provider errors as retryable', () => {
    assert.equal(
      classifyCrmAiDraftTaskItemFailure(Object.assign(new Error('rate limit'), { status: 429 })),
      'retryable'
    );
    assert.equal(
      classifyCrmAiDraftTaskItemFailure(Object.assign(new Error('bad gateway'), { statusCode: 502 })),
      'retryable'
    );
    assert.equal(
      classifyCrmAiDraftTaskItemFailure(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' })),
      'retryable'
    );
    assert.equal(classifyCrmAiDraftTaskItemFailure(new Error('invalid prompt payload')), 'fatal');
  });

  it('marks only queued and running tasks as active', () => {
    assert.deepEqual(crmAiDraftActiveTaskStatuses, ['queued', 'running']);
    assert.equal(isCrmAiDraftTaskActiveStatus('queued'), true);
    assert.equal(isCrmAiDraftTaskActiveStatus('running'), true);
    assert.equal(isCrmAiDraftTaskActiveStatus('completed'), false);
    assert.equal(isCrmAiDraftTaskActiveStatus('failed'), false);
    assert.equal(isCrmAiDraftTaskActiveStatus('cancelled'), false);
  });

  it('prefers active tasks before unread finished tasks', () => {
    const current = resolveCurrentCrmAiDraftTask([
      createTask({ id: 'completed-1', status: 'completed', readAt: null, updatedAt: new Date('2026-06-20T01:00:00Z') }),
      createTask({ id: 'failed-1', status: 'failed', readAt: null, updatedAt: new Date('2026-06-20T02:00:00Z') }),
      createTask({ id: 'running-1', status: 'running', updatedAt: new Date('2026-06-20T00:30:00Z') })
    ]);

    assert.equal(current?.id, 'running-1');
  });

  it('returns unread completed or failed task when no active task exists', () => {
    const current = resolveCurrentCrmAiDraftTask([
      createTask({ id: 'completed-read', status: 'completed', readAt: new Date('2026-06-20T01:00:00Z') }),
      createTask({ id: 'failed-unread', status: 'failed', readAt: null, updatedAt: new Date('2026-06-20T03:00:00Z') }),
      createTask({
        id: 'completed-unread',
        status: 'completed',
        readAt: null,
        updatedAt: new Date('2026-06-20T02:00:00Z')
      })
    ]);

    assert.equal(current?.id, 'failed-unread');
  });
});

function createTask(overrides: Partial<CrmAiDraftTaskRecord>): CrmAiDraftTaskRecord {
  return {
    id: 'task-1',
    organizationId: 'org-1',
    organizationRole: 'admin',
    ownerUserId: 'user-1',
    ownerUserName: 'AI外贸管理系统',
    status: 'queued',
    runVersion: 1,
    bullJobId: null,
    requestedCount: 5,
    successCount: 0,
    skippedCount: 0,
    failedCount: 0,
    retryingCount: 0,
    runningCount: 0,
    pendingCount: 5,
    effectiveConcurrency: 3,
    maxAttempts: 3,
    failureReason: null,
    progressState: null,
    resultSummary: null,
    readAt: null,
    notifiedAt: null,
    startedAt: null,
    finishedAt: null,
    createdAt: new Date('2026-06-20T00:00:00Z'),
    updatedAt: new Date('2026-06-20T00:00:00Z'),
    ...overrides
  };
}
