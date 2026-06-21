import { Inject, Injectable } from '@nestjs/common';
import type { AiUserHunterConfigModel } from '../../generated/prisma/models/AiUserHunterConfig';
import { SecretCryptoService } from '../../shared/secret-crypto.service';
import { PrismaService } from '../database/prisma.service';
import { resolveStoredApiKey, toEncryptedApiKeyStorage } from './ai-config-secret-fields';
import type { AiUserHunterConfigRecord, AiUserHunterConfigStore } from './ai-gateway.types';

@Injectable()
export class PrismaAiUserHunterConfigStore implements AiUserHunterConfigStore {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SecretCryptoService) private readonly secretCryptoService: SecretCryptoService
  ) {}

  /** Reads the personal Hunter Domain Search channel saved by one user. */
  async getUserHunterConfig(userId: string): Promise<AiUserHunterConfigRecord | null> {
    const record = await this.prisma.aiUserHunterConfig.findUnique({
      where: { userId }
    });

    return record ? toUserHunterConfigRecord(record, this.secretCryptoService) : null;
  }

  /** Persists one user's personal Hunter Domain Search channel with encrypted secret storage. */
  async saveUserHunterConfig(record: AiUserHunterConfigRecord): Promise<AiUserHunterConfigRecord> {
    const data = {
      title: record.title,
      apiBase: record.apiBase,
      ...toEncryptedApiKeyStorage(this.secretCryptoService, record.apiKey)
    };
    const saved = await this.prisma.aiUserHunterConfig.upsert({
      where: { userId: record.userId },
      create: {
        userId: record.userId,
        ...data
      },
      update: data
    });

    return toUserHunterConfigRecord(saved, this.secretCryptoService);
  }
}

function toUserHunterConfigRecord(
  record: Pick<AiUserHunterConfigModel, 'userId' | 'title' | 'apiBase' | 'apiKey' | 'encryptedApiKey' | 'updatedAt'>,
  secretCryptoService: SecretCryptoService
): AiUserHunterConfigRecord {
  return {
    userId: record.userId,
    title: record.title,
    apiBase: record.apiBase,
    apiKey: resolveStoredApiKey(secretCryptoService, record),
    updatedAt: record.updatedAt.toISOString()
  };
}
