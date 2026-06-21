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

export type AiSettingsTabKey = 'model' | 'serper' | 'hunter' | 'queue';

export interface AiSettingsTabPermissionState {
  canManageAiLeadQueueConfig: boolean;
}

/** Check whether the model config form can save a fresh key or update fields with an existing saved key. */
export function canSaveModelConfig(form: ModelConfigFormModel, savedSecret: SavedSecretState) {
  return Boolean(
    form.providerName.trim() &&
      form.apiBase.trim() &&
      form.model.trim() &&
      (form.apiKey.trim() || savedSecret.hasApiKey)
  );
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

/** Resolve AI settings tab visibility while keeping personal provider tabs available to every account. */
export function resolveAiSettingsTabVisibility(
  permissions: AiSettingsTabPermissionState
): Record<AiSettingsTabKey, boolean> {
  return {
    model: true,
    serper: true,
    hunter: true,
    queue: permissions.canManageAiLeadQueueConfig
  };
}
