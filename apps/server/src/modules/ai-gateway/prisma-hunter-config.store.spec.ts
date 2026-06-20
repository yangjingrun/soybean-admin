import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AppConfigService } from '../app-config/app-config.service';
import type { PrismaService } from '../database/prisma.service';
import { PrismaHunterConfigStore } from './prisma-hunter-config.store';

const secretKey = '0123456789abcdef0123456789abcdef';

describe('PrismaHunterConfigStore', () => {
  it('reads legacy plaintext Hunter config from PostgreSQL by config key', async () => {
    const updatedAt = new Date('2026-06-19T08:00:00.000Z');
    const prisma = {
      hunterConfig: {
        async findUnique(args: unknown) {
          assert.deepEqual(args, {
            where: { configKey: 'default' }
          });

          return {
            configKey: 'default',
            title: 'Hunter 邮箱补全',
            apiBase: 'https://api.hunter.io/v2',
            apiKey: 'hunter-key',
            encryptedApiKey: null,
            updatedAt
          };
        }
      }
    } as unknown as PrismaService;
    const store = new PrismaHunterConfigStore(prisma, createAppConfigService());

    const record = await store.getHunterConfig('default');

    assert.deepEqual(record, {
      configKey: 'default',
      title: 'Hunter 邮箱补全',
      apiBase: 'https://api.hunter.io/v2',
      apiKey: 'hunter-key',
      updatedAt: updatedAt.toISOString()
    });
  });

  it('upserts one Hunter config into PostgreSQL with encrypted api key', async () => {
    const updatedAt = new Date('2026-06-19T08:30:00.000Z');
    const calls: unknown[] = [];
    const prisma = {
      hunterConfig: {
        async upsert(args: unknown) {
          const upsertArgs = args as { create: { apiKey: string; encryptedApiKey: string } };
          calls.push(args);

          return {
            configKey: 'default',
            title: 'Hunter 邮箱补全',
            apiBase: 'https://api.hunter.io/v2',
            apiKey: upsertArgs.create.apiKey,
            encryptedApiKey: upsertArgs.create.encryptedApiKey,
            updatedAt
          };
        }
      }
    } as unknown as PrismaService;
    const store = new PrismaHunterConfigStore(prisma, createAppConfigService());

    const record = await store.saveHunterConfig({
      configKey: 'default',
      title: 'Hunter 邮箱补全',
      apiBase: 'https://api.hunter.io/v2',
      apiKey: 'hunter-key',
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
    assert.equal(upsertArgs.create.encryptedApiKey.includes('hunter-key'), false);
    assert.equal(record.apiKey, 'hunter-key');
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
