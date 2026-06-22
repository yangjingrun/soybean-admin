import { request } from '../../request';
/** List CRM account leads by filters and pagination. */
export function fetchCrmAccounts(params) {
  return request({
    url: '/crm/accounts',
    method: 'get',
    params
  });
}
/** Manually import one CRM lead into the current user's private lead library. */
export function importCrmLead(data) {
  return request({
    url: '/crm/accounts/import-lead',
    method: 'post',
    data
  });
}
/** Get one CRM account with contacts and timeline events. */
export function fetchCrmAccountDetail(id) {
  return request({
    url: `/crm/accounts/${id}`,
    method: 'get'
  });
}
/** Update editable CRM account profile fields from the lead detail drawer. */
export function updateCrmAccount(id, data) {
  return request({
    url: `/crm/accounts/${id}`,
    method: 'patch',
    data
  });
}
/** Update the lifecycle status of one CRM account. */
export function updateCrmAccountStatus(id, data) {
  return request({
    url: `/crm/accounts/${id}/status`,
    method: 'patch',
    data
  });
}
/** Append a manual note to one CRM account timeline. */
export function createCrmAccountNote(id, data) {
  return request({
    url: `/crm/accounts/${id}/notes`,
    method: 'post',
    data
  });
}
/** Create one manual contact under the current CRM account. */
export function createCrmContact(accountId, data) {
  return request({
    url: `/crm/accounts/${accountId}/contacts`,
    method: 'post',
    data
  });
}
/** Update one CRM contact. */
export function updateCrmContact(contactId, data) {
  return request({
    url: `/crm/contacts/${contactId}`,
    method: 'patch',
    data
  });
}
/** Delete one CRM contact. */
export function deleteCrmContact(contactId) {
  return request({
    url: `/crm/contacts/${contactId}/delete`,
    method: 'post'
  });
}
/** Verify one CRM contact email and append the backend timeline event. */
export function verifyCrmContactEmail(contactId) {
  return request({
    url: `/crm/contacts/${contactId}/verify-email`,
    method: 'post'
  });
}
/** Manually refresh provider contacts for one CRM account. */
export function refreshCrmAccountEnrichment(id, data = { provider: 'hunter' }) {
  return request({
    url: `/crm/accounts/${id}/enrichment/refresh`,
    method: 'post',
    data
  });
}
/** Archive one CRM account with an optional reason. */
export function archiveCrmAccount(id, data = {}) {
  return request({
    url: `/crm/accounts/${id}/archive`,
    method: 'post',
    data
  });
}
/** Restore one archived CRM account within the recovery window. */
export function restoreCrmAccount(id) {
  return request({
    url: `/crm/accounts/${id}/restore`,
    method: 'post'
  });
}
