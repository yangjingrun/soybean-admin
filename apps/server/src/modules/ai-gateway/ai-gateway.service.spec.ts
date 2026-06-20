import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AiGatewayService } from './ai-gateway.service';
import type { SystemLogRecordInput } from '../system-log/system-log.types';
import type {
  AiModelConfigRecord,
  AiModelConfigStore,
  HunterConfigRecord,
  HunterConfigStore,
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
    const logRecorder = createMemoryLogRecorder();
    const service = new AiGatewayService(generator, promptStore, modelConfigStore, logRecorder);

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
    const logRecorder = createMemoryLogRecorder();
    const service = new AiGatewayService(generator, promptStore, modelConfigStore, logRecorder);

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
      promptKey: 'lead_keyword_optimize',
      title: ' 关键词优化 ',
      systemPrompt: ' 固定只输出 JSON，不要编造客户。 '
    });
    await service.generateText({
      promptKey: 'lead_keyword_optimize',
      modelConfigKey: 'default',
      prompt: '找沙特轴承进口商'
    });

    const generatedParams = captured as AiTextGenerateParams | null;

    assert.ok(generatedParams);
    assert.equal(generatedParams.apiBase, 'https://api.openai.com/v1');
    assert.equal(generatedParams.model, 'gpt-4o-mini');
    assert.equal(generatedParams.systemPrompt, '固定只输出 JSON，不要编造客户。');
  });

  it('uses the default Serper keyword prompt when no fixed prompt is saved', async () => {
    let captured: AiTextGenerateParams | null = null;
    const generator: AiTextGenerator = {
      async generateText(params) {
        captured = params;

        return {
          text: '{"serperSearchQueries":[],"serperPlacesQueries":[]}',
          finishReason: 'stop',
          usage: {
            inputTokens: 10,
            outputTokens: 5,
            totalTokens: 15
          }
        };
      }
    };
    const service = new AiGatewayService(
      generator,
      createMemoryPromptStore(),
      createMemoryModelConfigStore(),
      createMemoryLogRecorder()
    );

    await service.saveModelConfig({
      configKey: 'default',
      title: '默认模型',
      providerName: 'openai',
      apiBase: 'https://api.openai.com/v1',
      apiKey: 'sk-test',
      model: 'gpt-4o-mini'
    });
    await service.generateText({
      promptKey: 'lead_keyword_optimize',
      modelConfigKey: 'default',
      prompt: '我是河北卖轴承的，想找沙特进口商'
    });

    const generatedParams = captured as AiTextGenerateParams | null;

    assert.ok(generatedParams);
    assert.match(generatedParams.systemPrompt || '', /serperSearchQueries/);
    assert.match(generatedParams.systemPrompt || '', /serperPlacesQueries/);
    assert.match(generatedParams.systemPrompt || '', /严禁生成真实公司名/);
  });

  it('uses stable temperature and no output limit for saved model config by default', async () => {
    const service = new AiGatewayService(
      createMemoryTextGenerator(),
      createMemoryPromptStore(),
      createMemoryModelConfigStore(),
      createMemoryLogRecorder()
    );

    const record = await service.saveModelConfig({
      configKey: 'default',
      title: '默认模型',
      providerName: 'openrouter',
      apiBase: 'https://openrouter.ai/api/v1',
      apiKey: 'sk-test',
      model: 'openai/gpt-4o-mini'
    });

    assert.equal(record.temperature, 0.2);
    assert.equal(record.maxOutputTokens, undefined);
  });

  it('records a success log when text generation succeeds', async () => {
    const generator: AiTextGenerator = {
      async generateText() {
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
    const logRecorder = createMemoryLogRecorder();
    const service = new AiGatewayService(generator, promptStore, modelConfigStore, logRecorder);

    await service.generateText(
      {
        providerName: 'openrouter',
        apiBase: 'https://openrouter.ai/api/v1',
        apiKey: 'sk-test',
        model: 'openai/gpt-4o-mini',
        prompt: '找客户'
      },
      {
        user: {
          userId: 'u-1',
          userName: 'Super',
          roles: ['R_SUPER'],
          organizationId: 'org-1',
          organizationRole: 'admin'
        }
      }
    );

    assert.equal(logRecorder.records.length, 3);
    const successRequestId = (logRecorder.records[0].metadata as { requestId: string }).requestId;

    assert.match(successRequestId, /^[0-9a-f-]{36}$/);
    assert.deepEqual(logRecorder.records[0], {
      level: 'info',
      status: 'processing',
      module: 'ai-gateway',
      action: 'generate-text-progress',
      message: 'AI 文本生成开始',
      userId: 'u-1',
      userName: 'Super',
      metadata: {
        requestId: successRequestId,
        stage: 'request-received',
        hasInlineModelConfig: true
      }
    });
    assert.deepEqual(logRecorder.records[1], {
      level: 'info',
      status: 'processing',
      module: 'ai-gateway',
      action: 'generate-text-progress',
      message: 'AI 模型调用中',
      userId: 'u-1',
      userName: 'Super',
      metadata: {
        requestId: successRequestId,
        stage: 'calling-model',
        providerName: 'openrouter',
        model: 'openai/gpt-4o-mini'
      }
    });
    assert.deepEqual(logRecorder.records[2], {
      level: 'info',
      status: 'success',
      module: 'ai-gateway',
      action: 'generate-text',
      message: 'AI 文本生成成功',
      userId: 'u-1',
      userName: 'Super',
      metadata: {
        requestId: successRequestId,
        stage: 'completed',
        providerName: 'openrouter',
        model: 'openai/gpt-4o-mini',
        usage: {
          inputTokens: 5,
          outputTokens: 1,
          totalTokens: 6
        }
      }
    });
  });

  it('records a failed log and rethrows when text generation fails', async () => {
    const cause = new Error('upstream failed');
    const generator: AiTextGenerator = {
      async generateText() {
        throw cause;
      }
    };
    const promptStore = createMemoryPromptStore();
    const modelConfigStore = createMemoryModelConfigStore();
    const logRecorder = createMemoryLogRecorder();
    const service = new AiGatewayService(generator, promptStore, modelConfigStore, logRecorder);

    await assert.rejects(
      () =>
        service.generateText(
          {
            providerName: 'openrouter',
            apiBase: 'https://openrouter.ai/api/v1',
            apiKey: 'sk-test',
            model: 'openai/gpt-4o-mini',
            prompt: '找客户'
          },
          {
            user: {
              userId: 'u-1',
              userName: 'Super',
              roles: ['R_SUPER'],
              organizationId: 'org-1',
              organizationRole: 'admin'
            }
          }
        ),
      cause
    );

    assert.equal(logRecorder.records.length, 3);
    const failedRequestId = (logRecorder.records[0].metadata as { requestId: string }).requestId;

    assert.match(failedRequestId, /^[0-9a-f-]{36}$/);
    assert.deepEqual(logRecorder.records[0], {
      level: 'info',
      status: 'processing',
      module: 'ai-gateway',
      action: 'generate-text-progress',
      message: 'AI 文本生成开始',
      userId: 'u-1',
      userName: 'Super',
      metadata: {
        requestId: failedRequestId,
        stage: 'request-received',
        hasInlineModelConfig: true
      }
    });
    assert.deepEqual(logRecorder.records[1], {
      level: 'info',
      status: 'processing',
      module: 'ai-gateway',
      action: 'generate-text-progress',
      message: 'AI 模型调用中',
      userId: 'u-1',
      userName: 'Super',
      metadata: {
        requestId: failedRequestId,
        stage: 'calling-model',
        providerName: 'openrouter',
        model: 'openai/gpt-4o-mini'
      }
    });
    assert.deepEqual(logRecorder.records[2], {
      level: 'error',
      status: 'failed',
      module: 'ai-gateway',
      action: 'generate-text',
      message: 'AI 文本生成失败',
      userId: 'u-1',
      userName: 'Super',
      errorMessage: 'upstream failed',
      metadata: {
        requestId: failedRequestId,
        stage: 'failed',
        providerName: 'openrouter',
        model: 'openai/gpt-4o-mini'
      }
    });
  });

  it('saves and tests Hunter config without logging the API key', async () => {
    const logRecorder = createMemoryLogRecorder();
    const service = new AiGatewayService(
      createMemoryTextGenerator(),
      createMemoryPromptStore(),
      createMemoryModelConfigStore(),
      logRecorder,
      undefined,
      undefined,
      createMemoryHunterConfigStore(),
      {
        async domainSearch(config, request) {
          assert.equal(config.apiKey, 'hunter-key');
          assert.deepEqual(request, { domain: 'example.com', limit: 1, offset: 0 });

          return {
            data: {
              emails: [{ value: 'alice@example.com' }]
            }
          };
        }
      }
    );

    const saved = await service.saveHunterConfig(
      {
        configKey: ' default ',
        title: ' Hunter ',
        apiBase: ' https://api.hunter.io/v2/ ',
        apiKey: ' hunter-key '
      },
      {
        user: {
          userId: 'u-1',
          userName: 'Super',
          roles: ['R_SUPER'],
          organizationId: 'org-1',
          organizationRole: 'admin'
        }
      }
    );
    const draft = await service.getHunterConfigDraft('default');
    const testResult = await service.testHunterConfig({
      configKey: 'default',
      title: 'Hunter',
      apiBase: 'https://api.hunter.io/v2',
      apiKey: 'hunter-key'
    });

    assert.equal(saved.apiBase, 'https://api.hunter.io/v2/');
    assert.equal(draft.apiKey, 'hunter-key');
    assert.deepEqual(testResult, {
      ok: true,
      resultEmailCount: 1
    });
    assert.equal(JSON.stringify(testResult).includes('alice@example.com'), false);
    assert.equal(logRecorder.records.some(record => JSON.stringify(record.metadata).includes('hunter-key')), false);
    assert.deepEqual(logRecorder.records.map(record => record.action), ['save-hunter-config', 'test-hunter-config']);
  });
});

function createMemoryTextGenerator(): AiTextGenerator {
  return {
    async generateText() {
      return {
        text: 'done',
        finishReason: 'stop',
        usage: {
          inputTokens: 1,
          outputTokens: 1,
          totalTokens: 2
        }
      };
    }
  };
}

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

function createMemoryHunterConfigStore(): HunterConfigStore {
  const configs = new Map<string, HunterConfigRecord>();

  return {
    async getHunterConfig(configKey) {
      return configs.get(configKey) ?? null;
    },
    async saveHunterConfig(record) {
      configs.set(record.configKey, record);
      return record;
    }
  };
}

function createMemoryLogRecorder() {
  const records: SystemLogRecordInput[] = [];

  return {
    records,
    async record(input: SystemLogRecordInput) {
      records.push(input);
    }
  };
}
