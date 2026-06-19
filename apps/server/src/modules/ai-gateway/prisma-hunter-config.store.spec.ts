import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { PrismaService } from '../database/prisma.service';
import { PrismaHunterConfigStore } from './prisma-hunter-config.store';

describe('PrismaHunterConfigStore', () => {
  it('reads one Hunter config from PostgreSQL by config key', async () => {
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
            updatedAt
          };
        }
      }
    } as unknown as PrismaService;
    const store = new PrismaHunterConfigStore(prisma);

    const record = await store.getHunterConfig('default');

    assert.deepEqual(record, {
      configKey: 'default',
      title: 'Hunter 邮箱补全',
      apiBase: 'https://api.hunter.io/v2',
      apiKey: 'hunter-key',
      updatedAt: updatedAt.toISOString()
    });
  });

  it('upserts one Hunter config into PostgreSQL', async () => {
    const updatedAt = new Date('2026-06-19T08:30:00.000Z');
    const calls: unknown[] = [];
    const prisma = {
      hunterConfig: {
        async upsert(args: unknown) {
          calls.push(args);

          return {
            configKey: 'default',
            title: 'Hunter 邮箱补全',
            apiBase: 'https://api.hunter.io/v2',
            apiKey: 'hunter-key',
            updatedAt
          };
        }
      }
    } as unknown as PrismaService;
    const store = new PrismaHunterConfigStore(prisma);

    const record = await store.saveHunterConfig({
      configKey: 'default',
      title: 'Hunter 邮箱补全',
      apiBase: 'https://api.hunter.io/v2',
      apiKey: 'hunter-key',
      updatedAt: 'ignored-by-store'
    });

    assert.deepEqual(calls, [
      {
        where: { configKey: 'default' },
        create: {
          configKey: 'default',
          title: 'Hunter 邮箱补全',
          apiBase: 'https://api.hunter.io/v2',
          apiKey: 'hunter-key'
        },
        update: {
          title: 'Hunter 邮箱补全',
          apiBase: 'https://api.hunter.io/v2',
          apiKey: 'hunter-key'
        }
      }
    ]);
    assert.equal(record.updatedAt, updatedAt.toISOString());
  });
});
