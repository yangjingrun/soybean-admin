import { request } from '../request';
import {
  buildAiPromptWorkbenchRequestConfig,
  buildGetDefaultAiPromptRequestConfig,
  buildGenerateAiTextRequestConfig,
  buildSaveAiModelConfigRequestConfig,
  buildSaveMyAiModelConfigRequestConfig,
  buildSaveMyHunterConfigRequestConfig,
  buildSaveMySerperConfigRequestConfig
} from './ai-gateway.shared';

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

/** Read the code-level built-in prompt draft, ignoring saved global overrides. */
export function getDefaultAiPrompt(promptKey: string) {
  return request<Api.AiGateway.AiPromptRecord>(buildGetDefaultAiPromptRequestConfig(promptKey));
}

/** List built-in prompt workbench steps with publish, draft, and latest test states. */
export function fetchAiPromptWorkbenchSteps() {
  return request<Api.AiGateway.AiPromptStepSummary[]>(
    buildAiPromptWorkbenchRequestConfig({
      url: '/ai-gateway/prompt-workbench/steps'
    })
  );
}

/** Read one prompt workbench detail. */
export function fetchAiPromptWorkbenchDetail(promptKey: string) {
  return request<Api.AiGateway.AiPromptWorkbenchDetail>(
    buildAiPromptWorkbenchRequestConfig({
      url: `/ai-gateway/prompt-workbench/steps/${promptKey}`
    })
  );
}

/** Validate prompt draft text without calling the model. */
export function validateAiPromptDraft(data: Api.AiGateway.ValidatePromptDraftPayload) {
  return request<Api.AiGateway.AiPromptValidationResult>(
    buildAiPromptWorkbenchRequestConfig({
      url: '/ai-gateway/prompt-workbench/drafts/validate',
      method: 'post',
      data
    })
  );
}

/** Save one prompt draft without publishing it. */
export function saveAiPromptDraft(data: Api.AiGateway.SavePromptDraftPayload) {
  return request<Api.AiGateway.AiPromptVersionRecord>(
    buildAiPromptWorkbenchRequestConfig({
      url: '/ai-gateway/prompt-workbench/drafts',
      method: 'post',
      data
    })
  );
}

/** Test one prompt draft through the current user's model config. */
export function testAiPromptDraft(data: Api.AiGateway.TestPromptDraftPayload) {
  return request<Api.AiGateway.AiPromptTestRunRecord>(
    buildAiPromptWorkbenchRequestConfig({
      url: '/ai-gateway/prompt-workbench/drafts/test',
      method: 'post',
      data
    })
  );
}

/** Publish the current prompt draft as the global version. */
export function publishAiPromptDraft(data: Api.AiGateway.PublishPromptDraftPayload) {
  return request<Api.AiGateway.AiPromptVersionRecord>(
    buildAiPromptWorkbenchRequestConfig({
      url: '/ai-gateway/prompt-workbench/drafts/publish',
      method: 'post',
      data
    })
  );
}

/** Roll back to a historical prompt version by publishing a new copied version. */
export function rollbackAiPromptVersion(data: Api.AiGateway.RollbackPromptVersionPayload) {
  return request<Api.AiGateway.AiPromptVersionRecord>(
    buildAiPromptWorkbenchRequestConfig({
      url: '/ai-gateway/prompt-workbench/versions/rollback',
      method: 'post',
      data
    })
  );
}

/** Save the backend model config used by AI workflows. */
export function saveAiModelConfig(data: Api.AiGateway.SaveModelConfigPayload) {
  return request<Api.AiGateway.AiModelConfigRecord>(buildSaveAiModelConfigRequestConfig(data));
}

/** Read one backend model config by stable config key. */
export function getAiModelConfig(configKey = 'default') {
  return request<Api.AiGateway.AiModelConfigRecord>({
    url: `/ai-gateway/model-configs/${configKey}`
  });
}

/** Save the current account model channel used by personal AI workflows. */
export function saveMyAiModelConfig(data: Api.AiGateway.SaveMyModelConfigPayload) {
  return request<Api.AiGateway.MyAiModelConfigRecord>(buildSaveMyAiModelConfigRequestConfig(data));
}

/** Read the current account model channel draft. */
export function getMyAiModelConfig() {
  return request<Api.AiGateway.MyAiModelConfigRecord>({
    url: '/ai-gateway/my-model-config'
  });
}

/** Save the current account Serper channel used by personal AI leads workflows. */
export function saveMySerperConfig(data: Api.AiGateway.SaveMySerperConfigPayload) {
  return request<Api.AiGateway.MySerperConfigRecord>(buildSaveMySerperConfigRequestConfig(data));
}

/** Read the current account Serper channel draft. */
export function getMySerperConfig() {
  return request<Api.AiGateway.MySerperConfigRecord>({
    url: '/ai-gateway/my-serper-config'
  });
}

/** Test the current account Serper channel before saving it. */
export function testMySerperConfig(data: Api.AiGateway.SaveMySerperConfigPayload) {
  return request<Api.AiGateway.SerperTestResult>({
    url: '/ai-gateway/my-serper-config/test',
    method: 'post',
    data
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

/** Save the current account Hunter channel used by personal CRM enrichment workflows. */
export function saveMyHunterConfig(data: Api.AiGateway.SaveMyHunterConfigPayload) {
  return request<Api.AiGateway.MyHunterConfigRecord>(buildSaveMyHunterConfigRequestConfig(data));
}

/** Read the current account Hunter channel draft. */
export function getMyHunterConfig() {
  return request<Api.AiGateway.MyHunterConfigRecord>({
    url: '/ai-gateway/my-hunter-config'
  });
}

/** Test the current account Hunter channel before saving it. */
export function testMyHunterConfig(data: Api.AiGateway.SaveMyHunterConfigPayload) {
  return request<Api.AiGateway.HunterTestResult>({
    url: '/ai-gateway/my-hunter-config/test',
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
