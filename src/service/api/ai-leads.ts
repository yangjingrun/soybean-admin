import { request } from '../request';

/** Optimize natural-language lead requirements into keyword strategy through the AI leads workflow. */
export function optimizeLeadKeywords(data: Api.AiLeads.KeywordOptimizePayload) {
  return request<Api.AiGateway.AiTextResult>({
    url: '/ai-leads/keyword-optimize',
    method: 'post',
    data
  });
}
