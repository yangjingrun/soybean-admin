import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildModelTestPayload,
  canSaveModelConfig,
  canTestModelConfig,
  resolveAiSettingsTabVisibility
} from './model-settings';

describe('ai settings model helpers', () => {
  it('tests the inline model config when the user entered a new API key', () => {
    const payload = buildModelTestPayload(
      createModelForm({ apiKey: ' sk-new ' }),
      { hasApiKey: true, maskedApiKey: 'sk-s****-old' },
      createPromptInput()
    );

    assert.deepEqual(payload, {
      providerName: 'openai',
      apiBase: 'http://localhost:65074/v1',
      apiKey: 'sk-new',
      model: 'gpt-5.5',
      systemPrompt: 'system',
      prompt: 'ping'
    });
  });

  it('tests the saved personal model config without falling back to platform config key', () => {
    const payload = buildModelTestPayload(
      createModelForm({ apiKey: '' }),
      { hasApiKey: true, maskedApiKey: 'sk-s****-old' },
      createPromptInput()
    );

    assert.deepEqual(payload, {
      systemPrompt: 'system',
      prompt: 'ping'
    });
  });

  it('allows saving field changes when the account already has a saved API key', () => {
    const form = createModelForm({ apiKey: '' });
    const savedSecret = { hasApiKey: true, maskedApiKey: 'sk-s****-old' };

    assert.equal(canTestModelConfig(form, savedSecret), true);
    assert.equal(canSaveModelConfig(form, savedSecret), true);
  });

  it('requires a fresh API key before the first personal model config save', () => {
    const form = createModelForm({ apiKey: '' });
    const savedSecret = { hasApiKey: false, maskedApiKey: '' };

    assert.equal(canSaveModelConfig(form, savedSecret), false);
  });

  it('keeps the personal model tab visible without platform model permission', () => {
    const visibility = resolveAiSettingsTabVisibility({
      canManageSerperConfig: false,
      canManageHunterConfig: false,
      canManageAiLeadQueueConfig: false
    });

    assert.deepEqual(visibility, {
      model: true,
      serper: false,
      hunter: false,
      queue: false
    });
  });
});

function createModelForm(overrides: Partial<Parameters<typeof buildModelTestPayload>[0]> = {}) {
  return {
    configKey: 'default',
    title: '默认模型',
    providerName: 'openai',
    apiBase: 'http://localhost:65074/v1',
    apiKey: 'sk-old',
    model: 'gpt-5.5',
    ...overrides
  };
}

function createPromptInput() {
  return {
    systemPrompt: 'system',
    prompt: 'ping'
  };
}
