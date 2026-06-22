import { request } from '../request';
/** List roles for role management and permission assignment. */
export function fetchSystemRoles(params) {
  return request({
    url: '/system-roles',
    method: 'get',
    params
  });
}
/** List enabled roles for user role assignment controls. */
export function fetchEnabledSystemRoles() {
  return request({
    url: '/system-roles/enabled',
    method: 'get'
  });
}
/** Create one role. Permissions are configured on the role after creation. */
export function createSystemRole(data) {
  return request({
    url: '/system-roles',
    method: 'post',
    data
  });
}
/** Update editable role metadata. */
export function updateSystemRole(id, data) {
  return request({
    url: `/system-roles/${id}`,
    method: 'patch',
    data
  });
}
/** Update permissions assigned to one role. */
export function updateSystemRolePermissions(id, data) {
  return request({
    url: `/system-roles/${id}/permissions`,
    method: 'patch',
    data
  });
}
