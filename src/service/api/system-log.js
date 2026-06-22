import { request } from '../request';
/** Query system logs by filters and pagination. */
export function fetchSystemLogs(params) {
  return request({
    url: '/system-logs',
    params
  });
}
/** Get one system log detail by id. */
export function fetchSystemLogDetail(id) {
  return request({
    url: `/system-logs/${id}`
  });
}
/** Get users that can be used by the log filter. */
export function fetchSystemLogUsers() {
  return request({
    url: '/system-logs/users'
  });
}
