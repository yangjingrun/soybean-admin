import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { SerperConfigRecord, SerperConfigStore } from './ai-gateway.types';

type SerperConfigModelLike = Pick<SerperConfigRecord, 'configKey' | 'title' | 'apiBase' | 'apiKey'> & {
  updatedAt: Date;
};

@Injectable()
export class PrismaSerperConfigStore implements SerperConfigStore {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** Reads one saved Serper config by stable config key. */
  async getSerperConfig(configKey: string): Promise<SerperConfigRecord | null> {
    const record = await this.prisma.serperConfig.findUnique({
      where: { configKey }
    });

    return record ? toSerperConfigRecord(record) : null;
  }

  /** Persists one Serper config for backend search calls. */
  async saveSerperConfig(record: SerperConfigRecord): Promise<SerperConfigRecord> {
    const data = {
      title: record.title,
      apiBase: record.apiBase,
      apiKey: record.apiKey
    };
    const saved = await this.prisma.serperConfig.upsert({
      where: { configKey: record.configKey },
      create: {
        configKey: record.configKey,
        ...data
      },
      update: data
    });

    return toSerperConfigRecord(saved);
  }
}

function toSerperConfigRecord(record: SerperConfigModelLike): SerperConfigRecord {
  return {
    configKey: record.configKey,
    title: record.title,
    apiBase: record.apiBase,
    apiKey: record.apiKey,
    updatedAt: record.updatedAt.toISOString()
  };
}
