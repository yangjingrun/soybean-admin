import { request } from '../../request';

/** List sequence review items by filters and pagination. */
export function fetchCrmSequenceReviewItems(params: Api.Crm.SequenceReviewSearchParams) {
  return request<Api.Crm.SequenceReviewList>({
    url: '/crm/sequence-review-items',
    method: 'get',
    params
  });
}

/** Create one sequence review item and its deterministic first draft. */
export function createCrmSequenceReviewItem(data: Api.Crm.SequenceReviewCreatePayload) {
  return request<Api.Crm.SequenceReviewOperateResult>({
    url: '/crm/sequence-review-items',
    method: 'post',
    data
  });
}

/** Get one sequence review item with messages and checklist. */
export function fetchCrmSequenceReviewItem(id: string) {
  return request<Api.Crm.SequenceReviewItem>({
    url: `/crm/sequence-review-items/${id}`,
    method: 'get'
  });
}

/** Save human edits to one sequence draft. */
export function updateCrmMessageDraft(id: string, data: Api.Crm.MessageDraftPayload) {
  return request<Api.Crm.MessageDraftUpdateResult>({
    url: `/crm/messages/${id}/draft`,
    method: 'patch',
    data
  });
}

/** Regenerate one owner draft from the configured AI writing prompt. */
export function regenerateCrmMessageAiDraft(id: string) {
  return request<Api.Crm.MessageDraftUpdateResult>({
    url: `/crm/messages/${id}/regenerate-ai-draft`,
    method: 'post'
  });
}

/** List saved version snapshots for one owner draft message. */
export function fetchCrmMessageDraftVersions(id: string) {
  return request<Api.Crm.MessageDraftVersionListResult>({
    url: `/crm/messages/${id}/draft-versions`,
    method: 'get'
  });
}

/** Restore one saved version snapshot into the current pending-review draft. */
export function restoreCrmMessageDraftVersion(id: string, versionId: string) {
  return request<Api.Crm.MessageDraftVersionRestoreResult>({
    url: `/crm/messages/${id}/draft-versions/${versionId}/restore`,
    method: 'post'
  });
}

/** Approve one reviewed draft without queueing or sending it. */
export function approveCrmMessageDraft(id: string) {
  return request<Api.Crm.MessageDraftApproveResult>({
    url: `/crm/messages/${id}/approve`,
    method: 'post'
  });
}

/** Generate the next local follow-up draft for one sequence without queueing it. */
export function generateCrmNextSequenceDraft(enrollmentId: string) {
  return request<Api.Crm.MessageNextDraftGenerateResult>({
    url: `/crm/sequence-review-items/${enrollmentId}/generate-next-draft`,
    method: 'post'
  });
}

/** Generate next local follow-up drafts for selected sequences without queueing Gmail sends. */
export function batchGenerateCrmNextSequenceDrafts(data: Api.Crm.SequenceReviewBatchPayload) {
  return request<Api.Crm.SequenceBatchOperateResult>({
    url: '/crm/sequence-review-items/batch-generate-next-draft',
    method: 'post',
    data
  });
}

/** Create one background CRM AI draft task for selected sequences without sending Gmail. */
export function createCrmAiDraftTask(data: Api.Crm.CreateAiDraftTaskPayload) {
  return request<Api.Crm.AiDraftTaskDetail>({
    url: '/crm/ai-draft-tasks',
    method: 'post',
    data
  });
}

/** Read the current active or unread CRM AI draft task for the owner. */
export function fetchCurrentCrmAiDraftTask() {
  return request<Api.Crm.AiDraftTaskDetail | null>({
    url: '/crm/ai-draft-tasks/current',
    method: 'get'
  });
}

/** List recent CRM AI draft tasks. */
export function fetchCrmAiDraftTasks(params: Api.Common.CommonSearchParams) {
  return request<Api.Crm.AiDraftTaskList>({
    url: '/crm/ai-draft-tasks',
    method: 'get',
    params
  });
}

/** Get one CRM AI draft task with item details. */
export function fetchCrmAiDraftTaskDetail(id: string) {
  return request<Api.Crm.AiDraftTaskDetail>({
    url: `/crm/ai-draft-tasks/${id}`,
    method: 'get'
  });
}

/** Retry retryable failed items for one CRM AI draft task. */
export function retryFailedCrmAiDraftTask(id: string) {
  return request<Api.Crm.AiDraftTaskDetail>({
    url: `/crm/ai-draft-tasks/${id}/retry-failed`,
    method: 'post'
  });
}

/** Cancel one queued or running CRM AI draft task. */
export function cancelCrmAiDraftTask(id: string) {
  return request<Api.Crm.AiDraftTaskDetail>({
    url: `/crm/ai-draft-tasks/${id}/cancel`,
    method: 'post'
  });
}

/** Mark one finished CRM AI draft task as read. */
export function markCrmAiDraftTaskRead(id: string) {
  return request<Api.Crm.AiDraftTaskReadResult>({
    url: `/crm/ai-draft-tasks/${id}/read`,
    method: 'patch'
  });
}

/** Confirm selected owner drafts locally without queueing Gmail sends. */
export function batchApproveCrmMessageDrafts(data: Api.Crm.SequenceReviewBatchPayload) {
  return request<Api.Crm.SequenceBatchOperateResult>({
    url: '/crm/sequence-review-items/batch-approve-draft',
    method: 'post',
    data
  });
}

/** Start the first approved message by putting it into the CRM send queue. */
export function startCrmFirstMessageSend(enrollmentId: string) {
  return request<Api.Crm.MessageSendStartResult>({
    url: `/crm/sequence-review-items/${enrollmentId}/start-send`,
    method: 'post'
  });
}

/** Return an unsent first message to editable review state. */
export function returnCrmFirstMessageToEdit(enrollmentId: string) {
  return request<Api.Crm.MessageReturnToEditResult>({
    url: `/crm/sequence-review-items/${enrollmentId}/return-to-edit`,
    method: 'post'
  });
}

/** Resume one stopped CRM sequence without duplicating sent messages. */
export function resumeCrmSequenceEnrollment(enrollmentId: string) {
  return request<Api.Crm.SequenceResumeResult>({
    url: `/crm/sequence-review-items/${enrollmentId}/resume`,
    method: 'post'
  });
}

/** Send an unsent first message back to the CRM send scheduler. */
export function retryCrmFirstMessageSend(enrollmentId: string) {
  return request<Api.Crm.MessageRetrySendResult>({
    url: `/crm/sequence-review-items/${enrollmentId}/retry-send`,
    method: 'post'
  });
}

/** Stop one sequence and invalidate queued CRM send jobs. */
export function stopCrmSequenceEnrollment(enrollmentId: string) {
  return request<Api.Crm.SequenceStopResult>({
    url: `/crm/sequence-review-items/${enrollmentId}/stop`,
    method: 'post'
  });
}

/** Stop selected owner sequences and invalidate their queued CRM send jobs. */
export function batchStopCrmSequenceEnrollments(data: Api.Crm.SequenceReviewBatchPayload) {
  return request<Api.Crm.SequenceBatchOperateResult>({
    url: '/crm/sequence-review-items/batch-stop',
    method: 'post',
    data
  });
}
