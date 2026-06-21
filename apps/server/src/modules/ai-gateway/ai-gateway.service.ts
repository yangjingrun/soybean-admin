import { randomUUID } from 'node:crypto';
import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { requireRequestUserContext, type RequestUserContext } from '../../shared/request-context';
import { createSystemLogErrorMetadata } from '../system-log/system-log-error-taxonomy';
import { SystemLogService } from '../system-log/system-log.service';
import type { SystemLogRecorder } from '../system-log/system-log.types';
import {
  aiPromptDefinitions,
  aiPromptKeys,
  defaultAiPromptSystemPrompts,
  defaultAiModelConfigKey,
  defaultAiTemperature
} from './ai-gateway.constants';
import { AI_MODEL_CONFIG_STORE, AI_PROMPT_STORE, AI_TEXT_GENERATOR, AI_USER_MODEL_CONFIG_STORE } from './ai-gateway.tokens';
import type { GenerateAiTextDto } from './dto/generate-ai-text.dto';
import type { SaveAiPromptDto } from './dto/ai-prompt.dto';
import type { SaveAiModelConfigDto, SaveMyAiModelConfigDto } from './dto/ai-model-config.dto';
import type { SaveMySerperConfigDto, SaveSerperConfigDto } from './dto/serper-config.dto';
import type { SaveHunterConfigDto, SaveMyHunterConfigDto } from './dto/hunter-config.dto';
import { AiProviderConfigService, toSecretView } from './ai-provider-config.service';
import type {
  AiModelConfigRecord,
  AiModelConfigViewRecord,
  AiModelConfigStore,
  AiUserModelConfigRecord,
  AiUserModelConfigStore,
  AiUserModelConfigViewRecord,
  AiUserHunterConfigViewRecord,
  AiUserSerperConfigViewRecord,
  HunterConfigViewRecord,
  HunterConfigRecord,
  AiPromptRecord,
  AiPromptStore,
  AiTextGenerateParams,
  AiTextGenerator,
  SerperConfigRecord,
  SerperConfigViewRecord
} from './ai-gateway.types';

