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
