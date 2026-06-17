import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { PrismaService } from '../database/prisma.service';
import { PrismaAiModelConfigStore } from './prisma-ai-model-config.store';

describe('PrismaAiModelConfigStore', () => {
  it('reads one model config from PostgreSQL by config key', async () => {
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
            model: 'openai/gpt-4o-mini',
            temperature: 0.2,
            maxOutputTokens: null,
            updatedAt
          };
        }
      }
    } as unknown as PrismaService;
    const store = new PrismaAiModelConfigStore(prisma);

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

  it('upserts one model config into PostgreSQL', async () => {
    const updatedAt = new Date('2026-06-17T10:30:00.000Z');
    const calls: unknown[] = [];
    const prisma = {
      aiModelConfig: {
        async upsert(args: unknown) {
          calls.push(args);

          return {
            configKey: 'default',
            title: '默认模型',
            providerName: 'openrouter',
            apiBase: 'https://openrouter.ai/api/v1',
            apiKey: 'sk-test',
            model: 'openai/gpt-4o-mini',
            temperature: 0.2,
            maxOutputTokens: 1200,
            updatedAt
          };
        }
      }
    } as unknown as PrismaService;
    const store = new PrismaAiModelConfigStore(prisma);

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

    assert.deepEqual(calls, [
      {
        where: { configKey: 'default' },
        create: {
          configKey: 'default',
          title: '默认模型',
          providerName: 'openrouter',
          apiBase: 'https://openrouter.ai/api/v1',
          apiKey: 'sk-test',
          model: 'openai/gpt-4o-mini',
          temperature: 0.2,
          maxOutputTokens: null
        },
        update: {
          title: '默认模型',
          providerName: 'openrouter',
          apiBase: 'https://openrouter.ai/api/v1',
          apiKey: 'sk-test',
          model: 'openai/gpt-4o-mini',
          temperature: 0.2,
          maxOutputTokens: null
        }
      }
    ]);
    assert.equal(record.updatedAt, updatedAt.toISOString());
  });
});