@Injectable()
export class AiGatewayService {
  constructor(
    @Inject(AI_TEXT_GENERATOR) private readonly textGenerator: AiTextGenerator,
    @Inject(AI_PROMPT_STORE) private readonly promptStore: AiPromptStore,
    @Inject(AI_MODEL_CONFIG_STORE) private readonly modelConfigStore: AiModelConfigStore,
    @Inject(AI_USER_MODEL_CONFIG_STORE) private readonly userModelConfigStore: AiUserModelConfigStore,
    @Inject(SystemLogService) private readonly systemLogService: SystemLogRecorder,
    @Optional() @Inject(AiProviderConfigService) private readonly providerConfigService?: AiProviderConfigService
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
  async saveModelConfig(dto: SaveAiModelConfigDto): Promise<AiModelConfigViewRecord> {
    const configKey = normalizeModelConfigKey(dto.configKey);

    const record = await this.modelConfigStore.saveModelConfig({
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

    return toModelConfigView(record, { exposeApiKey: true });
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
  async saveSerperConfig(dto: SaveSerperConfigDto, context: GenerateAiTextContext = {}): Promise<SerperConfigViewRecord> {
    return this.requireProviderConfigService().saveSerperConfig(dto, context);
  }

  /** Reads one saved Serper search channel by key. */
  async getSerperConfig(configKey?: string): Promise<SerperConfigRecord> {
    return this.requireProviderConfigService().getSerperConfig(configKey);
  }

  /** Reads a saved Serper channel or returns an editable default draft for settings. */
  async getSerperConfigDraft(configKey?: string): Promise<SerperConfigViewRecord> {
    return this.requireProviderConfigService().getSerperConfigDraft(configKey);
  }

  /** Saves the current user's personal Serper channel. */
  async saveMySerperConfig(dto: SaveMySerperConfigDto, user: RequestUserContext): Promise<AiUserSerperConfigViewRecord> {
    return this.requireProviderConfigService().saveMySerperConfig(dto, user);
  }

  /** Reads the current user's personal Serper channel or returns an editable draft. */
  async getMySerperConfigDraft(user: RequestUserContext): Promise<AiUserSerperConfigViewRecord> {
    return this.requireProviderConfigService().getMySerperConfigDraft(user);
  }

  /** Reads the required Serper channel for one user-owned business request. */
  async getRequiredUserSerperConfig(user: RequestUserContext): Promise<SerperConfigRecord> {
    return this.requireProviderConfigService().getRequiredUserSerperConfig(user);
  }

  /** Sends one lightweight Search request with the current user's personal Serper config. */
  async testMySerperConfig(dto: SaveMySerperConfigDto, user: RequestUserContext) {
    return this.requireProviderConfigService().testMySerperConfig(dto, user);
  }

  /** Sends one lightweight Search request with a candidate Serper config. */
  async testSerperConfig(dto: SaveSerperConfigDto, context: GenerateAiTextContext = {}) {
    return this.requireProviderConfigService().testSerperConfig(dto, context);
  }

  /** Saves the Hunter Domain Search channel used to enrich AI lead contacts. */
  async saveHunterConfig(dto: SaveHunterConfigDto, context: GenerateAiTextContext = {}): Promise<HunterConfigViewRecord> {
    return this.requireProviderConfigService().saveHunterConfig(dto, context);
  }

  /** Reads one saved Hunter channel by key. */
  async getHunterConfig(configKey?: string) {
    return this.requireProviderConfigService().getHunterConfig(configKey);
  }

  /** Reads a saved Hunter channel or returns an editable default draft for settings. */
  async getHunterConfigDraft(configKey?: string): Promise<HunterConfigViewRecord> {
    return this.requireProviderConfigService().getHunterConfigDraft(configKey);
  }

  /** Saves the current user's personal Hunter channel. */
  async saveMyHunterConfig(dto: SaveMyHunterConfigDto, user: RequestUserContext): Promise<AiUserHunterConfigViewRecord> {
    return this.requireProviderConfigService().saveMyHunterConfig(dto, user);
  }

  /** Reads the current user's personal Hunter channel or returns an editable draft. */
  async getMyHunterConfigDraft(user: RequestUserContext): Promise<AiUserHunterConfigViewRecord> {
    return this.requireProviderConfigService().getMyHunterConfigDraft(user);
  }

  /** Reads the required Hunter channel for one user-owned business request. */
  async getRequiredUserHunterConfig(user: RequestUserContext): Promise<HunterConfigRecord> {
    return this.requireProviderConfigService().getRequiredUserHunterConfig(user);
  }

  /** Sends one lightweight Domain Search request with the current user's personal Hunter config. */
  async testMyHunterConfig(dto: SaveMyHunterConfigDto, user: RequestUserContext) {
    return this.requireProviderConfigService().testMyHunterConfig(dto, user);
  }

  /** Sends one lightweight Domain Search request with a candidate Hunter config. */
  async testHunterConfig(dto: SaveHunterConfigDto, context: GenerateAiTextContext = {}) {
    return this.requireProviderConfigService().testHunterConfig(dto, context);
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
  async getModelConfigDraft(configKey = defaultAiModelConfigKey): Promise<AiModelConfigViewRecord> {
    const normalizedKey = normalizeModelConfigKey(configKey);
    const record = await this.modelConfigStore.getModelConfig(normalizedKey);

    if (!record) {
      return toModelConfigView(createModelConfigDraft(normalizedKey), { exposeApiKey: true });
    }

    return toModelConfigView(record, { exposeApiKey: true });
  }

  /** Saves the current user's personal model channel. */
  async saveMyModelConfig(dto: SaveMyAiModelConfigDto, user: RequestUserContext): Promise<AiUserModelConfigViewRecord> {
    const apiKey = await this.resolvePersonalModelApiKey(dto, user);
    const record = await this.userModelConfigStore.saveUserModelConfig({
      userId: user.userId,
      providerName: dto.providerName.trim(),
      apiBase: dto.apiBase.trim(),
      apiKey,
      model: dto.model.trim(),
      temperature: dto.temperature ?? defaultAiTemperature,
      maxOutputTokens: dto.maxOutputTokens,
      updatedAt: new Date().toISOString()
    });

    return toUserModelConfigView(record, { exposeApiKey: true });
  }

  private async resolvePersonalModelApiKey(dto: SaveMyAiModelConfigDto, user: RequestUserContext) {
    const nextApiKey = dto.apiKey?.trim();

    if (nextApiKey) {
      return nextApiKey;
    }

    const existing = await this.userModelConfigStore.getUserModelConfig(user.userId);

    if (!existing?.apiKey.trim()) {
      throw new BadRequestException('请先填写个人模型 API Key');
    }

    // 允许用户只改模型名、Base URL 等字段，不要求每次重新输入已保存的 Key。
    return existing.apiKey;
  }

  /** Reads the current user's personal model channel or returns an editable draft. */
  async getMyModelConfigDraft(user: RequestUserContext): Promise<AiUserModelConfigViewRecord> {
    const record = await this.userModelConfigStore.getUserModelConfig(user.userId);

    return toUserModelConfigView(record ?? createUserModelConfigDraft(user.userId), { exposeApiKey: true });
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
      params = await this.toGenerateParams(dto, context);

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
        metadata: createSystemLogErrorMetadata(
          error,
          params
            ? this.toLogMetadata(params, undefined, 'failed', requestId)
            : this.toRequestLogMetadata(dto, 'failed-before-model-call', requestId),
          { defaultCategory: 'external_service' }
        )
      });

      throw error;
    }
  }

  private async toGenerateParams(dto: GenerateAiTextDto, context: GenerateAiTextContext): Promise<AiTextGenerateParams> {
    const promptKey = dto.promptKey ? normalizePromptKey(dto.promptKey) : undefined;
    const savedPrompt = promptKey ? await this.getPrompt(promptKey) : null;
    const systemPrompt = savedPrompt?.systemPrompt.trim() || dto.systemPrompt?.trim();

    if (promptKey && !systemPrompt) {
      throw new NotFoundException(`提示词未配置：${promptKey}`);
    }

    const modelConfig = await this.resolveModelConfig(dto, context);
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

  private async resolveModelConfig(
    dto: GenerateAiTextDto,
    context: GenerateAiTextContext
  ): Promise<AiModelConfigRecord | AiUserModelConfigRecord> {
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

    return this.getRequiredUserModelConfig(requireRequestUserContext(context.user ?? null));
  }

  private async getRequiredUserModelConfig(user: RequestUserContext): Promise<AiUserModelConfigRecord> {
    const record = await this.userModelConfigStore.getUserModelConfig(user.userId);

    if (!record?.apiKey.trim()) {
      throw new BadRequestException('请先配置个人模型通道');
    }

    return record;
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

  private requireProviderConfigService() {
    if (!this.providerConfigService) {
      throw new NotFoundException('AI 渠道配置服务未初始化');
    }

    return this.providerConfigService;
  }
}

export interface GenerateAiTextContext {
  user?: RequestUserContext | null;
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

function createUserModelConfigDraft(userId: string): AiUserModelConfigRecord {
  return {
    userId,
    providerName: 'openrouter',
    apiBase: 'https://openrouter.ai/api/v1',
    apiKey: '',
    model: 'openai/gpt-4o-mini',
    temperature: defaultAiTemperature,
    updatedAt: ''
  };
}

function toModelConfigView(
  record: AiModelConfigRecord,
  options: {
    exposeApiKey?: boolean;
  } = {}
): AiModelConfigViewRecord {
  const { apiKey, ...view } = record;

  return {
    ...view,
    ...(options.exposeApiKey ? { apiKey } : {}),
    ...toSecretView(apiKey)
  };
}

function toUserModelConfigView(
  record: AiUserModelConfigRecord,
  options: {
    exposeApiKey?: boolean;
  } = {}
): AiUserModelConfigViewRecord {
  const { userId: _userId, apiKey, ...view } = record;

  return {
    ...view,
    ...(options.exposeApiKey ? { apiKey } : {}),
    ...toSecretView(apiKey)
  };
}
