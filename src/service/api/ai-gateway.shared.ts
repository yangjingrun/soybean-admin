import type { CustomAxiosRequestConfig } from '@sa/axios';

export const aiGatewayGenerateTextTimeout = 120 * 1000;

/** Build the request config for saving the backend model channel. */
export function buildSaveAiModelConfigRequestConfig(
  data: Api.AiGateway.SaveModelConfigPayload
): CustomAxiosRequestConfig {
  return {
    url: '/ai-gateway/model-configs',
    method: 'post',
    data
  };
}

/** Build the request config for the long-running AI gateway text generation task. */
export function buildGenerateAiTextRequestConfig(data: Api.AiGateway.GenerateTextPayload): CustomAxiosRequestConfig {
  return {
    url: '/ai-gateway/generate-text',
    method: 'post',
    data,
    // AI generation can exceed the common 10s API timeout.
    timeout: aiGatewayGenerateTextTimeout
  };
}
