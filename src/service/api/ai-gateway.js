import { request } from '../request';
import {
  buildGetDefaultAiPromptRequestConfig,
  buildGenerateAiTextRequestConfig,
  buildSaveAiModelConfigRequestConfig,
  buildSaveMyAiModelConfigRequestConfig,
  buildSaveMyHunterConfigRequestConfig,
  buildSaveMySerperConfigRequestConfig
} from './ai-gateway.shared';
/** Save one fixed system prompt for later model calls. */
export function saveAiPrompt(data) {
  return request({
    url: '/ai-gateway/prompts',
    method: 'post',
    data
  });
}
/** Read one fixed system prompt by stable business key. */
export function getAiPrompt(promptKey) {
  return request({
    url: `/ai-gateway/prompts/${promptKey}`
  });
}
/** Read the code-level built-in prompt draft, ignoring saved global overrides. */
export function getDefaultAiPrompt(promptKey) {
  return request(buildGetDefaultAiPromptRequestConfig(promptKey));
}
/** List built-in prompt workbench steps with publish, draft, and latest test states. */
export function fetchAiPromptWorkbenchSteps() {
  return request({
    url: '/ai-gateway/prompt-workbench/steps'
  });
}
/** Read one prompt workbench detail. */
export function fetchAiPromptWorkbenchDetail(promptKey) {
  return request({
    url: `/ai-gateway/prompt-workbench/steps/${promptKey}`
  });
}
/** Validate prompt draft text without calling the model. */
export function validateAiPromptDraft(data) {
  return request({
    url: '/ai-gateway/prompt-workbench/drafts/validate',
    method: 'post',
    data
  });
}
/** Save one prompt draft without publishing it. */
export function saveAiPromptDraft(data) {
  return request({
    url: '/ai-gateway/prompt-workbench/drafts',
    method: 'post',
    data
  });
}
/** Test one prompt draft through the current user's model config. */
export function testAiPromptDraft(data) {
  return request({
    url: '/ai-gateway/prompt-workbench/drafts/test',
    method: 'post',
    data
  });
}
/** Publish the current prompt draft as the global version. */
export function publishAiPromptDraft(data) {
  return request({
    url: '/ai-gateway/prompt-workbench/drafts/publish',
    method: 'post',
    data
  });
}
/** Roll back to a historical prompt version by publishing a new copied version. */
export function rollbackAiPromptVersion(data) {
  return request({
    url: '/ai-gateway/prompt-workbench/versions/rollback',
    method: 'post',
    data
  });
}
/** Save the backend model config used by AI workflows. */
export function saveAiModelConfig(data) {
  return request(buildSaveAiModelConfigRequestConfig(data));
}
/** Read one backend model config by stable config key. */
export function getAiModelConfig(configKey = 'default') {
  return request({
    url: `/ai-gateway/model-configs/${configKey}`
  });
}
/** Save the current account model channel used by personal AI workflows. */
export function saveMyAiModelConfig(data) {
  return request(buildSaveMyAiModelConfigRequestConfig(data));
}
/** Read the current account model channel draft. */
export function getMyAiModelConfig() {
  return request({
    url: '/ai-gateway/my-model-config'
  });
}
/** Save the current account Serper channel used by personal AI leads workflows. */
export function saveMySerperConfig(data) {
  return request(buildSaveMySerperConfigRequestConfig(data));
}
/** Read the current account Serper channel draft. */
export function getMySerperConfig() {
  return request({
    url: '/ai-gateway/my-serper-config'
  });
}
/** Test the current account Serper channel before saving it. */
export function testMySerperConfig(data) {
  return request({
    url: '/ai-gateway/my-serper-config/test',
    method: 'post',
    data
  });
}
/** Save the backend Serper config used by AI leads search workflows. */
export function saveSerperConfig(data) {
  return request({
    url: '/ai-gateway/serper-configs',
    method: 'post',
    data
  });
}
/** Read one backend Serper config by stable config key. */
export function getSerperConfig(configKey = 'default') {
  return request({
    url: `/ai-gateway/serper-configs/${configKey}`
  });
}
/** Test one Serper config before saving it. */
export function testSerperConfig(data) {
  return request({
    url: '/ai-gateway/serper-configs/test',
    method: 'post',
    data
  });
}
/** Save the current account Hunter channel used by personal CRM enrichment workflows. */
export function saveMyHunterConfig(data) {
  return request(buildSaveMyHunterConfigRequestConfig(data));
}
/** Read the current account Hunter channel draft. */
export function getMyHunterConfig() {
  return request({
    url: '/ai-gateway/my-hunter-config'
  });
}
/** Test the current account Hunter channel before saving it. */
export function testMyHunterConfig(data) {
  return request({
    url: '/ai-gateway/my-hunter-config/test',
    method: 'post',
    data
  });
}
/** Save the backend Hunter config used by CRM Domain Search enrichment. */
export function saveHunterConfig(data) {
  return request({
    url: '/ai-gateway/hunter-configs',
    method: 'post',
    data
  });
}
/** Read one backend Hunter config by stable config key. */
export function getHunterConfig(configKey = 'default') {
  return request({
    url: `/ai-gateway/hunter-configs/${configKey}`
  });
}
/** Test one Hunter config before saving it. */
export function testHunterConfig(data) {
  return request({
    url: '/ai-gateway/hunter-configs/test',
    method: 'post',
    data
  });
}
/** Generate text through the backend AI gateway. */
export function generateAiText(data) {
  return request(buildGenerateAiTextRequestConfig(data));
}
