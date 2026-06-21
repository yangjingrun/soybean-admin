import { Inject, Injectable } from '@nestjs/common';
import type { AiUserModelConfigModel } from '../../generated/prisma/models/AiUserModelConfig';
import { SecretCryptoService } from '../../shared/secret-crypto.service';
import { PrismaService } from '../database/prisma.service';
import { resolveStoredApiKey, toEncryptedApiKeyStorage } from './ai-config-secret-fields';
import type { AiUserModelConfigRecord, AiUserModelConfigStore } from './ai-gateway.types';

@Injectable()
export class PrismaAiUserModelConfigStore implements AiUserModelConfigStore {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SecretCryptoService) private readonly secretCryptoService: SecretCryptoService
  ) {}

  /** Reads the personal model channel saved by one user. */
  async getUserModelConfig(userId: string): Promise<AiUserModelConfigRecord | null> {
    const record = await this.prisma.aiUserModelConfig.findUnique({
      where: { userId }
    });

    return record ? toUserModelConfigRecord(record, this.secretCryptoService) : null;
  }

  /** Persists one user's personal model channel with encrypted secret storage. */
  async saveUserModelConfig(record: AiUserModelConfigRecord): Promise<AiUserModelConfigRecord> {
    const data = {
      providerName: record.providerName,
      apiBase: record.apiBase,
      ...toEncryptedApiKeyStorage(this.secretCryptoService, record.apiKey),
      model: record.model,
      temperature: record.temperature,
      maxOutputTokens: record.maxOutputTokens ?? null
    };
    const saved = await this.prisma.aiUserModelConfig.upsert({
      where: { userId: record.userId },
      create: {
        userId: record.userId,
        ...data
      },
      update: data
    });

    return toUserModelConfigRecord(saved, this.secretCryptoService);
  }
}

function toUserModelConfigRecord(
  record: Pick<
    AiUserModelConfigModel,
    | 'userId'
    | 'providerName'
    | 'apiBase'
    | 'apiKey'
    | 'encryptedApiKey'
    | 'model'
    | 'temperature'
    | 'maxOutputTokens'
    | 'updatedAt'
  >,
  secretCryptoService: SecretCryptoService
): AiUserModelConfigRecord {
  return {
    userId: record.userId,
    providerName: record.providerName,
    apiBase: record.apiBase,
    apiKey: resolveStoredApiKey(secretCryptoService, record),
    model: record.model,
    temperature: record.temperature ?? undefined,
    maxOutputTokens: record.maxOutputTokens ?? undefined,
    updatedAt: record.updatedAt.toISOString()
  };
}
