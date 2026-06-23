import type { NotificationType } from 'naive-ui';

export type SystemNotificationDisplayMode = 'popup' | 'silent-read';

export interface SystemNotificationDisplayPolicy {
  mode: SystemNotificationDisplayMode;
  type: NotificationType;
  duration: number;
}

/** Resolves how noisy one notification should be in the global popup layer. */
export function resolveSystemNotificationDisplayPolicy(
  item: Api.SystemNotification.SystemNotification
): SystemNotificationDisplayPolicy {
  if (item.type === 'task_failed' && item.status === 'shown') {
    return {
      mode: 'silent-read',
      type: 'warning',
      duration: 0
    };
  }

  if (item.type === 'task_failed') {
    return {
      mode: 'popup',
      type: 'warning',
      duration: 6000
    };
  }

  if (item.type === 'task_completed') {
    return {
      mode: 'popup',
      type: 'success',
      duration: 8000
    };
  }

  return {
    mode: 'popup',
    type: 'info',
    duration: 6000
  };
}
