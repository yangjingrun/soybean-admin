import { request } from '../request';

/** List pending system notifications for the current user. */
export function fetchPendingSystemNotifications() {
  return request<Api.SystemNotification.SystemNotification[]>({
    url: '/system-notifications/pending',
    method: 'get'
  });
}

/** Mark one system notification as shown after the client displays it. */
export function markSystemNotificationShown(id: string) {
  return request<Api.SystemNotification.SystemNotification>({
    url: `/system-notifications/${id}/shown`,
    method: 'post'
  });
}

/** Mark one system notification as read after the user handles it. */
export function markSystemNotificationRead(id: string) {
  return request<Api.SystemNotification.SystemNotification>({
    url: `/system-notifications/${id}/read`,
    method: 'post'
  });
}
