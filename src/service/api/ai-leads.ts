import { request } from '../request';
export { streamLeadCustomerSearch } from './ai-leads.stream';
import {
  buildCreateLeadSearchTaskRequestConfig,
  buildCurrentLeadSearchTaskRequestConfig,
  buildDeleteLeadKeywordHistoryRequestConfig,
  buildLeadKeywordHistoryListRequestConfig,
  buildLeadKeywordOptimizeRequestConfig,
  buildLeadQueueConfigRequestConfig,
  buildLeadSearchTaskActionRequestConfig,
  buildLeadSearchTaskRequestConfig,
  buildLeadSearchOrchestrateRequestConfig,
  buildSaveLeadQueueConfigRequestConfig,
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

/** Create one background AI leads search task. */
export function createLeadSearchTask(data: Api.AiLeads.CreateSearchTaskPayload) {
  return request<Api.AiLeads.TaskRecord>(buildCreateLeadSearchTaskRequestConfig(data));
}

/** Restore the current user's active or unread AI leads search task. */
export function fetchCurrentLeadSearchTask() {
  return request<Api.AiLeads.TaskRecord | null>(buildCurrentLeadSearchTaskRequestConfig());
}

/** Read one AI leads search task by id. */
export function fetchLeadSearchTask(id: string) {
  return request<Api.AiLeads.TaskRecord>(buildLeadSearchTaskRequestConfig(id));
}

/** Interrupt one running AI leads search task. */
export function interruptLeadSearchTask(id: string) {
  return request<Api.AiLeads.TaskRecord>(buildLeadSearchTaskActionRequestConfig(id, 'interrupt'));
}

/** Resume one interrupted AI leads search task. */
export function resumeLeadSearchTask(id: string) {
  return request<Api.AiLeads.TaskRecord>(buildLeadSearchTaskActionRequestConfig(id, 'resume'));
}

/** Retry one failed AI leads search task. */
export function retryLeadSearchTask(id: string) {
  return request<Api.AiLeads.TaskRecord>(buildLeadSearchTaskActionRequestConfig(id, 'retry'));
}

/** Discard one queued, interrupted, or failed AI leads search task. */
export function discardLeadSearchTask(id: string) {
  return request<Api.AiLeads.TaskRecord>(buildLeadSearchTaskActionRequestConfig(id, 'discard'));
}

/** Mark one completed restored AI leads search task as read. */
export function markLeadSearchTaskRead(id: string) {
  return request<Api.AiLeads.TaskRecord>(buildLeadSearchTaskActionRequestConfig(id, 'read'));
}

/** Read global AI leads queue settings. */
export function fetchAiLeadQueueConfig() {
  return request<Api.AiLeads.QueueConfig>(buildLeadQueueConfigRequestConfig());
}

/** Save global AI leads queue settings. */
export function saveAiLeadQueueConfig(data: Api.AiLeads.SaveQueueConfigPayload) {
  return request<Api.AiLeads.QueueConfig>(buildSaveLeadQueueConfigRequestConfig(data));
}
