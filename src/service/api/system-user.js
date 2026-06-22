import { request } from '../request';
/** List users for the lightweight user management page. */
export function fetchSystemUsers(params) {
  return request({
    url: '/system-users',
    method: 'get',
    params
  });
}
/** Create a system user and receive the one-time temporary password. */
export function createSystemUser(data) {
  return request({
    url: '/system-users',
    method: 'post',
    data
  });
}
/** Update editable profile, role, status and expiry fields for one system user. */
export function updateSystemUser(id, data) {
  return request({
    url: `/system-users/${id}`,
    method: 'patch',
    data
  });
}
/** Enable or disable one system user. */
export function updateSystemUserStatus(id, data) {
  return request({
    url: `/system-users/${id}/status`,
    method: 'patch',
    data
  });
}
/** Reset one system user's password and receive the one-time temporary password. */
export function resetSystemUserPassword(id) {
  return request({
    url: `/system-users/${id}/reset-password`,
    method: 'post'
  });
}
