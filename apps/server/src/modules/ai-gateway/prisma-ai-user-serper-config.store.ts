import { Inject, Injectable } from '@nestjs/common';
import type { AiUserSerperConfigModel } from '../../generated/prisma/models/AiUserSerperConfig';
import { SecretCryptoService } from '../../shared/secret-crypto.service';
import { PrismaService } from '../database/prisma.service';
import { resolveStoredApiKey, toEncryptedApiKeyStorage } from './ai-config-secret-fields';
import type { AiUserSerperConfigRecord, AiUserSerperConfigStore } from './ai-gateway.types';

@Injectable()
export class PrismaAiUserSerperConfigStore implements AiUserSerperConfigStore {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SecretCryptoService) private readonly secretCryptoService: SecretCryptoService
  ) {}

  /** Reads the personal Serper search channel saved by one user. */
  async getUserSerperConfig(userId: string): Promise<AiUserSerperConfigRecord | null> {
    const record = await this.prisma.aiUserSerperConfig.findUnique({
      where: { userId }
    });

    return record ? toUserSerperConfigRecord(record, this.secretCryptoService) : null;
  }

  /** Persists one user's personal Serper search channel with encrypted secret storage. */
  async saveUserSerperConfig(record: AiUserSerperConfigRecord): Promise<AiUserSerperConfigRecord> {
    const data = {
      title: record.title,
      apiBase: record.apiBase,
      ...toEncryptedApiKeyStorage(this.secretCryptoService, record.apiKey)
    };
    const saved = await this.prisma.aiUserSerperConfig.upsert({
      where: { userId: record.userId },
      create: {
        userId: record.userId,
        ...data
      },
      update: data
    });

    return toUserSerperConfigRecord(saved, this.secretCryptoService);
  }
}

function toUserSerperConfigRecord(
  record: Pick<AiUserSerperConfigModel, 'userId' | 'title' | 'apiBase' | 'apiKey' | 'encryptedApiKey' | 'updatedAt'>,
  secretCryptoService: SecretCryptoService
): AiUserSerperConfigRecord {
  return {
    userId: record.userId,
    title: record.title,
    apiBase: record.apiBase,
    apiKey: resolveStoredApiKey(secretCryptoService, record),
    updatedAt: record.updatedAt.toISOString()
  };
}
