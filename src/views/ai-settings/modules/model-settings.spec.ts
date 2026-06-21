import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { defaultAiModelConfigKey } from '@/constants/ai-gateway';
import { buildModelTestPayload, canSaveModelConfig, canTestModelConfig } from './model-settings';

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

  it('tests the saved model config instead of sending an empty inline API key', () => {
    const payload = buildModelTestPayload(
      createModelForm({ apiKey: '' }),
      { hasApiKey: true, maskedApiKey: 'sk-s****-old' },
      createPromptInput()
    );

    assert.deepEqual(payload, {
      modelConfigKey: defaultAiModelConfigKey,
      systemPrompt: 'system',
      prompt: 'ping'
    });
  });

  it('allows testing saved configs but only saves when a new API key is entered', () => {
    const form = createModelForm({ apiKey: '' });
    const savedSecret = { hasApiKey: true, maskedApiKey: 'sk-s****-old' };

    assert.equal(canTestModelConfig(form, savedSecret), true);
    assert.equal(canSaveModelConfig(form), false);
  });
});

function createModelForm(overrides: Partial<Parameters<typeof buildModelTestPayload>[0]> = {}) {
  return {
    configKey: defaultAiModelConfigKey,
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
