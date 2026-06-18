import { request } from '../request';
import { buildLeadKeywordOptimizeRequestConfig, buildLeadSearchOrchestrateRequestConfig } from './ai-leads.shared';

/** Optimize natural-language lead requirements into keyword strategy through the AI leads workflow. */
export function optimizeLeadKeywords(data: Api.AiLeads.KeywordOptimizePayload) {
  return request<Api.AiGateway.AiTextResult>(buildLeadKeywordOptimizeRequestConfig(data));
}

/** Run keyword optimization, Serper search, and search-result decisions as one backend workflow. */
export function searchLeadCustomers(data: Api.AiLeads.SearchOrchestratePayload) {
  return request<Api.AiLeads.SearchOrchestrateResult>(buildLeadSearchOrchestrateRequestConfig(data));
}
