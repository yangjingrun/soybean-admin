import type { CustomAxiosRequestConfig } from '@sa/axios';

export const aiGatewayGenerateTextTimeout = 120 * 1000;

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
