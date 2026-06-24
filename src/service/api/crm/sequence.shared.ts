import type { CustomAxiosRequestConfig } from '@sa/axios';

export const crmAiWritingRequestTimeout = 0;

/** Builds a CRM AI writing request without inheriting the common 10s API timeout. */
function buildCrmAiWritingRequestConfig(config: CustomAxiosRequestConfig): CustomAxiosRequestConfig {
  return {
    ...config,
    timeout: crmAiWritingRequestTimeout
  };
}

/** Build the request config for regenerating one owner draft through AI writing. */
export function buildRegenerateCrmMessageAiDraftRequestConfig(id: string): CustomAxiosRequestConfig {
  return buildCrmAiWritingRequestConfig({
    url: `/crm/messages/${id}/regenerate-ai-draft`,
    method: 'post'
  });
}

/** Build the request config for generating the next follow-up draft through AI writing. */
export function buildGenerateCrmNextSequenceDraftRequestConfig(enrollmentId: string): CustomAxiosRequestConfig {
  return buildCrmAiWritingRequestConfig({
    url: `/crm/sequence-review-items/${enrollmentId}/generate-next-draft`,
    method: 'post'
  });
}

/** Build the request config for batch AI writing of follow-up drafts. */
export function buildBatchGenerateCrmNextSequenceDraftsRequestConfig(
  data: Api.Crm.SequenceReviewBatchPayload
): CustomAxiosRequestConfig {
  return buildCrmAiWritingRequestConfig({
    url: '/crm/sequence-review-items/batch-generate-next-draft',
    method: 'post',
    data
  });
}

/** Build the request config for creating one background CRM AI writing task. */
export function buildCreateCrmAiDraftTaskRequestConfig(
  data: Api.Crm.CreateAiDraftTaskPayload
): CustomAxiosRequestConfig {
  return buildCrmAiWritingRequestConfig({
    url: '/crm/ai-draft-tasks',
    method: 'post',
    data
  });
}

/** Build the request config for creating one background first outreach AI writing task. */
export function buildCreateCrmFirstOutreachAiDraftTaskRequestConfig(
  data: Api.Crm.CreateFirstOutreachAiDraftTaskPayload
): CustomAxiosRequestConfig {
  return buildCrmAiWritingRequestConfig({
    url: '/crm/ai-draft-tasks/first-outreach',
    method: 'post',
    data
  });
}

/** Build the request config for retrying failed CRM AI writing task items. */
export function buildRetryFailedCrmAiDraftTaskRequestConfig(id: string): CustomAxiosRequestConfig {
  return buildCrmAiWritingRequestConfig({
    url: `/crm/ai-draft-tasks/${id}/retry-failed`,
    method: 'post'
  });
}
