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
  it('silently reads transient failed task notifications that were already shown once', () => {
    const policy = resolveSystemNotificationDisplayPolicy(
      createNotification({
        type: 'task_failed',
        status: 'shown',
        content:
          '大模型调用失败：Failed after 3 attempts. Last error: {"error":{"code":"model_cooldown","message":"All credentials for model gpt-5.4 are cooling down"}}'
      })
    );
    assert.deepEqual(policy, {
      mode: 'silent-read',
      type: 'warning',
      duration: 0
    });
  });
  it('keeps action-required failed notifications visible until the user clicks view', () => {
    const policy = resolveSystemNotificationDisplayPolicy(
      createNotification({
        type: 'crm_ai_draft_task_failed',
        status: 'shown',
        content: '部分 CRM AI 草稿生成失败，请回到邮件序列页查看。'
      })
    );
    assert.deepEqual(policy, {
      mode: 'popup',
      type: 'warning',
      duration: 0
    });
  });
  it('keeps missing-configuration failures visible because the user must fix them', () => {
    const policy = resolveSystemNotificationDisplayPolicy(
      createNotification({
        type: 'task_failed',
        status: 'shown',
        content: '请先配置个人模型通道'
      })
    );
    assert.deepEqual(policy, {
      mode: 'popup',
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
function createNotification(overrides = {}) {
  return {
    id: 'notification-1',
    userId: 'u-1',
    userName: 'AI外贸管理系统',
    module: 'ai-leads',
    type: 'task_failed',
    title: '采集任务失败',
    content: '任务处理失败',
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
