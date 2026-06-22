import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { handleSystemNotificationRouteAction } from './system-notification-action';
describe('system notification route action', () => {
  it('marks the notification read before navigating to its target route', async () => {
    const calls = [];
    await handleSystemNotificationRouteAction({
      id: 'notification-1',
      routePath: '/ai-leads',
      destroyNotice: () => {
        calls.push('destroy');
      },
      markRead: async id => {
        calls.push(`read:${id}`);
      },
      pushRoute: async routePath => {
        calls.push(`push:${routePath}`);
      }
    });
    assert.deepEqual(calls, ['destroy', 'read:notification-1', 'push:/ai-leads']);
  });
});
