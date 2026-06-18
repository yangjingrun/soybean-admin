import { randomUUID } from 'node:crypto';
import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { SystemLogService } from '../system-log/system-log.service';
import type { SystemLogRecorder } from '../system-log/system-log.types';
import type { UserInfo } from '../auth/auth.types';
import {
  aiPromptDefinitions,
  aiPromptKeys,
  defaultAiPromptSystemPrompts,
  defaultAiModelConfigKey,
  defaultSerperApiBase,
  defaultSerperConfigKey,
  defaultAiTemperature
} from './ai-gateway.constants';
import { AI_MODEL_CONFIG_STORE, AI_PROMPT_STORE, AI_TEXT_GENERATOR, SERPER_CONFIG_STORE } from './ai-gateway.tokens';
import type { GenerateAiTextDto } from './dto/generate-ai-text.dto';
import type { SaveAiPromptDto } from './dto/ai-prompt.dto';
import type { SaveAiModelConfigDto } from './dto/ai-model-config.dto';
import type { SaveSerperConfigDto } from './dto/serper-config.dto';
import { SerperClient } from './serper-client.service';
import type {
  AiModelConfigRecord,
  AiModelConfigStore,
  AiPromptRecord,
  AiPromptStore,
  AiTextGenerateParams,
  AiTextGenerator,
  SerperConfigRecord,
  SerperConfigStore
} from './ai-gateway.types';

@Injectable()
export class AiGatewayService {
  constructor(
    @Inject(AI_TEXT_GENERATOR) private readonly textGenerator: AiTextGenerator,
    @Inject(AI_PROMPT_STORE) private readonly promptStore: AiPromptStore,
    @Inject(AI_MODEL_CONFIG_STORE) private readonly modelConfigStore: AiModelConfigStore,
    @Inject(SystemLogService) private readonly systemLogService: SystemLogRecorder,
    @Optional() @Inject(SERPER_CONFIG_STORE) private readonly serperConfigStore?: SerperConfigStore,
    @Optional() @Inject(SerperClient) private readonly serperClient?: SerperClient
  ) {}

  /** Saves a fixed system prompt that can be referenced by promptKey during generation. */
  async savePrompt(dto: SaveAiPromptDto): Promise<AiPromptRecord> {
    const promptKey = normalizePromptKey(dto.promptKey);
    const systemPrompt = dto.systemPrompt.trim();

    if (!systemPrompt) {
      throw new BadRequestException('系统提示词不能为空');
    }

    return this.promptStore.savePrompt({
      promptKey,
      title: dto.title.trim() || promptKey,
      systemPrompt,
      updatedAt: new Date().toISOString()
    });
  }

  /** Saves the backend model channel used by AI business workflows. */
  async saveModelConfig(dto: SaveAiModelConfigDto): Promise<AiModelConfigRecord> {
    const configKey = normalizeModelConfigKey(dto.configKey);

    return this.modelConfigStore.saveModelConfig({
      configKey,
      title: dto.title.trim() || '默认模型',
      providerName: dto.providerName.trim(),
      apiBase: dto.apiBase.trim(),
      apiKey: dto.apiKey.trim(),
      model: dto.model.trim(),
      temperature: dto.temperature ?? defaultAiTemperature,
      maxOutputTokens: dto.maxOutputTokens,
      updatedAt: new Date().toISOString()
    });
  }

  /** Reads one saved backend model channel by key. */
  async getModelConfig(configKey = defaultAiModelConfigKey): Promise<AiModelConfigRecord> {
    const normalizedKey = normalizeModelConfigKey(configKey);
    const record = await this.modelConfigStore.getModelConfig(normalizedKey);

    if (!record) {
      throw new NotFoundException(`未找到模型配置：${normalizedKey}`);
    }

    return record;
  }

  /** Saves the Serper search channel used by AI leads search orchestration. */
  async saveSerperConfig(dto: SaveSerperConfigDto, context: GenerateAiTextContext = {}): Promise<SerperConfigRecord> {
    const configKey = normalizeSerperConfigKey(dto.configKey);
    const store = this.requireSerperConfigStore();
    const record = await store.saveSerperConfig({
      configKey,
      title: dto.title.trim() || 'Serper 搜索',
      apiBase: dto.apiBase.trim(),
      apiKey: dto.apiKey.trim(),
      updatedAt: new Date().toISOString()
    });

    await this.systemLogService.record({
      level: 'info',
      status: 'success',
      module: 'ai-gateway',
      action: 'save-serper-config',
      message: 'Serper 搜索配置已保存',
      userId: context.user?.userId,
      userName: context.user?.userName,
      metadata: {
        configKey: record.configKey,
        apiBase: record.apiBase
      }
    });

    return record;
  }

