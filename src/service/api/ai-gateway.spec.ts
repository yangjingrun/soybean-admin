import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  aiGatewayGenerateTextTimeout,
  buildGetDefaultAiPromptRequestConfig,
  buildGenerateAiTextRequestConfig,
  buildSaveMyAiModelConfigRequestConfig,
  buildSaveMyHunterConfigRequestConfig,
  buildSaveMySerperConfigRequestConfig
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

  it('builds the built-in default prompt request config', () => {
    const config = buildGetDefaultAiPromptRequestConfig('lead_search_result_decide');

    assert.equal(config.url, '/ai-gateway/prompts/lead_search_result_decide/default');
  });

  it('saves my model config through the personal model endpoint', () => {
    const payload = {
      providerName: 'openrouter',
      apiBase: 'https://openrouter.ai/api/v1',
      model: 'openai/gpt-4o-mini',
      temperature: 0.2,
      maxOutputTokens: 1200
    };

    const config = buildSaveMyAiModelConfigRequestConfig(payload);

    assert.equal(config.url, '/ai-gateway/my-model-config');
    assert.equal(config.method, 'post');
    assert.deepEqual(config.data, payload);
  });

  it('uses personal Serper and Hunter endpoints for account provider configs', () => {
    const serperPayload = {
      title: 'Serper 搜索',
      apiBase: 'https://google.serper.dev',
      apiKey: 'serper-key'
    };
    const hunterPayload = {
      title: 'Hunter 邮箱补全',
      apiBase: 'https://api.hunter.io/v2',
      apiKey: 'hunter-key'
    };
    const serperConfig = buildSaveMySerperConfigRequestConfig(serperPayload);
    const hunterConfig = buildSaveMyHunterConfigRequestConfig(hunterPayload);

    assert.equal(serperConfig.url, '/ai-gateway/my-serper-config');
    assert.equal(serperConfig.method, 'post');
    assert.deepEqual(serperConfig.data, serperPayload);
    assert.equal(hunterConfig.url, '/ai-gateway/my-hunter-config');
    assert.equal(hunterConfig.method, 'post');
    assert.deepEqual(hunterConfig.data, hunterPayload);
  });
});
