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
export function optimizeLeadKeywords(data) {
  return request(buildLeadKeywordOptimizeRequestConfig(data));
}
/** List current user's keyword optimization histories, newest first. */
export function fetchLeadKeywordHistories(params) {
  return request(buildLeadKeywordHistoryListRequestConfig(params));
}
/** Save edited keyword optimization content for one history record. */
export function updateLeadKeywordHistory(id, data) {
  return request(buildUpdateLeadKeywordHistoryRequestConfig(id, data));
}
/** Delete one keyword optimization history owned by the current user. */
export function deleteLeadKeywordHistory(id) {
  return request(buildDeleteLeadKeywordHistoryRequestConfig(id));
}
/** Run keyword optimization, Serper search, and search-result decisions as one backend workflow. */
export function searchLeadCustomers(data) {
  return request(buildLeadSearchOrchestrateRequestConfig(data));
}
/** Create one background AI leads search task. */
export function createLeadSearchTask(data) {
  return request(buildCreateLeadSearchTaskRequestConfig(data));
}
/** Restore the current user's active or unread AI leads search task. */
export function fetchCurrentLeadSearchTask() {
  return request(buildCurrentLeadSearchTaskRequestConfig());
}
/** Read one AI leads search task by id. */
export function fetchLeadSearchTask(id) {
  return request(buildLeadSearchTaskRequestConfig(id));
}
/** Interrupt one running AI leads search task. */
export function interruptLeadSearchTask(id) {
  return request(buildLeadSearchTaskActionRequestConfig(id, 'interrupt'));
}
/** Resume one interrupted AI leads search task. */
export function resumeLeadSearchTask(id) {
  return request(buildLeadSearchTaskActionRequestConfig(id, 'resume'));
}
/** Retry one failed AI leads search task. */
export function retryLeadSearchTask(id) {
  return request(buildLeadSearchTaskActionRequestConfig(id, 'retry'));
}
/** Discard one queued, interrupted, or failed AI leads search task. */
export function discardLeadSearchTask(id) {
  return request(buildLeadSearchTaskActionRequestConfig(id, 'discard'));
}
/** Mark one completed restored AI leads search task as read. */
export function markLeadSearchTaskRead(id) {
  return request(buildLeadSearchTaskActionRequestConfig(id, 'read'));
}
/** Read global AI leads queue settings. */
export function fetchAiLeadQueueConfig() {
  return request(buildLeadQueueConfigRequestConfig());
}
/** Save global AI leads queue settings. */
export function saveAiLeadQueueConfig(data) {
  return request(buildSaveLeadQueueConfigRequestConfig(data));
}
