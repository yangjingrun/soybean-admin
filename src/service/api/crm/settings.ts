import { request } from '../../request';

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

/** Read the current user's CRM send scheduling preference. */
export function fetchCrmSendPreference() {
  return request<Api.Crm.SendPreference>({
    url: '/crm/send-preference',
    method: 'get'
  });
}

/** Save the current user's CRM send scheduling preference. */
export function saveCrmSendPreference(data: Api.Crm.SaveSendPreferencePayload) {
  return request<Api.Crm.SendPreference>({
    url: '/crm/send-preference',
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

/** List saved AI prompt versions for one organization product line. */
export function fetchCrmProductLineAiPromptVersions(id: string) {
  return request<Api.Crm.ProductLineAiPromptVersionList>({
    url: `/crm/product-lines/${id}/ai-prompt-versions`,
    method: 'get'
  });
}

/** Restore one saved AI prompt version onto the product line current config. */
export function restoreCrmProductLineAiPromptVersion(id: string, versionId: string) {
  return request<Api.Crm.ProductLineAiPromptVersionRestoreResult>({
    url: `/crm/product-lines/${id}/ai-prompt-versions/${versionId}/restore`,
    method: 'post'
  });
}

/** List organization persona profiles by filters and pagination. */
export function fetchCrmPersonaProfiles(params: Api.Crm.PersonaProfileSearchParams) {
  return request<Api.Crm.PersonaProfileList>({
    url: '/crm/persona-profiles',
    method: 'get',
    params
  });
}

/** Create one organization persona profile. */
export function createCrmPersonaProfile(data: Api.Crm.PersonaProfilePayload) {
  return request<Api.Crm.PersonaProfileOperateResult>({
    url: '/crm/persona-profiles',
    method: 'post',
    data
  });
}

/** Update one organization persona profile. */
export function updateCrmPersonaProfile(id: string, data: Partial<Api.Crm.PersonaProfilePayload>) {
  return request<Api.Crm.PersonaProfileOperateResult>({
    url: `/crm/persona-profiles/${id}`,
    method: 'patch',
    data
  });
}

/** Archive one organization persona profile. */
export function archiveCrmPersonaProfile(id: string) {
  return request<Api.Crm.PersonaProfileOperateResult>({
    url: `/crm/persona-profiles/${id}/archive`,
    method: 'patch'
  });
}

/** Mark one active organization persona profile as the default drafting profile. */
export function setDefaultCrmPersonaProfile(id: string) {
  return request<Api.Crm.PersonaProfileOperateResult>({
    url: `/crm/persona-profiles/${id}/default`,
    method: 'post'
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

/** Read local CRM sequence funnel stats grouped by strategy dimensions. */
export function fetchCrmStrategyStats() {
  return request<Api.Crm.StrategyStats>({
    url: '/crm/strategy-stats',
    method: 'get'
  });
}

/** Read the current user's CRM workbench overview. */
export function fetchCrmWorkbenchOverview() {
  return request<Api.Crm.WorkbenchOverview>({
    url: '/crm/workbench/overview',
    method: 'get'
  });
}

/** Read super-admin CRM AI draft queue config. */
export function fetchCrmAiDraftQueueConfig() {
  return request<Api.Crm.AiDraftQueueConfigRecord>({
    url: '/crm/ai-draft-queue-config',
    method: 'get'
  });
}

/** Save super-admin CRM AI draft queue config. */
export function saveCrmAiDraftQueueConfig(data: Api.Crm.AiDraftQueueConfigPayload) {
  return request<Api.Crm.AiDraftQueueConfigRecord>({
    url: '/crm/ai-draft-queue-config',
    method: 'patch',
    data
  });
}
