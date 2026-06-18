import { request } from '../request';

/** List CRM account leads by filters and pagination. */
export function fetchCrmAccounts(params: Api.Crm.LeadSearchParams) {
  return request<Api.Crm.LeadList>({
    url: '/crm/accounts',
    method: 'get',
    params
  });
}

/** Get one CRM account with contacts and timeline events. */
export function fetchCrmAccountDetail(id: string) {
  return request<Api.Crm.LeadDetail>({
    url: `/crm/accounts/${id}`,
    method: 'get'
  });
}

/** Update the lifecycle status of one CRM account. */
export function updateCrmAccountStatus(id: string, data: Api.Crm.LeadStatusPayload) {
  return request<Api.Crm.LeadStatusResult>({
    url: `/crm/accounts/${id}/status`,
    method: 'patch',
    data
  });
}

/** Append a manual note to one CRM account timeline. */
export function createCrmAccountNote(id: string, data: Api.Crm.LeadNotePayload) {
  return request<Api.Crm.LeadNoteResult>({
    url: `/crm/accounts/${id}/notes`,
    method: 'post',
    data
  });
}

/** Archive one CRM account with an optional reason. */
export function archiveCrmAccount(id: string, data: Api.Crm.LeadArchivePayload = {}) {
  return request<Api.Crm.LeadArchiveResult>({
    url: `/crm/accounts/${id}/archive`,
    method: 'post',
    data
  });
}
