import { request } from '../request';

/** List organizations for organization management. */
export function fetchSystemOrganizations(params: Api.SystemOrganization.OrganizationSearchParams) {
  return request<Api.SystemOrganization.OrganizationList>({
    url: '/system-organizations',
    method: 'get',
    params
  });
}

/** List enabled organizations for user assignment controls. */
export function fetchEnabledSystemOrganizations() {
  return request<Api.SystemOrganization.OrganizationSelectItem[]>({
    url: '/system-organizations/enabled',
    method: 'get'
  });
}

/** Create one organization. */
export function createSystemOrganization(data: Api.SystemOrganization.OrganizationOperatePayload) {
  return request<Api.SystemOrganization.OrganizationListItem>({
    url: '/system-organizations',
    method: 'post',
    data
  });
}

/** Update editable organization metadata. */
export function updateSystemOrganization(id: string, data: Api.SystemOrganization.OrganizationOperatePayload) {
  return request<Api.SystemOrganization.OrganizationListItem>({
    url: `/system-organizations/${id}`,
    method: 'patch',
    data
  });
}

/** Enable or disable one organization. */
export function updateSystemOrganizationStatus(id: string, data: Api.SystemOrganization.OrganizationStatusPayload) {
  return request<Api.SystemOrganization.OrganizationListItem>({
    url: `/system-organizations/${id}/status`,
    method: 'patch',
    data
  });
}
