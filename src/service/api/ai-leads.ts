import { request } from '../request';
import { buildLeadKeywordOptimizeRequestConfig } from './ai-leads.shared';

/** Optimize natural-language lead requirements into keyword strategy through the AI leads workflow. */
export function optimizeLeadKeywords(data: Api.AiLeads.KeywordOptimizePayload) {
  return request<Api.AiGateway.AiTextResult>(buildLeadKeywordOptimizeRequestConfig(data));
}
