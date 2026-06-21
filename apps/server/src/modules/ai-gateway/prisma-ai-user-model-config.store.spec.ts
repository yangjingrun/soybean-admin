import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AppConfigService } from '../app-config/app-config.service';
import type { PrismaService } from '../database/prisma.service';
import { SecretCryptoService } from '../../shared/secret-crypto.service';
import { PrismaAiUserModelConfigStore } from './prisma-ai-user-model-config.store';

const secretKey = '0123456789abcdef0123456789abcdef';

describe('PrismaAiUserModelConfigStore', () => {
  it('saves personal model config with encrypted secret storage', async () => {
    const updatedAt = new Date('2026-06-21T10:00:00.000Z');
    const calls: unknown[] = [];
    const prisma = {
      aiUserModelConfig: {
        async upsert(args: unknown) {
          const upsertArgs = args as { create: { apiKey: string; encryptedApiKey: string } };
          calls.push(args);

          return {
            userId: 'u-1',
            providerName: 'openrouter',
            apiBase: 'https://openrouter.ai/api/v1',
            apiKey: upsertArgs.create.apiKey,
            encryptedApiKey: upsertArgs.create.encryptedApiKey,
            model: 'openai/gpt-4o-mini',
            temperature: 0.3,
            maxOutputTokens: 1200,
            updatedAt
          };
        }
      }
    } as unknown as PrismaService;
    const store = new PrismaAiUserModelConfigStore(prisma, createSecretCryptoService());

    const saved = await store.saveUserModelConfig({
      userId: 'u-1',
      providerName: 'openrouter',
      apiBase: 'https://openrouter.ai/api/v1',
      apiKey: 'sk-user',
      model: 'openai/gpt-4o-mini',
      temperature: 0.3,
      maxOutputTokens: 1200,
      updatedAt: 'ignored-by-store'
    });

    const upsertArgs = calls[0] as {
      where: { userId: string };
      create: { apiKey: string; encryptedApiKey: string };
      update: { apiKey: string; encryptedApiKey: string };
    };
    assert.equal(upsertArgs.where.userId, 'u-1');
    assert.equal(upsertArgs.create.apiKey, '');
    assert.equal(upsertArgs.update.apiKey, '');
    assert.match(upsertArgs.create.encryptedApiKey, /^v1:/);
    assert.equal(upsertArgs.create.encryptedApiKey.includes('sk-user'), false);
    assert.equal(saved.apiKey, 'sk-user');
    assert.equal(saved.updatedAt, updatedAt.toISOString());
  });

  it('reads encrypted personal model config by user id', async () => {
    const updatedAt = new Date('2026-06-21T10:30:00.000Z');
    const secretCryptoService = createSecretCryptoService();
    const encryptedApiKey = secretCryptoService.encryptForStorage('sk-encrypted-user', {
      keyLabel: 'AI config secret encryption key',
      valueLabel: 'Encrypted AI config secret'
    }).encryptedSecret;
    const prisma = {
      aiUserModelConfig: {
        async findUnique(args: unknown) {
          assert.deepEqual(args, { where: { userId: 'u-1' } });

          return {
            userId: 'u-1',
            providerName: 'openai',
            apiBase: 'https://api.openai.com/v1',
            apiKey: '',
            encryptedApiKey,
            model: 'gpt-4o-mini',
            temperature: null,
            maxOutputTokens: null,
            updatedAt
          };
        }
      }
    } as unknown as PrismaService;
    const store = new PrismaAiUserModelConfigStore(prisma, secretCryptoService);

    const record = await store.getUserModelConfig('u-1');

    assert.deepEqual(record, {
      userId: 'u-1',
      providerName: 'openai',
      apiBase: 'https://api.openai.com/v1',
      apiKey: 'sk-encrypted-user',
      model: 'gpt-4o-mini',
      temperature: undefined,
      maxOutputTokens: undefined,
      updatedAt: updatedAt.toISOString()
    });
  });

  it('reads legacy plaintext personal model config', async () => {
    const updatedAt = new Date('2026-06-21T11:00:00.000Z');
    const prisma = {
      aiUserModelConfig: {
        async findUnique() {
          return {
            userId: 'u-legacy',
            providerName: 'openrouter',
            apiBase: 'https://openrouter.ai/api/v1',
            apiKey: 'sk-legacy',
            encryptedApiKey: null,
            model: 'openai/gpt-4o-mini',
            temperature: 0.2,
            maxOutputTokens: 800,
            updatedAt
          };
        }
      }
    } as unknown as PrismaService;
    const store = new PrismaAiUserModelConfigStore(prisma, createSecretCryptoService());

    const record = await store.getUserModelConfig('u-legacy');

    assert.equal(record?.apiKey, 'sk-legacy');
    assert.equal(record?.temperature, 0.2);
    assert.equal(record?.maxOutputTokens, 800);
  });
});

function createAppConfigService(): AppConfigService {
  return {
    config: {
      aiConfigSecretEncryptionKey: secretKey
    }
  } as AppConfigService;
}

function createSecretCryptoService() {
  return new SecretCryptoService(createAppConfigService());
}
