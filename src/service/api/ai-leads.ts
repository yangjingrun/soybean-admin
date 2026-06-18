import { request } from '../request';
export { streamLeadCustomerSearch } from './ai-leads.stream';
import {
  buildDeleteLeadKeywordHistoryRequestConfig,
  buildLeadKeywordHistoryListRequestConfig,
  buildLeadKeywordOptimizeRequestConfig,
  buildLeadSearchOrchestrateRequestConfig,
  buildUpdateLeadKeywordHistoryRequestConfig
} from './ai-leads.shared';

/** Optimize natural-language lead requirements into keyword strategy through the AI leads workflow. */
export function optimizeLeadKeywords(data: Api.AiLeads.KeywordOptimizePayload) {
  return request<Api.AiLeads.KeywordOptimizeResult>(buildLeadKeywordOptimizeRequestConfig(data));
}

/** List current user's keyword optimization histories, newest first. */
export function fetchLeadKeywordHistories(params?: Api.AiLeads.KeywordHistoryListParams) {
  return request<Api.AiLeads.KeywordHistoryListResult>(buildLeadKeywordHistoryListRequestConfig(params));
}

/** Save edited keyword optimization content for one history record. */
export function updateLeadKeywordHistory(id: string, data: Api.AiLeads.UpdateKeywordHistoryPayload) {
  return request<Api.AiLeads.KeywordHistoryRecord>(buildUpdateLeadKeywordHistoryRequestConfig(id, data));
}

/** Delete one keyword optimization history owned by the current user. */
export function deleteLeadKeywordHistory(id: string) {
  return request<Api.AiLeads.KeywordHistoryDeleteResult>(buildDeleteLeadKeywordHistoryRequestConfig(id));
}

/** Run keyword optimization, Serper search, and search-result decisions as one backend workflow. */
export function searchLeadCustomers(data: Api.AiLeads.SearchOrchestratePayload) {
  return request<Api.AiLeads.SearchOrchestrateResult>(buildLeadSearchOrchestrateRequestConfig(data));
}
