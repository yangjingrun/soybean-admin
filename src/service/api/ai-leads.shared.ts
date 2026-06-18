import type { CustomAxiosRequestConfig } from '@sa/axios';

export const aiLeadKeywordOptimizeTimeout = 120 * 1000;
export const aiLeadSearchOrchestrateTimeout = 180 * 1000;

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
