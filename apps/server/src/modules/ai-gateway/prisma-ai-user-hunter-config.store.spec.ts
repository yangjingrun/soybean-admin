import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AppConfigService } from '../app-config/app-config.service';
import type { PrismaService } from '../database/prisma.service';
import { SecretCryptoService } from '../../shared/secret-crypto.service';
import { PrismaAiUserHunterConfigStore } from './prisma-ai-user-hunter-config.store';

const secretKey = '0123456789abcdef0123456789abcdef';

describe('PrismaAiUserHunterConfigStore', () => {
  it('reads one user personal Hunter config by user id', async () => {
    const updatedAt = new Date('2026-06-21T14:00:00.000Z');
    const prisma = {
      aiUserHunterConfig: {
        async findUnique(args: unknown) {
          assert.deepEqual(args, {
            where: { userId: 'u-1' }
          });

          return {
            userId: 'u-1',
            title: 'Hunter 邮箱补全',
            apiBase: 'https://api.hunter.io/v2',
            apiKey: 'hunter-key',
            encryptedApiKey: null,
            updatedAt
          };
        }
      }
    } as unknown as PrismaService;
    const store = new PrismaAiUserHunterConfigStore(prisma, createSecretCryptoService());

    const record = await store.getUserHunterConfig('u-1');

    assert.deepEqual(record, {
      userId: 'u-1',
      title: 'Hunter 邮箱补全',
      apiBase: 'https://api.hunter.io/v2',
      apiKey: 'hunter-key',
      updatedAt: updatedAt.toISOString()
    });
  });

  it('upserts one user personal Hunter config with encrypted api key', async () => {
    const updatedAt = new Date('2026-06-21T14:30:00.000Z');
    const calls: unknown[] = [];
    const prisma = {
      aiUserHunterConfig: {
        async upsert(args: unknown) {
          const upsertArgs = args as { create: { apiKey: string; encryptedApiKey: string } };
          calls.push(args);

          return {
            userId: 'u-1',
            title: 'Hunter 邮箱补全',
            apiBase: 'https://api.hunter.io/v2',
            apiKey: upsertArgs.create.apiKey,
            encryptedApiKey: upsertArgs.create.encryptedApiKey,
            updatedAt
          };
        }
      }
    } as unknown as PrismaService;
    const store = new PrismaAiUserHunterConfigStore(prisma, createSecretCryptoService());

    const record = await store.saveUserHunterConfig({
      userId: 'u-1',
      title: 'Hunter 邮箱补全',
      apiBase: 'https://api.hunter.io/v2',
      apiKey: 'hunter-key',
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

function createSecretCryptoService() {
  return new SecretCryptoService(createAppConfigService());
}
