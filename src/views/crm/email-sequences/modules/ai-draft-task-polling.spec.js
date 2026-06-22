import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  canApplyAiDraftTaskDetail,
  createAiDraftTaskPollingController,
  isAiDraftTaskPollingStatus
} from './ai-draft-task-polling';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function createDetail(id, status) {
  return {
    task: {
      id,
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      status,
      runVersion: 1,
      requestedCount: 1,
      pendingCount: status === 'queued' ? 1 : 0,
      runningCount: status === 'running' ? 1 : 0,
      retryingCount: 0,
      successCount: status === 'completed' ? 1 : 0,
      skippedCount: 0,
      failedCount: status === 'failed' ? 1 : 0,
      effectiveConcurrency: 1,
      maxAttempts: 2,
      organizationRole: 'member',
      ownerUserName: 'Alice',
      bullJobId: null,
      failureReason: null,
      progressState: null,
      resultSummary: null,
      readAt: null,
      notifiedAt: null,
      startedAt: null,
      finishedAt: null,
      createdAt: '2026-06-20T01:00:00.000Z',
      updatedAt: '2026-06-20T01:00:00.000Z'
    },
    items: []
  };
}
describe('AI draft task polling helpers', () => {
  it('treats only queued and running tasks as polling statuses', () => {
    assert.equal(isAiDraftTaskPollingStatus('queued'), true);
    assert.equal(isAiDraftTaskPollingStatus('running'), true);
    assert.equal(isAiDraftTaskPollingStatus('completed'), false);
    assert.equal(isAiDraftTaskPollingStatus('failed'), false);
    assert.equal(isAiDraftTaskPollingStatus('cancelled'), false);
    assert.equal(isAiDraftTaskPollingStatus(null), false);
  });
  it('starts polling active visible tasks and stops on terminal status', async () => {
    let visible = true;
    let detail = createDetail('task-1', 'queued');
    const refreshedTaskIds = [];
    const controller = createAiDraftTaskPollingController({
      getDetail: () => detail,
      isVisible: () => visible,
      intervalMs: 5,
      refresh: async taskId => {
        refreshedTaskIds.push(taskId);
      }
    });
    controller.sync();
    await sleep(14);
    assert.ok(refreshedTaskIds.length >= 1);
    assert.equal(controller.isPolling(), true);
    detail = createDetail('task-1', 'completed');
    controller.sync();
    const countAfterStop = refreshedTaskIds.length;
    await sleep(14);
    assert.equal(refreshedTaskIds.length, countAfterStop);
    assert.equal(controller.isPolling(), false);
    visible = false;
    controller.dispose();
  });
  it('clears polling when drawer closes', async () => {
    let visible = true;
    const detail = createDetail('task-1', 'running');
    const refreshedTaskIds = [];
    const controller = createAiDraftTaskPollingController({
      getDetail: () => detail,
      isVisible: () => visible,
      intervalMs: 5,
      refresh: async taskId => {
        refreshedTaskIds.push(taskId);
      }
    });
    controller.sync();
    await sleep(12);
    visible = false;
    controller.sync();
    const countAfterClose = refreshedTaskIds.length;
    await sleep(12);
    assert.equal(refreshedTaskIds.length, countAfterClose);
    assert.equal(controller.isPolling(), false);
    controller.dispose();
  });
  it('rejects stale task detail responses for a different current task', () => {
    assert.equal(canApplyAiDraftTaskDetail(null, 'task-1'), true);
    assert.equal(canApplyAiDraftTaskDetail(createDetail('task-1', 'running'), 'task-1'), true);
    assert.equal(canApplyAiDraftTaskDetail(createDetail('task-2', 'running'), 'task-1'), false);
  });
});
