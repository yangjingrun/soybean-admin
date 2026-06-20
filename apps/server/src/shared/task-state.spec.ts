import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createTaskNotificationMetadata,
  createTaskStateChangeEvent,
  isStaleRunVersion,
  isTaskInStatus,
  resolveCurrentTask
} from './task-state';

describe('task-state', () => {
  it('detects stale runVersion jobs', () => {
    assert.equal(isStaleRunVersion({ runVersion: 2 }, 1), true);
    assert.equal(isStaleRunVersion({ runVersion: 2 }, 2), false);
    assert.equal(isStaleRunVersion(null, 2), true);
  });

  it('checks status membership', () => {
    assert.equal(isTaskInStatus({ status: 'running', runVersion: 1 }, ['queued', 'running']), true);
    assert.equal(isTaskInStatus({ status: 'completed', runVersion: 1 }, ['queued', 'running']), false);
  });

  it('resolves the current task by active/unread status and update time', () => {
    const current = resolveCurrentTask(
      [
        createTask({ id: 'completed-read', status: 'completed', readAt: new Date('2026-06-20T00:00:00Z') }),
        createTask({ id: 'failed-old', status: 'failed', updatedAt: new Date('2026-06-20T00:00:01Z') }),
        createTask({ id: 'running-new', status: 'running', updatedAt: new Date('2026-06-20T00:00:02Z') })
      ],
      {
        activeStatuses: ['queued', 'running'],
        unreadTerminalStatuses: ['failed', 'completed'],
        statusWeight: { queued: 0, running: 0, failed: 1, completed: 2 }
      }
    );

    assert.equal(current?.id, 'running-new');
  });

  it('builds minimal notification metadata and typed state events', () => {
    assert.deepEqual(createTaskNotificationMetadata('task-1'), { taskId: 'task-1' });
    assert.deepEqual(
      createTaskStateChangeEvent({
        taskId: 'task-1',
        eventType: 'started',
        message: '任务开始',
        toStatus: 'running'
      }),
      {
        taskId: 'task-1',
        eventType: 'started',
        message: '任务开始',
        fromStatus: null,
        toStatus: 'running',
        metadata: null
      }
    );
  });
});

function createTask(input: Partial<{ id: string; status: 'queued' | 'running' | 'failed' | 'completed'; updatedAt: Date; readAt: Date | null }> = {}) {
  return {
    id: input.id ?? 'task',
    status: input.status ?? 'queued',
    updatedAt: input.updatedAt ?? new Date('2026-06-20T00:00:00Z'),
    readAt: input.readAt
  };
}
