import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { PrismaService } from '../database/prisma.service';
import { PrismaAiPromptStore } from './prisma-ai-prompt.store';

describe('PrismaAiPromptStore', () => {
  it('reads one prompt config from PostgreSQL by prompt key', async () => {
    const updatedAt = new Date('2026-06-17T09:00:00.000Z');
    const prisma = {
      aiPromptConfig: {
        async findUnique(args: unknown) {
          assert.deepEqual(args, {
            where: { promptKey: 'lead_keyword_optimize' }
          });

          return {
            promptKey: 'lead_keyword_optimize',
            title: '关键词优化',
            systemPrompt: '按管理员配置优化关键词',
            updatedAt
          };
        }
      }
    } as unknown as PrismaService;
    const store = new PrismaAiPromptStore(prisma);

    const record = await store.getPrompt('lead_keyword_optimize');

    assert.deepEqual(record, {
      promptKey: 'lead_keyword_optimize',
      title: '关键词优化',
      systemPrompt: '按管理员配置优化关键词',
      updatedAt: updatedAt.toISOString()
    });
  });

  it('upserts one prompt config into PostgreSQL', async () => {
    const updatedAt = new Date('2026-06-17T09:30:00.000Z');
    const calls: unknown[] = [];
    const prisma = {
      aiPromptConfig: {
        async upsert(args: unknown) {
          calls.push(args);

          return {
            promptKey: 'lead_match_analyze',
            title: '匹配分析',
            systemPrompt: '分析线索匹配度',
            updatedAt
          };
        }
      }
    } as unknown as PrismaService;
    const store = new PrismaAiPromptStore(prisma);

    const record = await store.savePrompt({
      promptKey: 'lead_match_analyze',
      title: '匹配分析',
      systemPrompt: '分析线索匹配度',
      updatedAt: 'ignored-by-store'
    });

    assert.deepEqual(calls, [
      {
        where: { promptKey: 'lead_match_analyze' },
        create: {
          promptKey: 'lead_match_analyze',
          title: '匹配分析',
          systemPrompt: '分析线索匹配度'
        },
        update: {
          title: '匹配分析',
          systemPrompt: '分析线索匹配度'
        }
      }
    ]);
    assert.equal(record.updatedAt, updatedAt.toISOString());
  });
});
