import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AppConfigService } from '../app-config/app-config.service';
import type { PrismaService } from '../database/prisma.service';
import { PrismaAiModelConfigStore } from './prisma-ai-model-config.store';

const secretKey = '0123456789abcdef0123456789abcdef';

describe('PrismaAiModelConfigStore', () => {
  it('reads legacy plaintext model configs from PostgreSQL by config key', async () => {
    const updatedAt = new Date('2026-06-17T10:00:00.000Z');
    const prisma = {
      aiModelConfig: {
        async findUnique(args: unknown) {
          assert.deepEqual(args, {
            where: { configKey: 'default' }
          });

          return {
            configKey: 'default',
            title: '默认模型',
            providerName: 'openrouter',
            apiBase: 'https://openrouter.ai/api/v1',
            apiKey: 'sk-test',
            encryptedApiKey: null,
            model: 'openai/gpt-4o-mini',
            temperature: 0.2,
            maxOutputTokens: null,
            updatedAt
          };
        }
      }
    } as unknown as PrismaService;
    const store = new PrismaAiModelConfigStore(prisma, createAppConfigService());

    const record = await store.getModelConfig('default');

    assert.deepEqual(record, {
      configKey: 'default',
      title: '默认模型',
      providerName: 'openrouter',
      apiBase: 'https://openrouter.ai/api/v1',
      apiKey: 'sk-test',
      model: 'openai/gpt-4o-mini',
      temperature: 0.2,
      maxOutputTokens: undefined,
      updatedAt: updatedAt.toISOString()
    });
  });

  it('upserts one model config into PostgreSQL with encrypted api key', async () => {
    const updatedAt = new Date('2026-06-17T10:30:00.000Z');
    const calls: unknown[] = [];
    const prisma = {
      aiModelConfig: {
        async upsert(args: unknown) {
          const upsertArgs = args as { create: { apiKey: string; encryptedApiKey: string } };
          calls.push(args);

          return {
            configKey: 'default',
            title: '默认模型',
            providerName: 'openrouter',
            apiBase: 'https://openrouter.ai/api/v1',
            apiKey: upsertArgs.create.apiKey,
            encryptedApiKey: upsertArgs.create.encryptedApiKey,
            model: 'openai/gpt-4o-mini',
            temperature: 0.2,
            maxOutputTokens: 1200,
            updatedAt
          };
        }
      }
    } as unknown as PrismaService;
    const store = new PrismaAiModelConfigStore(prisma, createAppConfigService());

    const record = await store.saveModelConfig({
      configKey: 'default',
      title: '默认模型',
      providerName: 'openrouter',
      apiBase: 'https://openrouter.ai/api/v1',
      apiKey: 'sk-test',
      model: 'openai/gpt-4o-mini',
      temperature: 0.2,
      updatedAt: 'ignored-by-store'
    });

    const upsertArgs = calls[0] as {
      where: { configKey: string };
      create: { apiKey: string; encryptedApiKey: string };
      update: { apiKey: string; encryptedApiKey: string };
    };
    assert.equal(upsertArgs.where.configKey, 'default');
    assert.equal(upsertArgs.create.apiKey, '');
    assert.equal(upsertArgs.update.apiKey, '');
    assert.match(upsertArgs.create.encryptedApiKey, /^v1:/);
    assert.equal(upsertArgs.create.encryptedApiKey.includes('sk-test'), false);
    assert.equal(record.apiKey, 'sk-test');
    assert.equal(record.updatedAt, updatedAt.toISOString());
  });
});

function createAppConfigService(): AppConfigService {
  return {
    config: {
      aiConfigSecretEncryptionKey: secretKey
    }
  } as AppConfigService;
}
