import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AiGatewayService } from './ai-gateway.service';
import type {
  AiModelConfigRecord,
  AiModelConfigStore,
  AiPromptRecord,
  AiPromptStore,
  AiTextGenerateParams,
  AiTextGenerator
} from './ai-gateway.types';

describe('AiGatewayService', () => {
  it('trims model config and delegates generation to the text generator', async () => {
    let captured: AiTextGenerateParams | null = null;
    const generator: AiTextGenerator = {
      async generateText(params) {
        captured = params;

        return {
          text: '["bearing importer saudi arabia"]',
          finishReason: 'stop',
          usage: {
            inputTokens: 12,
            outputTokens: 8,
            totalTokens: 20
          }
        };
      }
    };
    const promptStore = createMemoryPromptStore();
    const modelConfigStore = createMemoryModelConfigStore();
    const service = new AiGatewayService(generator, promptStore, modelConfigStore);

    const result = await service.generateText({
      providerName: ' openrouter ',
      apiBase: ' https://openrouter.ai/api/v1 ',
      apiKey: ' sk-test ',
      model: ' openai/gpt-4o-mini ',
      systemPrompt: ' You generate B2B search keywords. ',
      prompt: ' 找沙特轴承进口商 ',
      temperature: 0.2,
      maxOutputTokens: 400
    });

    assert.deepEqual(captured, {
      providerName: 'openrouter',
      apiBase: 'https://openrouter.ai/api/v1',
      apiKey: 'sk-test',
      model: 'openai/gpt-4o-mini',
      systemPrompt: 'You generate B2B search keywords.',
      prompt: '找沙特轴承进口商',
      temperature: 0.2,
      maxOutputTokens: 400
    });
    assert.equal(result.text, '["bearing importer saudi arabia"]');
    assert.equal(result.usage.totalTokens, 20);
  });

  it('uses saved model config and system prompt when generating with fixed keys', async () => {
    let captured: AiTextGenerateParams | null = null;
    const generator: AiTextGenerator = {
      async generateText(params) {
        captured = params;

        return {
          text: 'done',
          finishReason: 'stop',
          usage: {
            inputTokens: 5,
            outputTokens: 1,
            totalTokens: 6
          }
        };
      }
    };
    const promptStore = createMemoryPromptStore();
    const modelConfigStore = createMemoryModelConfigStore();
    const service = new AiGatewayService(generator, promptStore, modelConfigStore);

    await service.saveModelConfig({
      configKey: 'default',
      title: '默认模型',
      providerName: ' openai ',
      apiBase: ' https://api.openai.com/v1 ',
      apiKey: ' sk-test ',
      model: ' gpt-4o-mini ',
      temperature: 0.2,
      maxOutputTokens: 1000
    });
    await service.savePrompt({
      promptKey: 'leadgen',
      title: ' AI 获客 ',
      systemPrompt: ' 固定只输出 JSON，不要编造客户。 '
    });
    await service.generateText({
      promptKey: 'leadgen',
      modelConfigKey: 'default',
      prompt: '找沙特轴承进口商'
    });

    const generatedParams = captured as AiTextGenerateParams | null;

    assert.ok(generatedParams);
    assert.equal(generatedParams.apiBase, 'https://api.openai.com/v1');
    assert.equal(generatedParams.model, 'gpt-4o-mini');
    assert.equal(generatedParams.systemPrompt, '固定只输出 JSON，不要编造客户。');
  });
});

function createMemoryPromptStore(): AiPromptStore {
  const prompts = new Map<string, AiPromptRecord>();

  return {
    async getPrompt(promptKey) {
      return prompts.get(promptKey) ?? null;
    },
    async savePrompt(record) {
      prompts.set(record.promptKey, record);
      return record;
    }
  };
}

function createMemoryModelConfigStore(): AiModelConfigStore {
  const configs = new Map<string, AiModelConfigRecord>();

  return {
    async getModelConfig(configKey) {
      return configs.get(configKey) ?? null;
    },
    async saveModelConfig(record) {
      configs.set(record.configKey, record);
      return record;
    }
  };
}
