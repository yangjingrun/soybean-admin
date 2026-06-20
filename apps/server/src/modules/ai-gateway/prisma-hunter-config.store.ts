import { Inject, Injectable } from '@nestjs/common';
import { AppConfigService } from '../app-config/app-config.service';
import { PrismaService } from '../database/prisma.service';
import type { HunterConfigRecord, HunterConfigStore } from './ai-gateway.types';
import { encryptAiConfigApiKey, resolveAiConfigApiKey } from './ai-config-secret-crypto';

type HunterConfigModelLike = Pick<HunterConfigRecord, 'configKey' | 'title' | 'apiBase' | 'apiKey'> & {
  encryptedApiKey?: string | null;
  updatedAt: Date;
};

@Injectable()
export class PrismaHunterConfigStore implements HunterConfigStore {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AppConfigService) private readonly appConfigService: AppConfigService
  ) {}

  /** Reads one saved Hunter config by stable config key. */
  async getHunterConfig(configKey: string): Promise<HunterConfigRecord | null> {
    const record = await this.prisma.hunterConfig.findUnique({
      where: { configKey }
    });

    return record ? toHunterConfigRecord(record, this.appConfigService) : null;
  }

  /** Persists one Hunter config for backend email enrichment calls. */
  async saveHunterConfig(record: HunterConfigRecord): Promise<HunterConfigRecord> {
    const data = {
      title: record.title,
      apiBase: record.apiBase,
      ...encryptAiConfigApiKey(record.apiKey, this.appConfigService)
    };
    const saved = await this.prisma.hunterConfig.upsert({
      where: { configKey: record.configKey },
      create: {
        configKey: record.configKey,
        ...data
      },
      update: data
    });

    return toHunterConfigRecord(saved, this.appConfigService);
  }
}

function toHunterConfigRecord(record: HunterConfigModelLike, appConfigService: AppConfigService): HunterConfigRecord {
  return {
    configKey: record.configKey,
    title: record.title,
    apiBase: record.apiBase,
    apiKey: resolveAiConfigApiKey(record, appConfigService),
    updatedAt: record.updatedAt.toISOString()
  };
}
