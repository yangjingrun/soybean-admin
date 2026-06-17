import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { aiPromptKeys, defaultAiModelConfigKey } from './ai-gateway.constants';
import { AI_MODEL_CONFIG_STORE, AI_PROMPT_STORE, AI_TEXT_GENERATOR } from './ai-gateway.tokens';
import type { GenerateAiTextDto } from './dto/generate-ai-text.dto';
import type { SaveAiPromptDto } from './dto/ai-prompt.dto';
import type { SaveAiModelConfigDto } from './dto/ai-model-config.dto';
import type {
  AiModelConfigRecord,
  AiModelConfigStore,
  AiPromptRecord,
  AiPromptStore,
  AiTextGenerateParams,
  AiTextGenerator
} from './ai-gateway.types';

@Injectable()
export class AiGatewayService {
  constructor(
    @Inject(AI_TEXT_GENERATOR) private readonly textGenerator: AiTextGenerator,
    @Inject(AI_PROMPT_STORE) private readonly promptStore: AiPromptStore,
    @Inject(AI_MODEL_CONFIG_STORE) private readonly modelConfigStore: AiModelConfigStore
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
      temperature: dto.temperature,
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

  /** Reads one fixed system prompt by key. */
  async getPrompt(promptKey: string): Promise<AiPromptRecord> {
    const normalizedKey = normalizePromptKey(promptKey);
    const record = await this.promptStore.getPrompt(normalizedKey);

    if (!record) {
      throw new NotFoundException(`未找到提示词：${normalizedKey}`);
    }

    return record;
  }

  /** Generates text through the configured model and injects saved prompt rules when promptKey is provided. */
  async generateText(dto: GenerateAiTextDto) {
    const params = await this.toGenerateParams(dto);

    return this.textGenerator.generateText(params);
  }

  private async toGenerateParams(dto: GenerateAiTextDto): Promise<AiTextGenerateParams> {
    const promptKey = dto.promptKey ? normalizePromptKey(dto.promptKey) : undefined;
    const savedPrompt = promptKey ? await this.getPrompt(promptKey) : null;
    const modelConfig = await this.resolveModelConfig(dto);
    const params: AiTextGenerateParams = {
      providerName: modelConfig.providerName,
      apiBase: modelConfig.apiBase,
      apiKey: modelConfig.apiKey,
      model: modelConfig.model,
      prompt: dto.prompt.trim(),
      systemPrompt: savedPrompt?.systemPrompt || dto.systemPrompt?.trim(),
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
