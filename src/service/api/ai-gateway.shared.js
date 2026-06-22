export const aiGatewayGenerateTextTimeout = 120 * 1000;
/** Build the request config for reading one code-level built-in prompt draft. */
export function buildGetDefaultAiPromptRequestConfig(promptKey) {
  return {
    url: `/ai-gateway/prompts/${promptKey}/default`
  };
}
/** Build the request config for saving the backend model channel. */
export function buildSaveAiModelConfigRequestConfig(data) {
  return {
    url: '/ai-gateway/model-configs',
    method: 'post',
    data
  };
}
/** Build the request config for saving the current account model channel. */
export function buildSaveMyAiModelConfigRequestConfig(data) {
  return {
    url: '/ai-gateway/my-model-config',
    method: 'post',
    data
  };
}
/** Build the request config for saving the current account Serper channel. */
export function buildSaveMySerperConfigRequestConfig(data) {
  return {
    url: '/ai-gateway/my-serper-config',
    method: 'post',
    data
  };
}
/** Build the request config for saving the current account Hunter channel. */
export function buildSaveMyHunterConfigRequestConfig(data) {
  return {
    url: '/ai-gateway/my-hunter-config',
    method: 'post',
    data
  };
}
/** Build the request config for the long-running AI gateway text generation task. */
export function buildGenerateAiTextRequestConfig(data) {
  return {
    url: '/ai-gateway/generate-text',
    method: 'post',
    data,
    // AI generation can exceed the common 10s API timeout.
    timeout: aiGatewayGenerateTextTimeout
  };
}
