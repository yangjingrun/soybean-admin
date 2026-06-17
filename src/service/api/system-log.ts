import { request } from '../request';

/** Query system logs by filters and pagination. */
export function fetchSystemLogs(params: Api.SystemLog.SystemLogSearchParams) {
  return request<Api.Common.PaginatingQueryRecord<Api.SystemLog.SystemLogRecord>>({
    url: '/system-logs',
    params
  });
}

/** Get one system log detail by id. */
export function fetchSystemLogDetail(id: string) {
  return request<Api.SystemLog.SystemLogRecord>({
    url: `/system-logs/${id}`
  });
}

/** Get users that can be used by the log filter. */
export function fetchSystemLogUsers() {
  return request<Api.SystemLog.SystemLogUser[]>({
    url: '/system-logs/users'
  });
}