  /** Reads one saved Serper search channel by key. */
  async getSerperConfig(configKey = defaultSerperConfigKey): Promise<SerperConfigRecord> {
    const normalizedKey = normalizeSerperConfigKey(configKey);
    const record = await this.requireSerperConfigStore().getSerperConfig(normalizedKey);

    if (!record) {
      throw new NotFoundException(`未找到 Serper 配置：${normalizedKey}`);
    }

    return record;
  }

  /** Reads a saved Serper channel or returns an editable default draft for settings. */
  async getSerperConfigDraft(configKey = defaultSerperConfigKey): Promise<SerperConfigRecord> {
    const normalizedKey = normalizeSerperConfigKey(configKey);
    const record = await this.requireSerperConfigStore().getSerperConfig(normalizedKey);

    if (!record) {
      return createSerperConfigDraft(normalizedKey);
    }

    return record;
  }

  /** Sends one lightweight Search request with a candidate Serper config. */
  async testSerperConfig(dto: SaveSerperConfigDto, context: GenerateAiTextContext = {}) {
    const client = this.requireSerperClient();
    const record = {
      configKey: normalizeSerperConfigKey(dto.configKey),
      title: dto.title.trim() || 'Serper 搜索',
      apiBase: dto.apiBase.trim(),
      apiKey: dto.apiKey.trim(),
      updatedAt: new Date().toISOString()
    };
    const result = await client.search(record, {
      q: 'test',
      gl: 'us',
      hl: 'en',
      num: 1,
      page: 1
    });

    await this.systemLogService.record({
      level: 'info',
      status: 'success',
      module: 'ai-gateway',
      action: 'test-serper-config',
      message: 'Serper 搜索配置测试成功',
      userId: context.user?.userId,
      userName: context.user?.userName,
      metadata: {
        configKey: record.configKey,
        apiBase: record.apiBase
      }
    });

    return {
      ok: true,
      result
    };
  }

  /** Reads one fixed system prompt by key. */
  async getPrompt(promptKey: string): Promise<AiPromptRecord> {
    const normalizedKey = normalizePromptKey(promptKey);
    const record = await this.promptStore.getPrompt(normalizedKey);

    if (!record) {
      return createPromptDraft(normalizedKey);
    }

    return record;
  }

  /** Reads one saved backend model channel or returns an editable default draft for settings. */
  async getModelConfigDraft(configKey = defaultAiModelConfigKey): Promise<AiModelConfigRecord> {
    const normalizedKey = normalizeModelConfigKey(configKey);
    const record = await this.modelConfigStore.getModelConfig(normalizedKey);

    if (!record) {
      return createModelConfigDraft(normalizedKey);
    }

    return record;
  }

  /** Generates text through the configured model and injects saved prompt rules when promptKey is provided. */
  async generateText(dto: GenerateAiTextDto, context: GenerateAiTextContext = {}) {
    const requestId = randomUUID();

    await this.recordProgressLog(
      'AI 文本生成开始',
      context,
      this.toRequestLogMetadata(dto, 'request-received', requestId)
    );

    let params: AiTextGenerateParams | null = null;

    try {
      params = await this.toGenerateParams(dto);

      await this.recordProgressLog(
        'AI 模型调用中',
        context,
        this.toLogMetadata(params, undefined, 'calling-model', requestId)
      );

      const result = await this.textGenerator.generateText(params);

      await this.systemLogService.record({
        level: 'info',
        status: 'success',
        module: 'ai-gateway',
        action: 'generate-text',
        message: 'AI 文本生成成功',
        userId: context.user?.userId,
        userName: context.user?.userName,
        metadata: this.toLogMetadata(params, result, 'completed', requestId)
      });

      return result;
    } catch (error) {
      await this.systemLogService.record({
        level: 'error',
        status: 'failed',
        module: 'ai-gateway',
        action: 'generate-text',
        message: 'AI 文本生成失败',
        userId: context.user?.userId,
        userName: context.user?.userName,
        errorMessage: error instanceof Error ? error.message : String(error),
        metadata: params
          ? this.toLogMetadata(params, undefined, 'failed', requestId)
          : this.toRequestLogMetadata(dto, 'failed-before-model-call', requestId)
      });

      throw error;
    }
  }

  private async toGenerateParams(dto: GenerateAiTextDto): Promise<AiTextGenerateParams> {
    const promptKey = dto.promptKey ? normalizePromptKey(dto.promptKey) : undefined;
    const savedPrompt = promptKey ? await this.getPrompt(promptKey) : null;
    const systemPrompt = savedPrompt?.systemPrompt.trim() || dto.systemPrompt?.trim();

    if (promptKey && !systemPrompt) {
      throw new NotFoundException(`提示词未配置：${promptKey}`);
    }

    const modelConfig = await this.resolveModelConfig(dto);
    const params: AiTextGenerateParams = {
      providerName: modelConfig.providerName,
      apiBase: modelConfig.apiBase,
      apiKey: modelConfig.apiKey,
      model: modelConfig.model,
      prompt: dto.prompt.trim(),
      systemPrompt,
      temperature: dto.temperature ?? modelConfig.temperature,
      maxOutputTokens: dto.maxOutputTokens ?? modelConfig.maxOutputTokens
    };

    if (promptKey) {
      params.promptKey = promptKey;
    }

    return params;
  }

