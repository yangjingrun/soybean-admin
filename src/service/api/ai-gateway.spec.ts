import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  aiGatewayGenerateTextTimeout,
  buildGenerateAiTextRequestConfig,
  buildSaveAiModelConfigRequestConfig
} from './ai-gateway.shared';

describe('ai gateway api helpers', () => {
  it('uses a longer request timeout for text generation', () => {
    const payload = {
      systemPrompt: '你是外贸获客助手',
      prompt: '找沙特轴承进口商'
    };

    const config = buildGenerateAiTextRequestConfig(payload);

    assert.equal(config.url, '/ai-gateway/generate-text');
    assert.equal(config.method, 'post');
    assert.equal(config.timeout, aiGatewayGenerateTextTimeout);
    assert.equal(config.timeout, 120 * 1000);
    assert.deepEqual(config.data, payload);
  });

  it('keeps model runtime options in the save model config request payload', () => {
    const payload = {
      configKey: 'default',
      title: '默认模型',
      providerName: 'openrouter',
      apiBase: 'https://openrouter.ai/api/v1',
      apiKey: 'sk-test',
      model: 'openai/gpt-4o-mini',
      temperature: 0.2,
      maxOutputTokens: 1200
    };

    const config = buildSaveAiModelConfigRequestConfig(payload);

    assert.equal(config.url, '/ai-gateway/model-configs');
    assert.equal(config.method, 'post');
    assert.deepEqual(config.data, payload);
  });
});
