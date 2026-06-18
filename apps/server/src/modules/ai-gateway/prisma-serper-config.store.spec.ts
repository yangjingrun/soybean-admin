import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { PrismaService } from '../database/prisma.service';
import { PrismaSerperConfigStore } from './prisma-serper-config.store';

describe('PrismaSerperConfigStore', () => {
  it('reads one Serper config from PostgreSQL by config key', async () => {
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
            updatedAt
          };
        }
      }
    } as unknown as PrismaService;
    const store = new PrismaSerperConfigStore(prisma);

    const record = await store.getSerperConfig('default');

    assert.deepEqual(record, {
      configKey: 'default',
      title: 'Serper 搜索',
      apiBase: 'https://google.serper.dev',
      apiKey: 'serper-key',
      updatedAt: updatedAt.toISOString()
    });
  });

  it('upserts one Serper config into PostgreSQL', async () => {
    const updatedAt = new Date('2026-06-18T08:30:00.000Z');
    const calls: unknown[] = [];
    const prisma = {
      serperConfig: {
        async upsert(args: unknown) {
          calls.push(args);

          return {
            configKey: 'default',
            title: 'Serper 搜索',
            apiBase: 'https://google.serper.dev',
            apiKey: 'serper-key',
            updatedAt
          };
        }
      }
    } as unknown as PrismaService;
    const store = new PrismaSerperConfigStore(prisma);

    const record = await store.saveSerperConfig({
      configKey: 'default',
      title: 'Serper 搜索',
      apiBase: 'https://google.serper.dev',
      apiKey: 'serper-key',
      updatedAt: 'ignored-by-store'
    });

    assert.deepEqual(calls, [
      {
        where: { configKey: 'default' },
        create: {
          configKey: 'default',
          title: 'Serper 搜索',
          apiBase: 'https://google.serper.dev',
          apiKey: 'serper-key'
        },
        update: {
          title: 'Serper 搜索',
          apiBase: 'https://google.serper.dev',
          apiKey: 'serper-key'
        }
      }
    ]);
    assert.equal(record.updatedAt, updatedAt.toISOString());
  });
});
