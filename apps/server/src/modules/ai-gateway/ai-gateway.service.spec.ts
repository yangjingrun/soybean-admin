import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AiProviderConfigService } from './ai-provider-config.service';
import { AiGatewayService } from './ai-gateway.service';
import type { RequestUserContext } from '../../shared/request-context';
import type { SystemLogRecordInput } from '../system-log/system-log.types';
import type {
  AiModelConfigRecord,
  AiModelConfigStore,
  AiUserModelConfigRecord,
  AiUserModelConfigStore,
  AiUserHunterConfigRecord,
  AiUserHunterConfigStore,
  AiUserSerperConfigRecord,
  AiUserSerperConfigStore,
  HunterConfigRecord,
  HunterConfigStore,
  AiPromptRecord,
  AiPromptStore,
  AiPromptTestRunRecord,
  AiPromptVersionRecord,
  AiTextGenerateParams,
  AiTextGenerator,
  SerperConfigRecord,
  SerperConfigStore
} from './ai-gateway.types';

describe('AiGatewayService', () => {
  it('lists CRM outreach prompt modules in the workbench', async () => {
    const service = new AiGatewayService(
      createMemoryTextGenerator(),
      createMemoryPromptStore(),
      createMemoryModelConfigStore(),
      createMemoryUserModelConfigStore(),
      createMemoryLogRecorder()
    );

    const steps = await service.listPromptWorkbenchSteps();
    const crmSteps = steps.filter(step => step.group === 'crm_outreach');

    assert.deepEqual(
      crmSteps.map(step => step.promptKey),
      [
        'crm_outreach_base_rules',
        'crm_outreach_cold_email_core',
        'crm_outreach_sequence_strategy',
        'crm_outreach_role_persona',
        'crm_outreach_region_localization',
        'crm_outreach_public_source_grounding',
        'crm_outreach_subject_line',
        'crm_outreach_deliverability_guard',
        'crm_outreach_ai_polish',
        'crm_outreach_output_contract'
      ]
    );
    assert.equal(crmSteps.every(step => step.channel === 'crm_email'), true);
  });

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
    const service = new AiGatewayService(
      generator,
      promptStore,
      modelConfigStore,
      createMemoryUserModelConfigStore(),
      logRecorder
    );

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

  it('uses the current user personal model config and system prompt when generating with fixed keys', async () => {
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
    const userModelConfigStore = createMemoryUserModelConfigStore();
    const logRecorder = createMemoryLogRecorder();
    const service = new AiGatewayService(generator, promptStore, modelConfigStore, userModelConfigStore, logRecorder);

    await userModelConfigStore.saveUserModelConfig({
      userId: 'u-1',
      providerName: 'openai',
      apiBase: 'https://api.openai.com/v1',
      apiKey: 'sk-test',
      model: 'gpt-4o-mini',
      temperature: 0.2,
      maxOutputTokens: 1000,
      updatedAt: new Date().toISOString()
    });
    await service.savePrompt({
      promptKey: 'lead_keyword_optimize',
      title: ' 关键词优化 ',
      systemPrompt: ' 固定只输出 JSON，不要编造客户。 '
    });
    await service.generateText(
      {
        promptKey: 'lead_keyword_optimize',
        modelConfigKey: 'default',
        prompt: '找沙特轴承进口商'
      },
      { user: createUserContext('u-1') }
    );

    const generatedParams = captured as AiTextGenerateParams | null;

    assert.ok(generatedParams);
    assert.equal(generatedParams.apiBase, 'https://api.openai.com/v1');
    assert.equal(generatedParams.model, 'gpt-4o-mini');
    assert.equal(generatedParams.systemPrompt, '固定只输出 JSON，不要编造客户。');
  });

  it('rejects generation without a personal model config', async () => {
    let defaultConfigReads = 0;
    const modelConfigStore: AiModelConfigStore = {
      async getModelConfig() {
        defaultConfigReads += 1;
        return {
          configKey: 'default',
          title: '平台默认',
          providerName: 'openai',
          apiBase: 'https://api.openai.com/v1',
          apiKey: 'sk-platform',
          model: 'gpt-4o-mini',
          updatedAt: new Date().toISOString()
        };
      },
      async saveModelConfig(record) {
        return record;
      }
    };
    const service = new AiGatewayService(
      createMemoryTextGenerator(),
      createMemoryPromptStore(),
      modelConfigStore,
      createMemoryUserModelConfigStore(),
      createMemoryLogRecorder()
    );

    await assert.rejects(
      () => service.generateText({ prompt: 'hello' }, { user: createUserContext('u-missing') }),
      /请先配置个人模型通道/
    );
    assert.equal(defaultConfigReads, 0);
  });

  it('rejects generation when the current user personal API key is empty', async () => {
    const userModelConfigStore = createMemoryUserModelConfigStore();
    const service = new AiGatewayService(
      createMemoryTextGenerator(),
      createMemoryPromptStore(),
      createMemoryModelConfigStore(),
      userModelConfigStore,
      createMemoryLogRecorder()
    );

    await userModelConfigStore.saveUserModelConfig({
      userId: 'u-1',
      providerName: 'openai',
      apiBase: 'https://api.openai.com/v1',
      apiKey: '',
      model: 'gpt-4o-mini',
      updatedAt: new Date().toISOString()
    });

    await assert.rejects(
      () => service.generateText({ prompt: 'hello' }, { user: createUserContext('u-1') }),
      /请先配置个人模型通道/
    );
  });

  it('rejects non-inline generation without request user context', async () => {
    const service = new AiGatewayService(
      createMemoryTextGenerator(),
      createMemoryPromptStore(),
      createMemoryModelConfigStore(),
      createMemoryUserModelConfigStore(),
      createMemoryLogRecorder()
    );

    await assert.rejects(() => service.generateText({ prompt: 'hello' }), /请先登录/);
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
      createMemoryUserModelConfigStore([
        {
          userId: 'u-1',
          providerName: 'openai',
          apiBase: 'https://api.openai.com/v1',
          apiKey: 'sk-test',
          model: 'gpt-4o-mini',
          updatedAt: new Date().toISOString()
        }
      ]),
      createMemoryLogRecorder()
    );

    await service.generateText(
      {
        promptKey: 'lead_keyword_optimize',
        prompt: '我是河北卖轴承的，想找沙特进口商'
      },
      { user: createUserContext('u-1') }
    );

    const generatedParams = captured as AiTextGenerateParams | null;

    assert.ok(generatedParams);
    assert.match(generatedParams.systemPrompt || '', /serperSearchQueries/);
    assert.match(generatedParams.systemPrompt || '', /serperPlacesQueries/);
    assert.match(generatedParams.systemPrompt || '', /严禁生成真实公司名/);
  });

  it('returns the built-in prompt draft even when a saved prompt exists', async () => {
    const promptStore = createMemoryPromptStore();
    const service = new AiGatewayService(
      createMemoryTextGenerator(),
      promptStore,
      createMemoryModelConfigStore(),
      createMemoryUserModelConfigStore(),
      createMemoryLogRecorder()
    );

    await service.savePrompt({
      promptKey: 'lead_search_result_decide',
      title: '旧搜索结果决策',
      systemPrompt: '旧版本 Search / Places 提示词'
    });

    const saved = await service.getPrompt('lead_search_result_decide');
    const draft = await service.getDefaultPromptDraft('lead_search_result_decide');

    assert.equal(saved.systemPrompt, '旧版本 Search / Places 提示词');
    assert.notEqual(draft.systemPrompt, saved.systemPrompt);
    assert.match(draft.systemPrompt, /Search \/ Places \/ Maps/);
    assert.equal(draft.updatedAt, '');
  });

  it('saves prompt drafts without changing the published prompt used by generation', async () => {
    const promptStore = createMemoryPromptStore();
    const service = new AiGatewayService(
      createMemoryTextGenerator(),
      promptStore,
      createMemoryModelConfigStore(),
      createMemoryUserModelConfigStore(),
      createMemoryLogRecorder()
    );

    await service.savePrompt({
      promptKey: 'lead_maps_keyword_optimize',
      title: '地图关键词优化',
      systemPrompt: 'published prompt'
    });
    const draft = await service.savePromptDraft(
      {
        promptKey: 'lead_maps_keyword_optimize',
        title: '地图关键词优化',
        systemPrompt: createValidMapsPromptText(),
        changeNote: '调整地图规则'
      },
      createUserContext('u-1')
    );
    const published = await service.getPrompt('lead_maps_keyword_optimize');
    const detail = await service.getPromptWorkbenchDetail('lead_maps_keyword_optimize');

    assert.equal(draft.lifecycle, 'draft');
    assert.equal(draft.validationResult?.ok, true);
    assert.equal(published.systemPrompt, 'published prompt');
    assert.equal(detail.draft?.systemPrompt, createValidMapsPromptText());
    assert.equal(detail.published?.systemPrompt, 'published prompt');
  });

  it('publishes the current draft as the prompt used by generation', async () => {
    const promptStore = createMemoryPromptStore();
    const service = new AiGatewayService(
      createMemoryTextGenerator(),
      promptStore,
      createMemoryModelConfigStore(),
      createMemoryUserModelConfigStore(),
      createMemoryLogRecorder()
    );

    await service.savePromptDraft(
      {
        promptKey: 'lead_maps_keyword_optimize',
        title: '地图关键词优化',
        systemPrompt: createValidMapsPromptText(),
        changeNote: '准备发布'
      },
      createUserContext('u-1')
    );
    const version = await service.publishPromptDraft(
      {
        promptKey: 'lead_maps_keyword_optimize',
        changeNote: '发布地图规则'
      },
      createUserContext('u-1')
    );
    const published = await service.getPrompt('lead_maps_keyword_optimize');

    assert.equal(version.version, 1);
    assert.equal(version.lifecycle, 'published');
    assert.equal(published.systemPrompt, createValidMapsPromptText());
  });

  it('tests prompt drafts through the current user model config and records validation', async () => {
    let captured: AiTextGenerateParams | null = null;
    const generator: AiTextGenerator = {
      async generateText(params) {
        captured = params;

        return {
          text: createValidMapsOutputText(),
          finishReason: 'stop',
          usage: {
            inputTokens: 20,
            outputTokens: 30,
            totalTokens: 50
          }
        };
      }
    };
    const promptStore = createMemoryPromptStore();
    const userModelConfigStore = createMemoryUserModelConfigStore([
      {
        userId: 'u-1',
        providerName: 'openai',
        apiBase: 'https://api.openai.com/v1',
        apiKey: 'sk-test',
        model: 'gpt-4o-mini',
        temperature: 0.2,
        updatedAt: ''
      }
    ]);
    const service = new AiGatewayService(
      generator,
      promptStore,
      createMemoryModelConfigStore(),
      userModelConfigStore,
      createMemoryLogRecorder()
    );

    const result = await service.testPromptDraft(
      {
        promptKey: 'lead_maps_keyword_optimize',
        systemPrompt: createValidMapsPromptText(),
        inputPrompt: '找纽约轴承经销商'
      },
      createUserContext('u-1')
    );

    assert.equal(result.success, true);
    assert.equal(result.validationResult?.ok, true);
    assert.equal(result.outputText, createValidMapsOutputText());
    assert.equal(captured?.systemPrompt, createValidMapsPromptText());
    assert.equal(captured?.prompt, '找纽约轴承经销商');
    assert.equal((await promptStore.getLatestPromptTestRun('lead_maps_keyword_optimize'))?.success, true);
  });

  it('rolls back by publishing a new version copied from a historical version', async () => {
    const promptStore = createMemoryPromptStore();
    const service = new AiGatewayService(
      createMemoryTextGenerator(),
      promptStore,
      createMemoryModelConfigStore(),
      createMemoryUserModelConfigStore(),
      createMemoryLogRecorder()
    );

    await service.savePromptDraft(
      {
        promptKey: 'lead_maps_keyword_optimize',
        title: '地图关键词优化',
        systemPrompt: createValidMapsPromptText('旧版本'),
        changeNote: '旧版本'
      },
      createUserContext('u-1')
    );
    const oldVersion = await service.publishPromptDraft(
      {
        promptKey: 'lead_maps_keyword_optimize',
        changeNote: '发布旧版本'
      },
      createUserContext('u-1')
    );
    await service.savePromptDraft(
      {
        promptKey: 'lead_maps_keyword_optimize',
        title: '地图关键词优化',
        systemPrompt: createValidMapsPromptText('新版本'),
        changeNote: '新版本'
      },
      createUserContext('u-1')
    );
    await service.publishPromptDraft(
      {
        promptKey: 'lead_maps_keyword_optimize',
        changeNote: '发布新版本'
      },
      createUserContext('u-1')
    );

    const rollbackVersion = await service.rollbackPromptVersion(
      {
        promptKey: 'lead_maps_keyword_optimize',
        versionId: oldVersion.id,
        changeNote: '回滚到旧版本'
      },
      createUserContext('u-1')
    );
    const published = await service.getPrompt('lead_maps_keyword_optimize');

    assert.equal(rollbackVersion.version, 3);
    assert.match(published.systemPrompt, /旧版本/);
  });

  it('uses stable temperature and no output limit for saved model config by default', async () => {
    const service = new AiGatewayService(
      createMemoryTextGenerator(),
      createMemoryPromptStore(),
      createMemoryModelConfigStore(),
      createMemoryUserModelConfigStore(),
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
    assert.equal(record.hasApiKey, true);
    assert.equal(record.maskedApiKey, '****');
    assert.equal(record.apiKey, 'sk-test');
  });

  it('returns model config drafts with the saved API key for settings echo', async () => {
    const service = new AiGatewayService(
      createMemoryTextGenerator(),
      createMemoryPromptStore(),
      createMemoryModelConfigStore(),
      createMemoryUserModelConfigStore(),
      createMemoryLogRecorder()
    );

    await service.saveModelConfig({
      configKey: 'default',
      title: '默认模型',
      providerName: 'openrouter',
      apiBase: 'https://openrouter.ai/api/v1',
      apiKey: 'sk-secret-model-key',
      model: 'openai/gpt-4o-mini'
    });

    const draft = await service.getModelConfigDraft('default');

    assert.equal(draft.hasApiKey, true);
    assert.equal(draft.maskedApiKey, 'sk-s****-key');
    assert.equal(draft.apiKey, 'sk-secret-model-key');
  });

  it('saves and returns the current user personal model config for settings echo', async () => {
    const service = new AiGatewayService(
      createMemoryTextGenerator(),
      createMemoryPromptStore(),
      createMemoryModelConfigStore(),
      createMemoryUserModelConfigStore(),
      createMemoryLogRecorder()
    );

    const saved = await service.saveMyModelConfig(
      {
        providerName: ' openrouter ',
        apiBase: ' https://openrouter.ai/api/v1 ',
        apiKey: ' sk-user-secret ',
        model: ' openai/gpt-4o-mini ',
        temperature: 0.3,
        maxOutputTokens: 1200
      },
      createUserContext('u-1')
    );
    const draft = await service.getMyModelConfigDraft(createUserContext('u-1'));

    assert.equal(saved.providerName, 'openrouter');
    assert.equal(saved.apiBase, 'https://openrouter.ai/api/v1');
    assert.equal(saved.model, 'openai/gpt-4o-mini');
    assert.equal(saved.hasApiKey, true);
    assert.equal(saved.maskedApiKey, 'sk-u****cret');
    assert.equal(saved.apiKey, 'sk-user-secret');
    assert.equal(draft.apiKey, 'sk-user-secret');
  });

  it('preserves the current user personal API key when saving model fields without a new key', async () => {
    const userModelConfigStore = createMemoryUserModelConfigStore([
      {
        userId: 'u-1',
        providerName: 'openrouter',
        apiBase: 'https://openrouter.ai/api/v1',
        apiKey: 'sk-existing-user',
        model: 'openai/gpt-4o-mini',
        temperature: 0.2,
        updatedAt: new Date().toISOString()
      }
    ]);
    const service = new AiGatewayService(
      createMemoryTextGenerator(),
      createMemoryPromptStore(),
      createMemoryModelConfigStore(),
      userModelConfigStore,
      createMemoryLogRecorder()
    );

    const saved = await service.saveMyModelConfig(
      {
        providerName: 'openai',
        apiBase: 'https://api.openai.com/v1',
        model: 'gpt-4o-mini',
        apiKey: ''
      },
      createUserContext('u-1')
    );

    assert.equal(saved.providerName, 'openai');
    assert.equal(saved.apiKey, 'sk-existing-user');
    assert.equal(saved.hasApiKey, true);
  });

  it('rejects the first personal model config save without an API key', async () => {
    const service = new AiGatewayService(
      createMemoryTextGenerator(),
      createMemoryPromptStore(),
      createMemoryModelConfigStore(),
      createMemoryUserModelConfigStore(),
      createMemoryLogRecorder()
    );

    await assert.rejects(
      () =>
        service.saveMyModelConfig(
          {
            providerName: 'openrouter',
            apiBase: 'https://openrouter.ai/api/v1',
            model: 'openai/gpt-4o-mini'
          },
          createUserContext('u-missing')
        ),
      /请先填写个人模型 API Key/
    );
  });

  it('returns an editable personal model draft when the current user has no config', async () => {
    const service = new AiGatewayService(
      createMemoryTextGenerator(),
      createMemoryPromptStore(),
      createMemoryModelConfigStore(),
      createMemoryUserModelConfigStore(),
      createMemoryLogRecorder()
    );

    const draft = await service.getMyModelConfigDraft(createUserContext('u-missing'));

    assert.equal(draft.providerName, 'openrouter');
    assert.equal(draft.apiBase, 'https://openrouter.ai/api/v1');
    assert.equal(draft.model, 'openai/gpt-4o-mini');
    assert.equal(draft.hasApiKey, false);
    assert.equal(draft.maskedApiKey, '');
    assert.equal(draft.apiKey, '');
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
    const service = new AiGatewayService(
      generator,
      promptStore,
      modelConfigStore,
      createMemoryUserModelConfigStore(),
      logRecorder
    );

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
    const service = new AiGatewayService(
      generator,
      promptStore,
      modelConfigStore,
      createMemoryUserModelConfigStore(),
      logRecorder
    );

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
        model: 'openai/gpt-4o-mini',
        errorCategory: 'external_service',
        errorName: 'Error'
      }
    });
  });

  it('saves and returns Serper config API key without logging it', async () => {
    const logRecorder = createMemoryLogRecorder();
    const providerConfigService = new AiProviderConfigService(
      createMemoryUserSerperConfigStore(),
      createMemoryUserHunterConfigStore(),
      createMemorySerperConfigStore(),
      {
        async search(config, request) {
          assert.equal(config.apiKey, 'serper-key');
          assert.deepEqual(request, { q: 'test', gl: 'us', hl: 'en', num: 1, page: 1 });

          return {
            organic: [{ title: 'Example', link: 'https://example.com' }]
          };
        }
      },
      createMemoryHunterConfigStore(),
      {
        async domainSearch() {
          return { data: { emails: [] } };
        }
      },
      logRecorder
    );
    const service = new AiGatewayService(
      createMemoryTextGenerator(),
      createMemoryPromptStore(),
      createMemoryModelConfigStore(),
      createMemoryUserModelConfigStore(),
      logRecorder,
      providerConfigService
    );

    const saved = await service.saveSerperConfig(
      {
        configKey: ' default ',
        title: ' Serper ',
        apiBase: ' https://google.serper.dev ',
        apiKey: ' serper-key '
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
    const draft = await service.getSerperConfigDraft('default');
    const testResult = await service.testSerperConfig({
      configKey: 'default',
      title: 'Serper',
      apiBase: 'https://google.serper.dev',
      apiKey: 'serper-key'
    });

    assert.equal(saved.apiBase, 'https://google.serper.dev');
    assert.equal(saved.hasApiKey, true);
    assert.equal(saved.maskedApiKey, 'serp****-key');
    assert.equal(saved.apiKey, 'serper-key');
    assert.equal(draft.hasApiKey, true);
    assert.equal(draft.maskedApiKey, 'serp****-key');
    assert.equal(draft.apiKey, 'serper-key');
    assert.deepEqual(testResult, {
      ok: true,
      result: {
        organic: [{ title: 'Example', link: 'https://example.com' }]
      }
    });
    assert.equal(
      logRecorder.records.some(record => JSON.stringify(record.metadata).includes('serper-key')),
      false
    );
    assert.deepEqual(
      logRecorder.records.map(record => record.action),
      ['save-serper-config', 'test-serper-config']
    );
  });

  it('saves and returns Hunter config API key without logging it', async () => {
    const logRecorder = createMemoryLogRecorder();
    const providerConfigService = new AiProviderConfigService(
      createMemoryUserSerperConfigStore(),
      createMemoryUserHunterConfigStore(),
      createMemorySerperConfigStore(),
      {
        async search() {
          return {};
        }
      },
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
      },
      logRecorder
    );
    const service = new AiGatewayService(
      createMemoryTextGenerator(),
      createMemoryPromptStore(),
      createMemoryModelConfigStore(),
      createMemoryUserModelConfigStore(),
      logRecorder,
      providerConfigService
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
    assert.equal(saved.hasApiKey, true);
    assert.equal(saved.maskedApiKey, 'hunt****-key');
    assert.equal(saved.apiKey, 'hunter-key');
    assert.equal(draft.hasApiKey, true);
    assert.equal(draft.maskedApiKey, 'hunt****-key');
    assert.equal(draft.apiKey, 'hunter-key');
    assert.deepEqual(testResult, {
      ok: true,
      resultEmailCount: 1
    });
    assert.equal(JSON.stringify(testResult).includes('alice@example.com'), false);
    assert.equal(
      logRecorder.records.some(record => JSON.stringify(record.metadata).includes('hunter-key')),
      false
    );
    assert.deepEqual(
      logRecorder.records.map(record => record.action),
      ['save-hunter-config', 'test-hunter-config']
    );
  });

  it('saves and tests personal Serper config while preserving an existing API key', async () => {
    const logRecorder = createMemoryLogRecorder();
    const providerConfigService = new AiProviderConfigService(
      createMemoryUserSerperConfigStore([
        {
          userId: 'u-1',
          title: 'Serper 搜索',
          apiBase: 'https://google.serper.dev',
          apiKey: 'serper-old',
          updatedAt: ''
        }
      ]),
      createMemoryUserHunterConfigStore(),
      createMemorySerperConfigStore(),
      {
        async search(config) {
          assert.equal(config.apiKey, 'serper-old');

          return { organic: [] };
        }
      },
      createMemoryHunterConfigStore(),
      {
        async domainSearch() {
          return { data: { emails: [] } };
        }
      },
      logRecorder
    );
    const user = createUserContext('u-1');

    const saved = await providerConfigService.saveMySerperConfig(
      {
        title: '我的 Serper',
        apiBase: 'https://google.serper.dev'
      },
      user
    );
    const testResult = await providerConfigService.testMySerperConfig(
      {
        title: '我的 Serper',
        apiBase: 'https://google.serper.dev'
      },
      user
    );
    const runtime = await providerConfigService.getRequiredUserSerperConfig(user);

    assert.equal(saved.hasApiKey, true);
    assert.equal(saved.apiKey, 'serper-old');
    assert.deepEqual(testResult, { ok: true, result: { organic: [] } });
    assert.equal(runtime.configKey, 'user:u-1');
    assert.equal(runtime.apiKey, 'serper-old');
    assert.equal(
      logRecorder.records.some(record => JSON.stringify(record.metadata).includes('serper-old')),
      false
    );
  });

  it('saves and tests personal Hunter config while preserving an existing API key', async () => {
    const logRecorder = createMemoryLogRecorder();
    const providerConfigService = new AiProviderConfigService(
      createMemoryUserSerperConfigStore(),
      createMemoryUserHunterConfigStore([
        {
          userId: 'u-1',
          title: 'Hunter 邮箱补全',
          apiBase: 'https://api.hunter.io/v2',
          apiKey: 'hunter-old',
          updatedAt: ''
        }
      ]),
      createMemorySerperConfigStore(),
      {
        async search() {
          return {};
        }
      },
      createMemoryHunterConfigStore(),
      {
        async domainSearch(config) {
          assert.equal(config.apiKey, 'hunter-old');

          return { data: { emails: [{ value: 'a@example.com' }] } };
        }
      },
      logRecorder
    );
    const user = createUserContext('u-1');

    const saved = await providerConfigService.saveMyHunterConfig(
      {
        title: '我的 Hunter',
        apiBase: 'https://api.hunter.io/v2'
      },
      user
    );
    const testResult = await providerConfigService.testMyHunterConfig(
      {
        title: '我的 Hunter',
        apiBase: 'https://api.hunter.io/v2'
      },
      user
    );
    const runtime = await providerConfigService.getRequiredUserHunterConfig(user);

    assert.equal(saved.hasApiKey, true);
    assert.equal(saved.apiKey, 'hunter-old');
    assert.deepEqual(testResult, { ok: true, resultEmailCount: 1 });
    assert.equal(runtime.configKey, 'user:u-1');
    assert.equal(runtime.apiKey, 'hunter-old');
    assert.equal(
      logRecorder.records.some(record => JSON.stringify(record.metadata).includes('hunter-old')),
      false
    );
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
  const versions = new Map<string, AiPromptVersionRecord>();
  const testRuns: AiPromptTestRunRecord[] = [];

  return {
    async getPrompt(promptKey) {
      return prompts.get(promptKey) ?? null;
    },
    async savePrompt(record) {
      prompts.set(record.promptKey, record);
      return record;
    },
    async getDraftPromptVersion(promptKey) {
      return versions.get(toVersionKey(promptKey, 0)) ?? null;
    },
    async saveDraftPromptVersion(input) {
      const now = new Date().toISOString();
      const record: AiPromptVersionRecord = {
        id: `${input.promptKey}-draft`,
        promptKey: input.promptKey,
        title: input.title,
        version: 0,
        lifecycle: 'draft',
        systemPrompt: input.systemPrompt,
        validationResult: input.validationResult,
        changeNote: input.changeNote ?? null,
        createdById: input.userId ?? null,
        createdByName: input.userName ?? null,
        publishedAt: null,
        createdAt: versions.get(toVersionKey(input.promptKey, 0))?.createdAt ?? now,
        updatedAt: now
      };

      versions.set(toVersionKey(input.promptKey, 0), record);

      return record;
    },
    async publishDraftPromptVersion(input) {
      const draft = versions.get(toVersionKey(input.promptKey, 0));

      if (!draft) {
        throw new Error('提示词草稿不存在');
      }

      const nextVersion =
        [...versions.values()]
          .filter(record => record.promptKey === input.promptKey && record.version > 0)
          .reduce((maxVersion, record) => Math.max(maxVersion, record.version), 0) + 1;
      const now = new Date().toISOString();
      const published: AiPromptVersionRecord = {
        ...draft,
        id: `${input.promptKey}-v${nextVersion}`,
        version: nextVersion,
        lifecycle: 'published',
        changeNote: input.changeNote ?? draft.changeNote,
        createdById: input.userId ?? draft.createdById,
        createdByName: input.userName ?? draft.createdByName,
        publishedAt: now,
        createdAt: now,
        updatedAt: now
      };

      versions.set(toVersionKey(input.promptKey, nextVersion), published);
      versions.delete(toVersionKey(input.promptKey, 0));
      prompts.set(input.promptKey, {
        promptKey: input.promptKey,
        title: draft.title,
        systemPrompt: draft.systemPrompt,
        updatedAt: now
      });

      return published;
    },
    async getPromptVersionById(id) {
      return [...versions.values()].find(record => record.id === id) ?? null;
    },
    async listPromptVersions(promptKey, limit) {
      return [...versions.values()]
        .filter(record => record.promptKey === promptKey && record.version > 0)
        .sort((left, right) => right.version - left.version)
        .slice(0, limit);
    },
    async recordPromptTestRun(input) {
      const record: AiPromptTestRunRecord = {
        id: `test-run-${testRuns.length + 1}`,
        promptKey: input.promptKey,
        inputPrompt: input.inputPrompt,
        outputText: input.outputText ?? null,
        validationResult: input.validationResult,
        success: input.success,
        durationMs: input.durationMs ?? null,
        errorMessage: input.errorMessage ?? null,
        createdById: input.userId ?? null,
        createdByName: input.userName ?? null,
        createdAt: new Date().toISOString()
      };

      testRuns.push(record);

      return record;
    },
    async getLatestPromptTestRun(promptKey) {
      return testRuns.filter(record => record.promptKey === promptKey).at(-1) ?? null;
    }
  };
}

function toVersionKey(promptKey: string, version: number) {
  return `${promptKey}:${version}`;
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

function createMemoryUserModelConfigStore(records: AiUserModelConfigRecord[] = []): AiUserModelConfigStore {
  const configs = new Map<string, AiUserModelConfigRecord>();

  for (const record of records) {
    configs.set(record.userId, record);
  }

  return {
    async getUserModelConfig(userId) {
      return configs.get(userId) ?? null;
    },
    async saveUserModelConfig(record) {
      configs.set(record.userId, record);
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

function createMemoryUserHunterConfigStore(records: AiUserHunterConfigRecord[] = []): AiUserHunterConfigStore {
  const configs = new Map<string, AiUserHunterConfigRecord>();

  for (const record of records) {
    configs.set(record.userId, record);
  }

  return {
    async getUserHunterConfig(userId) {
      return configs.get(userId) ?? null;
    },
    async saveUserHunterConfig(record) {
      configs.set(record.userId, record);
      return record;
    }
  };
}

function createUserContext(userId: string): RequestUserContext {
  return {
    userId,
    userName: 'User',
    roles: ['R_USER'],
    organizationId: 'org-1',
    organizationRole: 'member'
  };
}

function createValidMapsPromptText(marker = '') {
  return [
    `你是 Maps Agent。${marker}`,
    '只输出一个合法 JSON 对象。',
    'serperMapsQueries 输出 5-8 条。',
    'serperSearchQueries 必须是空数组。',
    'serperPlacesQueries 必须是空数组。',
    '不要新增 JSON 顶层字段。'
  ].join('\n');
}

function createValidMapsOutputText() {
  return JSON.stringify({
    resolvedProductKeywords: '轴承 bearing',
    resolvedTargetRegions: '美国纽约州',
    resolvedTargetCustomerProfile: '本地工业用品经销商和维修服务商',
    resolvedTargetLeadCount: null,
    structuredRequirement: '寻找美国纽约州有门店或地址电话的轴承相关 B2B 商家。',
    buyerSegments: [
      createBuyerSegment('bearing distributor'),
      createBuyerSegment('industrial supplier'),
      createBuyerSegment('bearing repair service')
    ],
    serperSearchQueries: [],
    serperPlacesQueries: [],
    serperMapsQueries: [
      createMapsQuery('bearing distributor', 'local_distributor'),
      createMapsQuery('bearing wholesale', 'local_wholesaler'),
      createMapsQuery('industrial supplier', 'industrial_supplier'),
      createMapsQuery('bearing repair service', 'repair_service'),
      createMapsQuery('power transmission supplier', 'mro_supplier')
    ],
    searchExecutionRules: {
      channelPriority: ['maps'],
      mapsUsage: 'Maps 用于查找本地经销商、工业用品供应商、维修服务商、门店型批发商等有地址电话的实体商家。',
      defaultDateRange: 'any_time',
      keep: ['distributor', 'industrial supplier'],
      exclude: ['school', 'blog'],
      websiteCheckPages: ['Products', 'Brands', 'Contact'],
      dedupeKeys: ['cid', 'placeId', 'website']
    }
  });
}

function createBuyerSegment(buyerType: string) {
  return {
    buyerType,
    purchaseReason: '可能采购轴承产品',
    websiteSignals: ['Products', 'Brands'],
    priorityContacts: ['Purchasing Manager'],
    priorityLevel: '高',
    preferredSerperChannel: 'maps'
  };
}

function createMapsQuery(q: string, intent: string) {
  return {
    endpoint: 'maps',
    requestBody: {
      q,
      hl: 'en',
      ll: '@41.6469296,-73.2681778,8z',
      page: 1
    },
    meta: {
      buyerType: 'bearing buyer',
      intent,
      city: 'New York',
      priority: '高',
      expectedPlaceTypes: ['Industrial equipment supplier'],
      reason: '这条适合用 Maps 找有地址电话的本地实体商家'
    }
  };
}

function createMemorySerperConfigStore(): SerperConfigStore {
  const configs = new Map<string, SerperConfigRecord>();

  return {
    async getSerperConfig(configKey) {
      return configs.get(configKey) ?? null;
    },
    async saveSerperConfig(record) {
      configs.set(record.configKey, record);
      return record;
    }
  };
}

function createMemoryUserSerperConfigStore(records: AiUserSerperConfigRecord[] = []): AiUserSerperConfigStore {
  const configs = new Map<string, AiUserSerperConfigRecord>();

  for (const record of records) {
    configs.set(record.userId, record);
  }

  return {
    async getUserSerperConfig(userId) {
      return configs.get(userId) ?? null;
    },
    async saveUserSerperConfig(record) {
      configs.set(record.userId, record);
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
