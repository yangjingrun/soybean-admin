/** Check whether the model config form can save a fresh key or update fields with an existing saved key. */
export function canSaveModelConfig(form, savedSecret) {
  return Boolean(
    form.providerName.trim() &&
    form.apiBase.trim() &&
    form.model.trim() &&
    (form.apiKey.trim() || savedSecret.hasApiKey)
  );
}
/** Check whether the model config can be tested with either a fresh key or an already saved key. */
export function canTestModelConfig(form, savedSecret) {
  return Boolean(
    form.providerName.trim() &&
    form.apiBase.trim() &&
    form.model.trim() &&
    (form.apiKey.trim() || savedSecret.hasApiKey)
  );
}
/** Build the lightweight model test payload without sending an empty inline API key. */
export function buildModelTestPayload(form, savedSecret, promptInput) {
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
export function resolveAiSettingsTabVisibility(permissions) {
  return {
    model: true,
    serper: true,
    hunter: true,
    queue: permissions.canManageAiLeadQueueConfig
  };
}
