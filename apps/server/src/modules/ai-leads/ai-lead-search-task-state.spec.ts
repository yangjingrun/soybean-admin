import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  aiLeadActiveTaskStatuses,
  normalizeAiLeadQueueConcurrency,
  resolveCurrentAiLeadSearchTask
} from './ai-lead-search-task-state';
import type { AiLeadSearchTaskRecord } from './ai-lead-search-task.types';

describe('ai lead search task state helpers', () => {
  it('prefers active tasks before unread completed tasks', () => {
    const current = resolveCurrentAiLeadSearchTask([
      createTask({ id: 'completed-1', status: 'completed', readAt: null, updatedAt: new Date('2026-06-18T01:00:00Z') }),
      createTask({ id: 'failed-1', status: 'failed', updatedAt: new Date('2026-06-18T02:00:00Z') }),
      createTask({ id: 'running-1', status: 'running', updatedAt: new Date('2026-06-18T00:30:00Z') })
    ]);

    assert.equal(current?.id, 'running-1');
  });

  it('returns unread completed task when no active task exists', () => {
    const current = resolveCurrentAiLeadSearchTask([
      createTask({ id: 'completed-read', status: 'completed', readAt: new Date('2026-06-18T01:00:00Z') }),
      createTask({ id: 'completed-unread', status: 'completed', readAt: null })
    ]);

    assert.equal(current?.id, 'completed-unread');
  });

  it('normalizes queue concurrency to a small positive integer', () => {
    assert.equal(normalizeAiLeadQueueConcurrency(undefined), 2);
    assert.equal(normalizeAiLeadQueueConcurrency(0), 2);
    assert.equal(normalizeAiLeadQueueConcurrency(3), 3);
    assert.equal(normalizeAiLeadQueueConcurrency(20), 10);
  });

  it('keeps queued, running, interrupted, and failed as active task statuses', () => {
    assert.deepEqual(aiLeadActiveTaskStatuses, ['queued', 'running', 'interrupted', 'failed']);
  });
});

function createTask(overrides: Partial<AiLeadSearchTaskRecord>): AiLeadSearchTaskRecord {
  return {
    id: 'task-1',
    userId: 'u-1',
    userName: 'Soybean',
    organizationId: 'org-1',
    organizationRole: 'admin',
    requirement: '找沙特轴承进口商',
    targetLeadCount: 20,
    keywordPlan: {},
    status: 'queued',
    priority: 0,
    runVersion: 1,
    progressState: null,
    result: null,
    errorMessage: null,
    bullJobId: null,
    readAt: null,
    notifiedAt: null,
    startedAt: null,
    finishedAt: null,
    createdAt: new Date('2026-06-18T00:00:00Z'),
    updatedAt: new Date('2026-06-18T00:00:00Z'),
    ...overrides
  };
}
