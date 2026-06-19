import { request } from '../request';

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

/** Read platform-wide CRM settings. */
export function fetchCrmGlobalConfig() {
  return request<Api.Crm.GlobalConfig>({
    url: '/crm/global-config',
    method: 'get'
  });
}

/** Save platform-wide CRM settings. */
export function saveCrmGlobalConfig(data: Api.Crm.SaveGlobalConfigPayload) {
  return request<Api.Crm.GlobalConfig>({
    url: '/crm/global-config',
    method: 'post',
    data
  });
}

/** Read organization-level CRM permission settings. */
export function fetchCrmOrganizationConfig() {
  return request<Api.Crm.OrganizationConfig>({
    url: '/crm/organization-config',
    method: 'get'
  });
}

/** Save organization-level CRM permission settings. */
export function saveCrmOrganizationConfig(data: Api.Crm.SaveOrganizationConfigPayload) {
  return request<Api.Crm.OrganizationConfig>({
    url: '/crm/organization-config',
    method: 'post',
    data
  });
}

/** List organization unsubscribe blacklist entries. */
export function fetchCrmBlacklistEntries(params: Api.Crm.BlacklistSearchParams) {
  return request<Api.Crm.BlacklistList>({
    url: '/crm/blacklist-entries',
    method: 'get',
    params
  });
}

