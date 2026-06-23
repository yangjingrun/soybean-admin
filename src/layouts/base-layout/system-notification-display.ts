import type { NotificationType } from 'naive-ui';

export type SystemNotificationDisplayMode = 'popup' | 'silent-read';

export interface SystemNotificationDisplayPolicy {
  mode: SystemNotificationDisplayMode;
  type: NotificationType;
  duration: number;
}

const taskFailureTypes = new Set(['task_failed', 'crm_ai_draft_task_failed']);
const transientFailurePattern = /model_cooldown|cooling down|rate limit|timeout|timed out|temporarily|稍后|冷却/i;
const actionRequiredFailurePattern = /请.*(查看|回到|配置|处理|审核|重试)|未配置|配置不完整|不可用|失败项|需要.*(查看|处理|配置|审核|重试)/i;

/** Resolves how noisy one notification should be in the global popup layer. */
export function resolveSystemNotificationDisplayPolicy(
  item: Api.SystemNotification.SystemNotification
): SystemNotificationDisplayPolicy {
  if (isTaskFailureNotification(item) && shouldRequireUserAction(item)) {
    return {
      mode: 'popup',
      type: 'warning',
      duration: 0
    };
  }

  if (isTaskFailureNotification(item) && item.status === 'shown') {
    return {
      mode: 'silent-read',
      type: 'warning',
      duration: 0
    };
  }

  if (isTaskFailureNotification(item)) {
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

function isTaskFailureNotification(item: Api.SystemNotification.SystemNotification) {
  return taskFailureTypes.has(item.type);
}

/** Checks failure copy for explicit user work instead of treating every failure as noise. */
function shouldRequireUserAction(item: Api.SystemNotification.SystemNotification) {
  if (!item.routePath) {
    return false;
  }

  const text = `${item.title}\n${item.content}`;

  if (transientFailurePattern.test(text)) {
    return false;
  }

  return actionRequiredFailurePattern.test(text);
}
