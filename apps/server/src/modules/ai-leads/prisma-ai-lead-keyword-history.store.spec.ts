import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { PrismaService } from '../database/prisma.service';
import { PrismaAiLeadKeywordHistoryStore } from './prisma-ai-lead-keyword-history.store';

describe('PrismaAiLeadKeywordHistoryStore', () => {
  it('deletes one keyword history inside the current user boundary', async () => {
    const calls: unknown[] = [];
    const prisma = {
      aiLeadKeywordHistory: {
        async deleteMany(args: unknown) {
          calls.push(args);

          return { count: 1 };
        }
      }
    } as unknown as PrismaService;
    const store = new PrismaAiLeadKeywordHistoryStore(prisma);

    const deleted = await store.deleteByIdForUser('history-1', 'u-1');

    assert.equal(deleted, true);
    assert.deepEqual(calls, [
      {
        where: {
          id: 'history-1',
          userId: 'u-1'
        }
      }
    ]);
  });

  it('returns false when no keyword history is deleted', async () => {
    const prisma = {
      aiLeadKeywordHistory: {
        async deleteMany() {
          return { count: 0 };
        }
      }
    } as unknown as PrismaService;
    const store = new PrismaAiLeadKeywordHistoryStore(prisma);

    const deleted = await store.deleteByIdForUser('missing-history', 'u-1');

    assert.equal(deleted, false);
  });
});