/** Remove one organization unsubscribe blacklist entry with an audit reason. */
export function removeCrmBlacklistEntry(id: string, data: Api.Crm.BlacklistRemovePayload) {
  return request<Api.Crm.BlacklistRemoveResult>({
    url: `/crm/blacklist-entries/${id}`,
    method: 'delete',
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

/** List CRM mailboxes by filters and pagination. */
export function fetchCrmMailboxes(params: Api.Crm.MailboxSearchParams) {
  return request<Api.Crm.MailboxList>({
    url: '/crm/mailboxes',
    method: 'get',
    params
  });
}

/** Create the Google OAuth consent URL for authorizing a Gmail mailbox. */
export function createCrmGmailOAuthUrl() {
  return request<Api.Crm.GmailOAuthUrlResult>({
    url: '/crm/mailboxes/gmail/oauth-url',
    method: 'post'
  });
}

/** Complete Gmail OAuth after Google redirects back with code and state. */
export function completeCrmGmailOAuthCallback(data: Api.Crm.GmailOAuthCallbackPayload) {
  return request<Api.Crm.MailboxWatchRenewResult>({
    url: '/crm/mailboxes/gmail/oauth-callback',
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

/** Renew Gmail watch for one active CRM mailbox. */
export function renewCrmMailboxWatch(id: string) {
  return request<Api.Crm.MailboxWatchRenewResult>({
    url: `/crm/mailboxes/${id}/renew-watch`,
    method: 'post'
  });
}

/** Enqueue an immediate Gmail history sync for one active CRM mailbox. */
export function syncCrmMailboxNow(id: string) {
  return request<Api.Crm.MailboxSyncNowResult>({
    url: `/crm/mailboxes/${id}/sync-now`,
    method: 'post'
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

/** List organization email template groups by filters and pagination. */
export function fetchCrmEmailTemplateGroups(params: Api.Crm.EmailTemplateSearchParams) {
  return request<Api.Crm.EmailTemplateList>({
    url: '/crm/email-template-groups',
    method: 'get',
    params
  });
}

/** Create one organization email template group. */
export function createCrmEmailTemplateGroup(data: Api.Crm.EmailTemplatePayload) {
  return request<Api.Crm.EmailTemplateOperateResult>({
    url: '/crm/email-template-groups',
    method: 'post',
    data
  });
}

/** Update one organization email template group. */
export function updateCrmEmailTemplateGroup(id: string, data: Partial<Api.Crm.EmailTemplatePayload>) {
  return request<Api.Crm.EmailTemplateOperateResult>({
    url: `/crm/email-template-groups/${id}`,
    method: 'patch',
    data
  });
}

/** Archive one organization email template group. */
export function archiveCrmEmailTemplateGroup(id: string) {
  return request<Api.Crm.EmailTemplateOperateResult>({
    url: `/crm/email-template-groups/${id}/archive`,
    method: 'patch'
  });
}

/** Mark one active organization email template group as the default drafting template. */
export function setDefaultCrmEmailTemplateGroup(id: string) {
  return request<Api.Crm.EmailTemplateOperateResult>({
    url: `/crm/email-template-groups/${id}/default`,
    method: 'post'
  });
}

/** List organization sequence policies by filters and pagination. */
export function fetchCrmSequencePolicies(params: Api.Crm.SequencePolicySearchParams) {
  return request<Api.Crm.SequencePolicyList>({
    url: '/crm/sequence-policies',
    method: 'get',
    params
  });
}

/** Create one organization sequence policy. */
export function createCrmSequencePolicy(data: Api.Crm.SequencePolicyPayload) {
  return request<Api.Crm.SequencePolicyOperateResult>({
    url: '/crm/sequence-policies',
    method: 'post',
    data
  });
}

/** Update one organization sequence policy. */
export function updateCrmSequencePolicy(id: string, data: Partial<Api.Crm.SequencePolicyPayload>) {
  return request<Api.Crm.SequencePolicyOperateResult>({
    url: `/crm/sequence-policies/${id}`,
    method: 'patch',
    data
  });
}

/** Archive one organization sequence policy. */
export function archiveCrmSequencePolicy(id: string) {
  return request<Api.Crm.SequencePolicyOperateResult>({
    url: `/crm/sequence-policies/${id}/archive`,
    method: 'patch'
  });
}

/** Mark one active organization sequence policy as default. */
export function setDefaultCrmSequencePolicy(id: string) {
  return request<Api.Crm.SequencePolicyOperateResult>({
    url: `/crm/sequence-policies/${id}/default`,
    method: 'post'
  });
}

/** Get the read-only default email template and persona profiles. */
export function fetchCrmTemplateDefaults() {
  return request<Api.Crm.TemplateDefaults>({
    url: '/crm/template-defaults',
    method: 'get'
  });
}

/** List sequence review items by filters and pagination. */
export function fetchCrmSequenceReviewItems(params: Api.Crm.SequenceReviewSearchParams) {
  return request<Api.Crm.SequenceReviewList>({
    url: '/crm/sequence-review-items',
    method: 'get',
    params
  });
}

/** Create one sequence review item and its deterministic first draft. */
export function createCrmSequenceReviewItem(data: Api.Crm.SequenceReviewCreatePayload) {
  return request<Api.Crm.SequenceReviewOperateResult>({
    url: '/crm/sequence-review-items',
    method: 'post',
    data
  });
}

/** Get one sequence review item with messages and checklist. */
export function fetchCrmSequenceReviewItem(id: string) {
  return request<Api.Crm.SequenceReviewItem>({
    url: `/crm/sequence-review-items/${id}`,
    method: 'get'
  });
}

/** Save human edits to one sequence draft. */
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

/** Generate the next local follow-up draft for one sequence without queueing it. */
export function generateCrmNextSequenceDraft(enrollmentId: string) {
  return request<Api.Crm.MessageNextDraftGenerateResult>({
    url: `/crm/sequence-review-items/${enrollmentId}/generate-next-draft`,
    method: 'post'
  });
}

/** Start the first approved message by putting it into the CRM send queue. */
export function startCrmFirstMessageSend(enrollmentId: string) {
  return request<Api.Crm.MessageSendStartResult>({
    url: `/crm/sequence-review-items/${enrollmentId}/start-send`,
    method: 'post'
  });
}

/** Stop one sequence and invalidate queued CRM send jobs. */
export function stopCrmSequenceEnrollment(enrollmentId: string) {
  return request<Api.Crm.SequenceStopResult>({
    url: `/crm/sequence-review-items/${enrollmentId}/stop`,
    method: 'post'
  });
}

/** List CRM inbound reply threads by filters and pagination. */
export function fetchCrmInboxThreads(params: Api.Crm.InboxThreadSearchParams) {
  return request<Api.Crm.InboxThreadList>({
    url: '/crm/inbox-threads',
    method: 'get',
    params
  });
}

/** Get one CRM inbound reply thread with messages and related CRM records. */
export function fetchCrmInboxThreadDetail(id: string) {
  return request<Api.Crm.InboxThreadDetail>({
    url: `/crm/inbox-threads/${id}`,
    method: 'get'
  });
}

/** Update the handling status of one inbound reply thread. */
export function updateCrmInboxThreadStatus(id: string, data: Api.Crm.InboxThreadStatusPayload) {
  return request<Api.Crm.InboxThreadStatusResult>({
    url: `/crm/inbox-threads/${id}/status`,
    method: 'patch',
    data
  });
}

/** Reply to one CRM inbox thread with plain text from the bound mailbox. */
export function replyCrmInboxThread(id: string, data: Api.Crm.InboxReplyPayload) {
  return request<Api.Crm.InboxThreadDetail>({
    url: `/crm/inbox-threads/${id}/reply`,
    method: 'post',
    data
  });
}
