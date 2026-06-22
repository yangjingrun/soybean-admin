import { request } from '../request';
/** List organizations for organization management. */
export function fetchSystemOrganizations(params) {
  return request({
    url: '/system-organizations',
    method: 'get',
    params
  });
}
/** List enabled organizations for user assignment controls. */
export function fetchEnabledSystemOrganizations() {
  return request({
    url: '/system-organizations/enabled',
    method: 'get'
  });
}
/** Create one organization. */
export function createSystemOrganization(data) {
  return request({
    url: '/system-organizations',
    method: 'post',
    data
  });
}
/** Update editable organization metadata. */
export function updateSystemOrganization(id, data) {
  return request({
    url: `/system-organizations/${id}`,
    method: 'patch',
    data
  });
}
/** Enable or disable one organization. */
export function updateSystemOrganizationStatus(id, data) {
  return request({
    url: `/system-organizations/${id}/status`,
    method: 'patch',
    data
  });
}
