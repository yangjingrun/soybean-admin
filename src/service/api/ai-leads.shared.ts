import type { CustomAxiosRequestConfig } from '@sa/axios';

export const aiLeadKeywordOptimizeTimeout = 120 * 1000;
export const aiLeadSearchOrchestrateTimeout = 180 * 1000;
export const aiLeadSearchOrchestrateStreamUrl = '/ai-leads/search-orchestrate/stream';

export type LeadSearchTaskAction = 'interrupt' | 'resume' | 'retry' | 'discard' | 'read';

/** Build the request config for the long-running AI leads keyword optimization task. */
export function buildLeadKeywordOptimizeRequestConfig(
  data: Api.AiLeads.KeywordOptimizePayload
): CustomAxiosRequestConfig {
  return {
    url: '/ai-leads/keyword-optimize',
    method: 'post',
    data,
    // AI generation can exceed the common 10s API timeout.
    timeout: aiLeadKeywordOptimizeTimeout
  };
}

/** Build the request config for current user's keyword optimization histories. */
export function buildLeadKeywordHistoryListRequestConfig(
  params: Api.AiLeads.KeywordHistoryListParams = {}
): CustomAxiosRequestConfig {
  return {
    url: '/ai-leads/keyword-histories',
    method: 'get',
    params
  };
}

/** Build the request config for saving edited keyword optimization history. */
export function buildUpdateLeadKeywordHistoryRequestConfig(
  id: string,
  data: Api.AiLeads.UpdateKeywordHistoryPayload
): CustomAxiosRequestConfig {
  return {
    url: `/ai-leads/keyword-histories/${id}`,
    method: 'patch',
    data
  };
}

/** Build the request config for deleting one keyword optimization history. */
export function buildDeleteLeadKeywordHistoryRequestConfig(id: string): CustomAxiosRequestConfig {
  return {
    url: `/ai-leads/keyword-histories/${id}`,
    method: 'delete'
  };
}

/** Build the request config for the long-running AI leads search orchestration task. */
export function buildLeadSearchOrchestrateRequestConfig(
  data: Api.AiLeads.SearchOrchestratePayload
): CustomAxiosRequestConfig {
  return {
    url: '/ai-leads/search-orchestrate',
    method: 'post',
    data,
    timeout: aiLeadSearchOrchestrateTimeout
  };
}

/** Build the request config for creating one background AI leads search task. */
export function buildCreateLeadSearchTaskRequestConfig(
  data: Api.AiLeads.CreateSearchTaskPayload
): CustomAxiosRequestConfig {
  return {
    url: '/ai-leads/search-tasks',
    method: 'post',
    data
  };
}

/** Build the request config for restoring the current user's active or unread search task. */
export function buildCurrentLeadSearchTaskRequestConfig(): CustomAxiosRequestConfig {
  return {
    url: '/ai-leads/search-tasks/current',
    method: 'get'
  };
}

/** Build the request config for reading one AI leads search task by id. */
export function buildLeadSearchTaskRequestConfig(id: string): CustomAxiosRequestConfig {
  return {
    url: `/ai-leads/search-tasks/${id}`,
    method: 'get'
  };
}

/** Build the request config for one state transition action on a search task. */
export function buildLeadSearchTaskActionRequestConfig(
  id: string,
  action: LeadSearchTaskAction
): CustomAxiosRequestConfig {
  return {
    url: `/ai-leads/search-tasks/${id}/${action}`,
    method: 'post'
  };
}

/** Build the request config for reading global AI leads queue settings. */
export function buildLeadQueueConfigRequestConfig(): CustomAxiosRequestConfig {
  return {
    url: '/ai-leads/queue-config',
    method: 'get'
  };
}

/** Build the request config for saving global AI leads queue settings. */
export function buildSaveLeadQueueConfigRequestConfig(
  data: Api.AiLeads.SaveQueueConfigPayload
): CustomAxiosRequestConfig {
  return {
    url: '/ai-leads/queue-config',
    method: 'post',
    data
  };
}

/** Build the request config for reading AI leads directory source filter rules. */
export function buildLeadDirectorySourceRuleListRequestConfig(): CustomAxiosRequestConfig {
  return {
    url: '/ai-leads/directory-source-rules',
    method: 'get'
  };
}

/** Build the request config for creating one directory source filter rule. */
export function buildCreateLeadDirectorySourceRuleRequestConfig(
  data: Api.AiLeads.SaveDirectorySourceRulePayload
): CustomAxiosRequestConfig {
  return {
    url: '/ai-leads/directory-source-rules',
    method: 'post',
    data
  };
}

/** Build the request config for updating one directory source filter rule. */
export function buildUpdateLeadDirectorySourceRuleRequestConfig(
  id: string,
  data: Api.AiLeads.SaveDirectorySourceRulePayload
): CustomAxiosRequestConfig {
  return {
    url: `/ai-leads/directory-source-rules/${id}`,
    method: 'patch',
    data
  };
}

/** Build the request config for deleting one directory source filter rule. */
export function buildDeleteLeadDirectorySourceRuleRequestConfig(id: string): CustomAxiosRequestConfig {
  return {
    url: `/ai-leads/directory-source-rules/${id}`,
    method: 'delete'
  };
}
