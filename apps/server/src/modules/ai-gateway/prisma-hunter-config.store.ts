import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { SecretCryptoService } from '../../shared/secret-crypto.service';
import type { HunterConfigRecord, HunterConfigStore } from './ai-gateway.types';
import { resolveStoredApiKey, toEncryptedApiKeyStorage } from './ai-config-secret-fields';

type HunterConfigModelLike = Pick<HunterConfigRecord, 'configKey' | 'title' | 'apiBase' | 'apiKey'> & {
  encryptedApiKey?: string | null;
  updatedAt: Date;
};

@Injectable()
export class PrismaHunterConfigStore implements HunterConfigStore {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SecretCryptoService) private readonly secretCryptoService: SecretCryptoService
  ) {}

  /** Reads one saved Hunter config by stable config key. */
  async getHunterConfig(configKey: string): Promise<HunterConfigRecord | null> {
    const record = await this.prisma.hunterConfig.findUnique({
      where: { configKey }
    });

    return record ? toHunterConfigRecord(record, this.secretCryptoService) : null;
  }

  /** Persists one Hunter config for backend email enrichment calls. */
  async saveHunterConfig(record: HunterConfigRecord): Promise<HunterConfigRecord> {
    const data = {
      title: record.title,
      apiBase: record.apiBase,
      ...toEncryptedApiKeyStorage(this.secretCryptoService, record.apiKey)
    };
    const saved = await this.prisma.hunterConfig.upsert({
      where: { configKey: record.configKey },
      create: {
        configKey: record.configKey,
        ...data
      },
      update: data
    });

    return toHunterConfigRecord(saved, this.secretCryptoService);
  }
}

function toHunterConfigRecord(
  record: HunterConfigModelLike,
  secretCryptoService: SecretCryptoService
): HunterConfigRecord {
  return {
    configKey: record.configKey,
    title: record.title,
    apiBase: record.apiBase,
    apiKey: resolveStoredApiKey(secretCryptoService, record),
    updatedAt: record.updatedAt.toISOString()
  };
}
