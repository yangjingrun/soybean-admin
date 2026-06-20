import { Inject, Injectable } from '@nestjs/common';
import { AppConfigService } from '../app-config/app-config.service';
import { PrismaService } from '../database/prisma.service';
import type { SerperConfigRecord, SerperConfigStore } from './ai-gateway.types';
import { encryptAiConfigApiKey, resolveAiConfigApiKey } from './ai-config-secret-crypto';

type SerperConfigModelLike = Pick<SerperConfigRecord, 'configKey' | 'title' | 'apiBase' | 'apiKey'> & {
  encryptedApiKey?: string | null;
  updatedAt: Date;
};

@Injectable()
export class PrismaSerperConfigStore implements SerperConfigStore {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AppConfigService) private readonly appConfigService: AppConfigService
  ) {}

  /** Reads one saved Serper config by stable config key. */
  async getSerperConfig(configKey: string): Promise<SerperConfigRecord | null> {
    const record = await this.prisma.serperConfig.findUnique({
      where: { configKey }
    });

    return record ? toSerperConfigRecord(record, this.appConfigService) : null;
  }

  /** Persists one Serper config for backend search calls. */
  async saveSerperConfig(record: SerperConfigRecord): Promise<SerperConfigRecord> {
    const data = {
      title: record.title,
      apiBase: record.apiBase,
      ...encryptAiConfigApiKey(record.apiKey, this.appConfigService)
    };
    const saved = await this.prisma.serperConfig.upsert({
      where: { configKey: record.configKey },
      create: {
        configKey: record.configKey,
        ...data
      },
      update: data
    });

    return toSerperConfigRecord(saved, this.appConfigService);
  }
}

function toSerperConfigRecord(record: SerperConfigModelLike, appConfigService: AppConfigService): SerperConfigRecord {
  return {
    configKey: record.configKey,
    title: record.title,
    apiBase: record.apiBase,
    apiKey: resolveAiConfigApiKey(record, appConfigService),
    updatedAt: record.updatedAt.toISOString()
  };
}
