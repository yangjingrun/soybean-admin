import { request } from '../../request';
/** List sequence review items by filters and pagination. */
export function fetchCrmSequenceReviewItems(params) {
  return request({
    url: '/crm/sequence-review-items',
    method: 'get',
    params
  });
}
/** Create one sequence review item and its deterministic first draft. */
export function createCrmSequenceReviewItem(data) {
  return request({
    url: '/crm/sequence-review-items',
    method: 'post',
    data
  });
}
/** Get one sequence review item with messages and checklist. */
export function fetchCrmSequenceReviewItem(id) {
  return request({
    url: `/crm/sequence-review-items/${id}`,
    method: 'get'
  });
}
/** Save human edits to one sequence draft. */
export function updateCrmMessageDraft(id, data) {
  return request({
    url: `/crm/messages/${id}/draft`,
    method: 'patch',
    data
  });
}
/** List saved version snapshots for one owner draft message. */
export function fetchCrmMessageDraftVersions(id) {
  return request({
    url: `/crm/messages/${id}/draft-versions`,
    method: 'get'
  });
}
/** Restore one saved version snapshot into the current pending-review draft. */
export function restoreCrmMessageDraftVersion(id, versionId) {
  return request({
    url: `/crm/messages/${id}/draft-versions/${versionId}/restore`,
    method: 'post'
  });
}
/** Approve one reviewed draft without queueing or sending it. */
export function approveCrmMessageDraft(id) {
  return request({
    url: `/crm/messages/${id}/approve`,
    method: 'post'
  });
}
/** Generate the next local follow-up draft for one sequence without queueing it. */
export function generateCrmNextSequenceDraft(enrollmentId) {
  return request({
    url: `/crm/sequence-review-items/${enrollmentId}/generate-next-draft`,
    method: 'post'
  });
}
/** Generate next local follow-up drafts for selected sequences without queueing Gmail sends. */
export function batchGenerateCrmNextSequenceDrafts(data) {
  return request({
    url: '/crm/sequence-review-items/batch-generate-next-draft',
    method: 'post',
    data
  });
}
/** Create one background CRM AI draft task for selected sequences without sending Gmail. */
export function createCrmAiDraftTask(data) {
  return request({
    url: '/crm/ai-draft-tasks',
    method: 'post',
    data
  });
}
/** Read the current active or unread CRM AI draft task for the owner. */
export function fetchCurrentCrmAiDraftTask() {
  return request({
    url: '/crm/ai-draft-tasks/current',
    method: 'get'
  });
}
/** List recent CRM AI draft tasks. */
export function fetchCrmAiDraftTasks(params) {
  return request({
    url: '/crm/ai-draft-tasks',
    method: 'get',
    params
  });
}
/** Get one CRM AI draft task with item details. */
export function fetchCrmAiDraftTaskDetail(id) {
  return request({
    url: `/crm/ai-draft-tasks/${id}`,
    method: 'get'
  });
}
/** Retry retryable failed items for one CRM AI draft task. */
export function retryFailedCrmAiDraftTask(id) {
  return request({
    url: `/crm/ai-draft-tasks/${id}/retry-failed`,
    method: 'post'
  });
}
/** Cancel one queued or running CRM AI draft task. */
export function cancelCrmAiDraftTask(id) {
  return request({
    url: `/crm/ai-draft-tasks/${id}/cancel`,
    method: 'post'
  });
}
/** Mark one finished CRM AI draft task as read. */
export function markCrmAiDraftTaskRead(id) {
  return request({
    url: `/crm/ai-draft-tasks/${id}/read`,
    method: 'patch'
  });
}
/** Confirm selected owner drafts locally without queueing Gmail sends. */
export function batchApproveCrmMessageDrafts(data) {
  return request({
    url: '/crm/sequence-review-items/batch-approve-draft',
    method: 'post',
    data
  });
}
/** Start the first approved message by putting it into the CRM send queue. */
export function startCrmFirstMessageSend(enrollmentId) {
  return request({
    url: `/crm/sequence-review-items/${enrollmentId}/start-send`,
    method: 'post'
  });
}
/** Stop one sequence and invalidate queued CRM send jobs. */
export function stopCrmSequenceEnrollment(enrollmentId) {
  return request({
    url: `/crm/sequence-review-items/${enrollmentId}/stop`,
    method: 'post'
  });
}
/** Stop selected owner sequences and invalidate their queued CRM send jobs. */
export function batchStopCrmSequenceEnrollments(data) {
  return request({
    url: '/crm/sequence-review-items/batch-stop',
    method: 'post',
    data
  });
}
