import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AuthService } from '../auth/auth.service';
import { SystemNotificationController } from './system-notification.controller';
import type { SystemNotificationService } from './system-notification.service';
import type { SystemNotificationView } from './system-notification.types';

describe('SystemNotificationController', () => {
  it('lists pending notifications for the bearer token user', async () => {
    const service = createSystemNotificationService();
    const controller = new SystemNotificationController(service, createAuthService());

    const result = await controller.pending('Bearer access-token');

    assert.equal(service.lastListUserId, 'u-1');
    assert.deepEqual(result, {
      code: '0000',
      msg: 'ok',
      data: [
        {
          id: 'notification-1',
          userId: 'u-1',
          userName: 'tester',
          module: 'ai-leads',
          type: 'task_finished',
          title: '采集任务已完成',
          content: 'AI 获客采集任务已完成',
          targetType: 'aiLeadSearchTask',
          targetId: 'task-1',
          routePath: '/ai-leads/search-tasks',
          status: 'pending',
          shownAt: null,
          readAt: null,
          metadata: null,
          createdAt: '2026-06-18T01:00:00.000Z',
          updatedAt: '2026-06-18T01:00:00.000Z'
        }
      ]
    });
  });

  it('marks notifications shown and read for the bearer token user', async () => {
    const service = createSystemNotificationService();
    const controller = new SystemNotificationController(service, createAuthService());

    await controller.shown('notification-1', 'Bearer access-token');
    const readResult = await controller.read('notification-1', 'Bearer access-token');

    assert.deepEqual(service.lastShownArgs, {
      id: 'notification-1',
      userId: 'u-1'
    });
    assert.deepEqual(service.lastReadArgs, {
      id: 'notification-1',
      userId: 'u-1'
    });
    assert.equal(readResult.code, '0000');
    assert.equal(readResult.data.status, 'read');
  });
});

function createNotification(overrides: Partial<SystemNotificationView> = {}): SystemNotificationView {
  return {
    id: 'notification-1',
    userId: 'u-1',
    userName: 'tester',
    module: 'ai-leads',
    type: 'task_finished',
    title: '采集任务已完成',
    content: 'AI 获客采集任务已完成',
    targetType: 'aiLeadSearchTask',
    targetId: 'task-1',
    routePath: '/ai-leads/search-tasks',
    status: 'pending',
    shownAt: null,
    readAt: null,
    metadata: null,
    createdAt: '2026-06-18T01:00:00.000Z',
    updatedAt: '2026-06-18T01:00:00.000Z',
    ...overrides
  };
}

function createSystemNotificationService() {
  const service = {
    lastListUserId: null as string | null,
    lastShownArgs: null as { id: string; userId: string } | null,
    lastReadArgs: null as { id: string; userId: string } | null,
    async listPendingForUser(userId: string) {
      service.lastListUserId = userId;

      return [createNotification()];
    },
    async markShown(id: string, userId: string) {
      service.lastShownArgs = { id, userId };

      return createNotification({
        status: 'shown',
        shownAt: '2026-06-18T02:00:00.000Z'
      });
    },
    async markRead(id: string, userId: string) {
      service.lastReadArgs = { id, userId };

      return createNotification({
        status: 'read',
        readAt: '2026-06-18T02:00:00.000Z'
      });
    }
  } as unknown as SystemNotificationService & {
    lastListUserId: string | null;
    lastShownArgs: { id: string; userId: string } | null;
    lastReadArgs: { id: string; userId: string } | null;
  };

  return service;
}

function createAuthService(): AuthService {
  return {
    getUserByAccessToken(token: string) {
      return token === 'access-token'
        ? {
            userId: 'u-1',
            userName: 'tester',
            roles: ['R_ADMIN'],
            buttons: []
          }
        : null;
    }
  } as unknown as AuthService;
}
