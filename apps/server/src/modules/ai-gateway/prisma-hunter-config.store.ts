import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { HunterConfigRecord, HunterConfigStore } from './ai-gateway.types';

type HunterConfigModelLike = Pick<HunterConfigRecord, 'configKey' | 'title' | 'apiBase' | 'apiKey'> & {
  updatedAt: Date;
};

@Injectable()
export class PrismaHunterConfigStore implements HunterConfigStore {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** Reads one saved Hunter config by stable config key. */
  async getHunterConfig(configKey: string): Promise<HunterConfigRecord | null> {
    const record = await this.prisma.hunterConfig.findUnique({
      where: { configKey }
    });

    return record ? toHunterConfigRecord(record) : null;
  }

  /** Persists one Hunter config for backend email enrichment calls. */
  async saveHunterConfig(record: HunterConfigRecord): Promise<HunterConfigRecord> {
    const data = {
      title: record.title,
      apiBase: record.apiBase,
      apiKey: record.apiKey
    };
    const saved = await this.prisma.hunterConfig.upsert({
      where: { configKey: record.configKey },
      create: {
        configKey: record.configKey,
        ...data
      },
      update: data
    });

    return toHunterConfigRecord(saved);
  }
}

function toHunterConfigRecord(record: HunterConfigModelLike): HunterConfigRecord {
  return {
    configKey: record.configKey,
    title: record.title,
    apiBase: record.apiBase,
    apiKey: record.apiKey,
    updatedAt: record.updatedAt.toISOString()
  };
}
