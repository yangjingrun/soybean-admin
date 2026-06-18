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

/** Verify one CRM contact email and append the backend timeline event. */
export function verifyCrmContactEmail(contactId: string) {
  return request<Api.Crm.LeadContactEmailVerifyResult>({
    url: `/crm/contacts/${contactId}/verify-email`,
    method: 'post'
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

/** List CRM mailboxes by filters and pagination. */
export function fetchCrmMailboxes(params: Api.Crm.MailboxSearchParams) {
  return request<Api.Crm.MailboxList>({
    url: '/crm/mailboxes',
    method: 'get',
    params
  });
}

/** Create a mocked Gmail authorization record before the real OAuth flow is wired. */
export function mockAuthorizeCrmMailbox(data: Api.Crm.MailboxAuthorizePayload) {
  return request<Api.Crm.MailboxOperateResult>({
    url: '/crm/mailboxes/mock-authorize',
    method: 'post',
    data
  });
}

/** Pause one CRM mailbox. */
export function pauseCrmMailbox(id: string) {
  return request<Api.Crm.MailboxOperateResult>({
    url: `/crm/mailboxes/${id}/pause`,
    method: 'patch'
  });
}

/** Resume one CRM mailbox. */
export function resumeCrmMailbox(id: string) {
  return request<Api.Crm.MailboxOperateResult>({
    url: `/crm/mailboxes/${id}/resume`,
    method: 'patch'
  });
}

/** List organization product lines by filters and pagination. */
export function fetchCrmProductLines(params: Api.Crm.ProductLineSearchParams) {
  return request<Api.Crm.ProductLineList>({
    url: '/crm/product-lines',
    method: 'get',
    params
  });
}

/** Create one organization product line profile. */
export function createCrmProductLine(data: Api.Crm.ProductLinePayload) {
  return request<Api.Crm.ProductLineOperateResult>({
    url: '/crm/product-lines',
    method: 'post',
    data
  });
}

/** Update one organization product line profile. */
export function updateCrmProductLine(id: string, data: Partial<Api.Crm.ProductLinePayload>) {
  return request<Api.Crm.ProductLineOperateResult>({
    url: `/crm/product-lines/${id}`,
    method: 'patch',
    data
  });
}

/** Archive one organization product line profile. */
export function archiveCrmProductLine(id: string) {
  return request<Api.Crm.ProductLineOperateResult>({
    url: `/crm/product-lines/${id}/archive`,
    method: 'patch'
  });
}

/** List first-email sequence review items by filters and pagination. */
export function fetchCrmSequenceReviewItems(params: Api.Crm.SequenceReviewSearchParams) {
  return request<Api.Crm.SequenceReviewList>({
    url: '/crm/sequence-review-items',
    method: 'get',
    params
  });
}

/** Create one first-email review item and deterministic draft. */
export function createCrmSequenceReviewItem(data: Api.Crm.SequenceReviewCreatePayload) {
  return request<Api.Crm.SequenceReviewOperateResult>({
    url: '/crm/sequence-review-items',
    method: 'post',
    data
  });
}

/** Get one first-email review item with draft and checklist. */
export function fetchCrmSequenceReviewItem(id: string) {
  return request<Api.Crm.SequenceReviewItem>({
    url: `/crm/sequence-review-items/${id}`,
    method: 'get'
  });
}

/** Save human edits to one first-email draft. */
export function updateCrmMessageDraft(id: string, data: Api.Crm.MessageDraftPayload) {
  return request<Api.Crm.MessageDraftUpdateResult>({
    url: `/crm/messages/${id}/draft`,
    method: 'patch',
    data
  });
}

/** Approve one reviewed draft without queueing or sending it. */
export function approveCrmMessageDraft(id: string) {
  return request<Api.Crm.MessageDraftApproveResult>({
    url: `/crm/messages/${id}/approve`,
    method: 'post'
  });
}
