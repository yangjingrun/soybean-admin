import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { SecretCryptoService } from '../../shared/secret-crypto.service';
import type { SerperConfigRecord, SerperConfigStore } from './ai-gateway.types';
import { resolveStoredApiKey, toEncryptedApiKeyStorage } from './ai-config-secret-fields';

type SerperConfigModelLike = Pick<SerperConfigRecord, 'configKey' | 'title' | 'apiBase' | 'apiKey'> & {
  encryptedApiKey?: string | null;
  updatedAt: Date;
};

@Injectable()
export class PrismaSerperConfigStore implements SerperConfigStore {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SecretCryptoService) private readonly secretCryptoService: SecretCryptoService
  ) {}

  /** Reads one saved Serper config by stable config key. */
  async getSerperConfig(configKey: string): Promise<SerperConfigRecord | null> {
    const record = await this.prisma.serperConfig.findUnique({
      where: { configKey }
    });

    return record ? toSerperConfigRecord(record, this.secretCryptoService) : null;
  }

  /** Persists one Serper config for backend search calls. */
  async saveSerperConfig(record: SerperConfigRecord): Promise<SerperConfigRecord> {
    const data = {
      title: record.title,
      apiBase: record.apiBase,
      ...toEncryptedApiKeyStorage(this.secretCryptoService, record.apiKey)
    };
    const saved = await this.prisma.serperConfig.upsert({
      where: { configKey: record.configKey },
      create: {
        configKey: record.configKey,
        ...data
      },
      update: data
    });

    return toSerperConfigRecord(saved, this.secretCryptoService);
  }
}

function toSerperConfigRecord(
  record: SerperConfigModelLike,
  secretCryptoService: SecretCryptoService
): SerperConfigRecord {
  return {
    configKey: record.configKey,
    title: record.title,
    apiBase: record.apiBase,
    apiKey: resolveStoredApiKey(secretCryptoService, record),
    updatedAt: record.updatedAt.toISOString()
  };
}
