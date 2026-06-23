import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveSystemNotificationDisplayPolicy } from './system-notification-display';

describe('system notification display policy', () => {
  it('shows the first failed task notification as a short warning', () => {
    const policy = resolveSystemNotificationDisplayPolicy(createNotification({ type: 'task_failed' }));

    assert.deepEqual(policy, {
      mode: 'popup',
      type: 'warning',
      duration: 6000
    });
  });

  it('silently reads failed task notifications that were already shown once', () => {
    const policy = resolveSystemNotificationDisplayPolicy(createNotification({ type: 'task_failed', status: 'shown' }));

    assert.deepEqual(policy, {
      mode: 'silent-read',
      type: 'warning',
      duration: 0
    });
  });

  it('keeps completed task notifications visible until the user handles them', () => {
    const policy = resolveSystemNotificationDisplayPolicy(
      createNotification({ type: 'task_completed', status: 'shown' })
    );

    assert.deepEqual(policy, {
      mode: 'popup',
      type: 'success',
      duration: 8000
    });
  });
});

function createNotification(
  overrides: Partial<Api.SystemNotification.SystemNotification> = {}
): Api.SystemNotification.SystemNotification {
  return {
    id: 'notification-1',
    userId: 'u-1',
    userName: 'AI外贸管理系统',
    module: 'ai-leads',
    type: 'task_failed',
    title: '采集任务失败',
    content: '模型通道暂不可用',
    targetType: 'aiLeadSearchTask',
    targetId: 'task-1',
    routePath: '/ai-leads?taskId=task-1',
    status: 'pending',
    shownAt: null,
    readAt: null,
    metadata: null,
    createdAt: '2026-06-23T00:00:00.000Z',
    updatedAt: '2026-06-23T00:00:00.000Z',
    ...overrides
  };
}
