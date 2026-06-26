import { request } from '../request';

/** List roles for role management and permission assignment. */
export function fetchSystemRoles(params: Api.SystemRole.RoleSearchParams) {
  return request<Api.SystemRole.RoleList>({
    url: '/system-roles',
    method: 'get',
    params
  });
}

/** List enabled roles for user role assignment controls. */
export function fetchEnabledSystemRoles() {
  return request<Api.SystemRole.RoleListItem[]>({
    url: '/system-roles/enabled',
    method: 'get'
  });
}

/** Create one role. Permissions are configured on the role after creation. */
export function createSystemRole(data: Api.SystemRole.RoleCreatePayload) {
  return request<Api.SystemRole.RoleListItem>({
    url: '/system-roles',
    method: 'post',
    data
  });
}

/** Update editable role metadata. */
export function updateSystemRole(id: string, data: Api.SystemRole.RoleUpdatePayload) {
  return request<Api.SystemRole.RoleListItem>({
    url: `/system-roles/${id}`,
    method: 'patch',
    data
  });
}

/** Update permissions assigned to one role. */
export function updateSystemRolePermissions(id: string, data: Api.SystemRole.RolePermissionsPayload) {
  return request<Api.SystemRole.RoleListItem>({
    url: `/system-roles/${id}/permissions`,
    method: 'patch',
    data
  });
}
