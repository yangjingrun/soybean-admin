import { request } from '../../request';

/** List CRM account leads by filters and pagination. */
export function fetchCrmAccounts(params: Api.Crm.LeadSearchParams) {
  return request<Api.Crm.LeadList>({
    url: '/crm/accounts',
    method: 'get',
    params
  });
}

/** Manually import one CRM lead into the current user's private lead library. */
export function importCrmLead(data: Api.Crm.LeadImportPayload) {
  return request<Api.Crm.LeadImportResult>({
    url: '/crm/accounts/import-lead',
    method: 'post',
    data
  });
}

/** Get one CRM account with contacts and timeline events. */
export function fetchCrmAccountDetail(id: string) {
  return request<Api.Crm.LeadDetail>({
    url: `/crm/accounts/${id}`,
    method: 'get'
  });
}

/** Update editable CRM account profile fields from the lead detail drawer. */
export function updateCrmAccount(id: string, data: Api.Crm.LeadAccountUpdatePayload) {
  return request<Api.Crm.LeadAccountUpdateResult>({
    url: `/crm/accounts/${id}`,
    method: 'patch',
    data
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

/** Create one manual contact under the current CRM account. */
export function createCrmContact(accountId: string, data: Api.Crm.LeadContactCreatePayload) {
  return request<Api.Crm.LeadContactMutateResult>({
    url: `/crm/accounts/${accountId}/contacts`,
    method: 'post',
    data
  });
}

/** Update one CRM contact. */
export function updateCrmContact(contactId: string, data: Api.Crm.LeadContactUpdatePayload) {
  return request<Api.Crm.LeadContactMutateResult>({
    url: `/crm/contacts/${contactId}`,
    method: 'patch',
    data
  });
}

/** Delete one CRM contact. */
export function deleteCrmContact(contactId: string) {
  return request<Api.Crm.LeadContactMutateResult>({
    url: `/crm/contacts/${contactId}/delete`,
    method: 'post'
  });
}

/** Verify one CRM contact email and append the backend timeline event. */
export function verifyCrmContactEmail(contactId: string) {
  return request<Api.Crm.LeadContactEmailVerifyResult>({
    url: `/crm/contacts/${contactId}/verify-email`,
    method: 'post'
  });
}

/** Manually refresh provider contacts for one CRM account. */
export function refreshCrmAccountEnrichment(
  id: string,
  data: Api.Crm.LeadEnrichmentRefreshPayload = { provider: 'hunter' }
) {
  return request<Api.Crm.LeadEnrichmentRefreshResult>({
    url: `/crm/accounts/${id}/enrichment/refresh`,
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

/** Restore one archived CRM account within the recovery window. */
export function restoreCrmAccount(id: string) {
  return request<Api.Crm.LeadRestoreResult>({
    url: `/crm/accounts/${id}/restore`,
    method: 'post'
  });
}
