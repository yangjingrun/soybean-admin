import { request } from '../request';

/** List users for the lightweight user management page. */
export function fetchSystemUsers(params: Api.SystemUser.UserSearchParams) {
  return request<Api.SystemUser.UserList>({
    url: '/system-users',
    method: 'get',
    params
  });
}