  private async resolveModelConfig(dto: GenerateAiTextDto): Promise<AiModelConfigRecord> {
    if (dto.apiBase?.trim() && dto.apiKey?.trim() && dto.model?.trim()) {
      return {
        configKey: 'inline',
        title: 'inline',
        providerName: dto.providerName?.trim() || 'custom',
        apiBase: dto.apiBase.trim(),
        apiKey: dto.apiKey.trim(),
        model: dto.model.trim(),
        temperature: dto.temperature,
        maxOutputTokens: dto.maxOutputTokens,
        updatedAt: new Date().toISOString()
      };
    }

    return this.getModelConfig(dto.modelConfigKey || defaultAiModelConfigKey);
  }

  /** Record a visible processing stage for long-running AI requests. */
  private recordProgressLog(message: string, context: GenerateAiTextContext, metadata: Record<string, unknown>) {
    return this.systemLogService.record({
      level: 'info',
      status: 'processing',
      module: 'ai-gateway',
      action: 'generate-text-progress',
      message,
      userId: context.user?.userId,
      userName: context.user?.userName,
      metadata
    });
  }

  private toLogMetadata(
    params: AiTextGenerateParams,
    result?: Awaited<ReturnType<AiTextGenerator['generateText']>>,
    stage?: string,
    requestId?: string
  ) {
    return {
      ...(requestId ? { requestId } : {}),
      ...(stage ? { stage } : {}),
      providerName: params.providerName,
      model: params.model,
      ...(params.promptKey ? { promptKey: params.promptKey } : {}),
      ...(result ? { usage: result.usage } : {})
    };
  }

  private toRequestLogMetadata(dto: GenerateAiTextDto, stage: string, requestId: string) {
    return {
      requestId,
      stage,
      ...(dto.modelConfigKey ? { modelConfigKey: dto.modelConfigKey } : {}),
      ...(dto.promptKey ? { promptKey: dto.promptKey } : {}),
      ...(dto.maxOutputTokens ? { maxOutputTokens: dto.maxOutputTokens } : {}),
      hasInlineModelConfig: Boolean(dto.apiBase?.trim() && dto.apiKey?.trim() && dto.model?.trim())
    };
  }

  private requireSerperConfigStore() {
    if (!this.serperConfigStore) {
      throw new NotFoundException('Serper 配置存储未初始化');
    }

    return this.serperConfigStore;
  }

  private requireSerperClient() {
    if (!this.serperClient) {
      throw new NotFoundException('Serper 客户端未初始化');
    }

    return this.serperClient;
  }
}

export interface GenerateAiTextContext {
  user?: UserInfo | null;
}

function normalizePromptKey(promptKey: string) {
  const normalized = promptKey.trim();

  if (!aiPromptKeys.includes(normalized as (typeof aiPromptKeys)[number])) {
    throw new BadRequestException('promptKey 不在固定提示词列表中');
  }

  return normalized;
}

function normalizeModelConfigKey(configKey?: string) {
  const normalized = configKey?.trim() || defaultAiModelConfigKey;

  if (!normalized) {
    throw new BadRequestException('模型配置 key 不能为空');
  }

  return normalized;
}

function normalizeSerperConfigKey(configKey?: string) {
  const normalized = configKey?.trim() || defaultSerperConfigKey;

  if (!normalized) {
    throw new BadRequestException('Serper 配置 key 不能为空');
  }

  return normalized;
}

function createPromptDraft(promptKey: string): AiPromptRecord {
  const definition = aiPromptDefinitions.find(item => item.promptKey === promptKey);
  const systemPrompt = defaultAiPromptSystemPrompts[promptKey as keyof typeof defaultAiPromptSystemPrompts] || '';

  return {
    promptKey,
    title: definition?.title || promptKey,
    systemPrompt,
    updatedAt: ''
  };
}

function createModelConfigDraft(configKey: string): AiModelConfigRecord {
  return {
    configKey,
    title: '默认模型',
    providerName: 'openrouter',
    apiBase: 'https://openrouter.ai/api/v1',
    apiKey: '',
    model: 'openai/gpt-4o-mini',
    temperature: defaultAiTemperature,
    updatedAt: ''
  };
}

function createSerperConfigDraft(configKey: string): SerperConfigRecord {
  return {
    configKey,
    title: 'Serper 搜索',
    apiBase: defaultSerperApiBase,
    apiKey: '',
    updatedAt: ''
  };
}
