import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createBullMqJobId } from './bullmq-job-id';

describe('createBullMqJobId', () => {
  it('builds deterministic custom job ids without BullMQ reserved separators', () => {
    const jobId = createBullMqJobId('ai-lead-search-task', 'task-1', 2);

    assert.equal(jobId, 'ai-lead-search-task__task-1__2');
    assert.equal(jobId.includes(':'), false);
  });
});
