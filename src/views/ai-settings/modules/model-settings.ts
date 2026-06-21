import { defaultAiModelConfigKey } from '@/constants/ai-gateway';

export interface ModelConfigFormModel {
  configKey: string;
  title: string;
  providerName: string;
  apiBase: string;
  apiKey: string;
  model: string;
}

export interface SavedSecretState {
  hasApiKey: boolean;
  maskedApiKey: string;
}

export interface ModelTestPromptInput {
  systemPrompt: string;
  prompt: string;
}

/** Check whether the model config form has enough visible fields to save a new API key. */
export function canSaveModelConfig(form: ModelConfigFormModel) {
  return Boolean(form.providerName.trim() && form.apiBase.trim() && form.apiKey.trim() && form.model.trim());
}

/** Check whether the model config can be tested with either a fresh key or an already saved key. */
export function canTestModelConfig(form: ModelConfigFormModel, savedSecret: SavedSecretState) {
  return Boolean(
    form.providerName.trim() &&
      form.apiBase.trim() &&
      form.model.trim() &&
      (form.apiKey.trim() || savedSecret.hasApiKey)
  );
}

/** Build the lightweight model test payload without sending an empty inline API key. */
export function buildModelTestPayload(
  form: ModelConfigFormModel,
  savedSecret: SavedSecretState,
  promptInput: ModelTestPromptInput
): Api.AiGateway.GenerateTextPayload {
  const apiKey = form.apiKey.trim();
  const basePayload = {
    systemPrompt: promptInput.systemPrompt,
    prompt: promptInput.prompt
  };

  if (apiKey) {
    return {
      providerName: form.providerName.trim(),
      apiBase: form.apiBase.trim(),
      apiKey,
      model: form.model.trim(),
      ...basePayload
    };
  }

  if (savedSecret.hasApiKey) {
    return {
      modelConfigKey: form.configKey.trim() || defaultAiModelConfigKey,
      ...basePayload
    };
  }

  return {
    providerName: form.providerName.trim(),
    apiBase: form.apiBase.trim(),
    apiKey,
    model: form.model.trim(),
    ...basePayload
  };
}
