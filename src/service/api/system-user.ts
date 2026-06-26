import { request } from '../request';

/** List users for the lightweight user management page. */
export function fetchSystemUsers(params: Api.SystemUser.UserSearchParams) {
  return request<Api.SystemUser.UserList>({
    url: '/system-users',
    method: 'get',
    params
  });
}

/** Create a system user and receive the one-time temporary password. */
export function createSystemUser(data: Api.SystemUser.UserCreatePayload) {
  return request<Api.SystemUser.UserWithTemporaryPassword>({
    url: '/system-users',
    method: 'post',
    data
  });
}

/** Update editable profile, role, status and expiry fields for one system user. */
export function updateSystemUser(id: string, data: Api.SystemUser.UserUpdatePayload) {
  return request<Api.SystemUser.UserListItem>({
    url: `/system-users/${id}`,
    method: 'patch',
    data
  });
}

/** Enable or disable one system user. */
export function updateSystemUserStatus(id: string, data: Api.SystemUser.UserStatusPayload) {
  return request<Api.SystemUser.UserListItem>({
    url: `/system-users/${id}/status`,
    method: 'patch',
    data
  });
}

/** Reset one system user's password and receive the one-time temporary password. */
export function resetSystemUserPassword(id: string) {
  return request<Api.SystemUser.UserWithTemporaryPassword>({
    url: `/system-users/${id}/reset-password`,
    method: 'post'
  });
}
