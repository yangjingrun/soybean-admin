import { request } from '../request';

/** Save one fixed system prompt for later model calls. */
export function saveAiPrompt(data: Api.AiGateway.SavePromptPayload) {
  return request<Api.AiGateway.AiPromptRecord>({
    url: '/ai-gateway/prompts',
    method: 'post',
    data
  });
}

/** Read one fixed system prompt by stable business key. */
export function getAiPrompt(promptKey: string) {
  return request<Api.AiGateway.AiPromptRecord>({
    url: `/ai-gateway/prompts/${promptKey}`
  });
}

/** Save the backend model config used by AI workflows. */
export function saveAiModelConfig(data: Api.AiGateway.SaveModelConfigPayload) {
  return request<Api.AiGateway.AiModelConfigRecord>({
    url: '/ai-gateway/model-configs',
    method: 'post',
    data
  });
}

/** Read one backend model config by stable config key. */
export function getAiModelConfig(configKey = 'default') {
  return request<Api.AiGateway.AiModelConfigRecord>({
    url: `/ai-gateway/model-configs/${configKey}`
  });
}

/** Generate text through the backend AI gateway. */
export function generateAiText(data: Api.AiGateway.GenerateTextPayload) {
  return request<Api.AiGateway.AiTextResult>({
    url: '/ai-gateway/generate-text',
    method: 'post',
    data
  });
}
