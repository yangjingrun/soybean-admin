import { Inject, Injectable } from '@nestjs/common';
import type { AiModelConfigModel } from '../../generated/prisma/models/AiModelConfig';
import { PrismaService } from '../database/prisma.service';
import type { AiModelConfigRecord, AiModelConfigStore } from './ai-gateway.types';

@Injectable()
export class PrismaAiModelConfigStore implements AiModelConfigStore {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** Reads one saved model config by stable config key. */
  async getModelConfig(configKey: string): Promise<AiModelConfigRecord | null> {
    const record = await this.prisma.aiModelConfig.findUnique({
      where: { configKey }
    });

    return record ? toModelConfigRecord(record) : null;
  }

  /** Persists one model config for backend AI calls. */
  async saveModelConfig(record: AiModelConfigRecord): Promise<AiModelConfigRecord> {
    const data = {
      title: record.title,
      providerName: record.providerName,
      apiBase: record.apiBase,
      apiKey: record.apiKey,
      model: record.model,
      temperature: record.temperature,
      maxOutputTokens: record.maxOutputTokens ?? null
    };
    const saved = await this.prisma.aiModelConfig.upsert({
      where: { configKey: record.configKey },
      create: {
        configKey: record.configKey,
        ...data
      },
      update: data
    });

    return toModelConfigRecord(saved);
  }
}

function toModelConfigRecord(
  record: Pick<
    AiModelConfigModel,
    | 'configKey'
    | 'title'
    | 'providerName'
    | 'apiBase'
    | 'apiKey'
    | 'model'
    | 'temperature'
    | 'maxOutputTokens'
    | 'updatedAt'
  >
) {
  return {
    configKey: record.configKey,
    title: record.title,
    providerName: record.providerName,
    apiBase: record.apiBase,
    apiKey: record.apiKey,
    model: record.model,
    temperature: record.temperature ?? undefined,
    maxOutputTokens: record.maxOutputTokens ?? undefined,
    updatedAt: record.updatedAt.toISOString()
  };
}
