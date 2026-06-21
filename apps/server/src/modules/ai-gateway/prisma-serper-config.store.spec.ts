import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AppConfigService } from '../app-config/app-config.service';
import type { PrismaService } from '../database/prisma.service';
import { SecretCryptoService } from '../../shared/secret-crypto.service';
import { PrismaSerperConfigStore } from './prisma-serper-config.store';

const secretKey = '0123456789abcdef0123456789abcdef';

describe('PrismaSerperConfigStore', () => {
  it('reads legacy plaintext Serper config from PostgreSQL by config key', async () => {
    const updatedAt = new Date('2026-06-18T08:00:00.000Z');
    const prisma = {
      serperConfig: {
        async findUnique(args: unknown) {
          assert.deepEqual(args, {
            where: { configKey: 'default' }
          });

          return {
            configKey: 'default',
            title: 'Serper 搜索',
            apiBase: 'https://google.serper.dev',
            apiKey: 'serper-key',
            encryptedApiKey: null,
            updatedAt
          };
        }
      }
    } as unknown as PrismaService;
    const store = new PrismaSerperConfigStore(prisma, createSecretCryptoService());

    const record = await store.getSerperConfig('default');

    assert.deepEqual(record, {
      configKey: 'default',
      title: 'Serper 搜索',
      apiBase: 'https://google.serper.dev',
      apiKey: 'serper-key',
      updatedAt: updatedAt.toISOString()
    });
  });

  it('upserts one Serper config into PostgreSQL with encrypted api key', async () => {
    const updatedAt = new Date('2026-06-18T08:30:00.000Z');
    const calls: unknown[] = [];
    const prisma = {
      serperConfig: {
        async upsert(args: unknown) {
          const upsertArgs = args as { create: { apiKey: string; encryptedApiKey: string } };
          calls.push(args);

          return {
            configKey: 'default',
            title: 'Serper 搜索',
            apiBase: 'https://google.serper.dev',
            apiKey: upsertArgs.create.apiKey,
            encryptedApiKey: upsertArgs.create.encryptedApiKey,
            updatedAt
          };
        }
      }
    } as unknown as PrismaService;
    const store = new PrismaSerperConfigStore(prisma, createSecretCryptoService());

    const record = await store.saveSerperConfig({
      configKey: 'default',
      title: 'Serper 搜索',
      apiBase: 'https://google.serper.dev',
      apiKey: 'serper-key',
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
    assert.equal(upsertArgs.create.encryptedApiKey.includes('serper-key'), false);
    assert.equal(record.apiKey, 'serper-key');
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

function createSecretCryptoService() {
  return new SecretCryptoService(createAppConfigService());
}
