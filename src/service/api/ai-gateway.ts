import { request } from '../request';
import { buildGenerateAiTextRequestConfig } from './ai-gateway.shared';

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

/** Save the backend Serper config used by AI leads search workflows. */
export function saveSerperConfig(data: Api.AiGateway.SaveSerperConfigPayload) {
  return request<Api.AiGateway.SerperConfigRecord>({
    url: '/ai-gateway/serper-configs',
    method: 'post',
    data
  });
}

/** Read one backend Serper config by stable config key. */
export function getSerperConfig(configKey = 'default') {
  return request<Api.AiGateway.SerperConfigRecord>({
    url: `/ai-gateway/serper-configs/${configKey}`
  });
}

/** Test one Serper config before saving it. */
export function testSerperConfig(data: Api.AiGateway.SaveSerperConfigPayload) {
  return request<Api.AiGateway.SerperTestResult>({
    url: '/ai-gateway/serper-configs/test',
    method: 'post',
    data
  });
}

/** Save the backend Hunter config used by CRM Domain Search enrichment. */
export function saveHunterConfig(data: Api.AiGateway.SaveHunterConfigPayload) {
  return request<Api.AiGateway.HunterConfigRecord>({
    url: '/ai-gateway/hunter-configs',
    method: 'post',
    data
  });
}

/** Read one backend Hunter config by stable config key. */
export function getHunterConfig(configKey = 'default') {
  return request<Api.AiGateway.HunterConfigRecord>({
    url: `/ai-gateway/hunter-configs/${configKey}`
  });
}

/** Test one Hunter config before saving it. */
export function testHunterConfig(data: Api.AiGateway.SaveHunterConfigPayload) {
  return request<Api.AiGateway.HunterTestResult>({
    url: '/ai-gateway/hunter-configs/test',
    method: 'post',
    data
  });
}

/** Generate text through the backend AI gateway. */
export function generateAiText(data: Api.AiGateway.GenerateTextPayload) {
  return request<Api.AiGateway.AiTextResult>(buildGenerateAiTextRequestConfig(data));
}
