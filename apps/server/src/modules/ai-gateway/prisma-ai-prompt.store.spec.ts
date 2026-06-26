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

  it('upserts a single draft prompt version with version zero', async () => {
    const updatedAt = new Date('2026-06-21T10:00:00.000Z');
    const calls: unknown[] = [];
    const prisma = {
      aiPromptVersion: {
        async upsert(args: unknown) {
          calls.push(args);

          return {
            id: 'version-draft',
            promptKey: 'lead_maps_keyword_optimize',
            title: '地图关键词优化',
            version: 0,
            lifecycle: 'draft',
            systemPrompt: 'Maps prompt',
            validationResult: { ok: true, items: [] },
            changeNote: '调整 Maps 规则',
            createdById: 'u-1',
            createdByName: 'Super',
            publishedAt: null,
            createdAt: updatedAt,
            updatedAt
          };
        }
      }
    } as unknown as PrismaService;
    const store = new PrismaAiPromptStore(prisma);

    const record = await store.saveDraftPromptVersion({
      promptKey: 'lead_maps_keyword_optimize',
      title: '地图关键词优化',
      systemPrompt: 'Maps prompt',
      validationResult: { ok: true, items: [] },
      changeNote: '调整 Maps 规则',
      userId: 'u-1',
      userName: 'Super'
    });

    assert.deepEqual(calls, [
      {
        where: {
          promptKey_version: {
            promptKey: 'lead_maps_keyword_optimize',
            version: 0
          }
        },
        create: {
          promptKey: 'lead_maps_keyword_optimize',
          title: '地图关键词优化',
          version: 0,
          lifecycle: 'draft',
          systemPrompt: 'Maps prompt',
          validationResult: { ok: true, items: [] },
          changeNote: '调整 Maps 规则',
          createdById: 'u-1',
          createdByName: 'Super'
        },
        update: {
          title: '地图关键词优化',
          lifecycle: 'draft',
          systemPrompt: 'Maps prompt',
          validationResult: { ok: true, items: [] },
          changeNote: '调整 Maps 规则',
          createdById: 'u-1',
          createdByName: 'Super',
          publishedAt: null
        }
      }
    ]);
    assert.equal(record.id, 'version-draft');
    assert.equal(record.version, 0);
    assert.equal(record.lifecycle, 'draft');
  });

  it('publishes the draft as the next historical version and updates the current prompt config', async () => {
    const now = new Date('2026-06-21T10:30:00.000Z');
    const calls: string[] = [];
    const tx = {
      aiPromptVersion: {
        async findUnique() {
          calls.push('find-draft');

          return {
            id: 'draft',
            promptKey: 'lead_maps_keyword_optimize',
            title: '地图关键词优化',
            version: 0,
            lifecycle: 'draft',
            systemPrompt: 'Maps prompt',
            validationResult: { ok: true, items: [] },
            changeNote: null,
            createdById: 'u-1',
            createdByName: 'Super',
            publishedAt: null,
            createdAt: now,
            updatedAt: now
          };
        },
        async aggregate(args: unknown) {
          calls.push(JSON.stringify(args));

          return {
            _max: {
              version: 2
            }
          };
        },
        async create(args: unknown) {
          calls.push(JSON.stringify(args));

          return {
            id: 'published-v3',
            promptKey: 'lead_maps_keyword_optimize',
            title: '地图关键词优化',
            version: 3,
            lifecycle: 'published',
            systemPrompt: 'Maps prompt',
            validationResult: { ok: true, items: [] },
            changeNote: '发布地图规则',
            createdById: 'u-1',
            createdByName: 'Super',
            publishedAt: now,
            createdAt: now,
            updatedAt: now
          };
        },
        async delete() {
          calls.push('delete-draft');
        }
      },
      aiPromptConfig: {
        async upsert(args: unknown) {
          calls.push(JSON.stringify(args));
        }
      }
    };
    const prisma = {
      async $transaction(callback: (transaction: typeof tx) => Promise<unknown>) {
        return callback(tx);
      }
    } as unknown as PrismaService;
    const store = new PrismaAiPromptStore(prisma);

    const record = await store.publishDraftPromptVersion({
      promptKey: 'lead_maps_keyword_optimize',
      changeNote: '发布地图规则',
      userId: 'u-1',
      userName: 'Super'
    });

    const createCall = JSON.parse(calls[2] || '{}') as { data: { publishedAt?: string } };
    assert.match(createCall.data.publishedAt || '', /^\d{4}-\d{2}-\d{2}T/);
    createCall.data.publishedAt = '<published-at>';
    calls[2] = JSON.stringify(createCall);
    assert.equal(record.version, 3);
    assert.equal(record.lifecycle, 'published');
    assert.deepEqual(calls, [
      'find-draft',
      '{"where":{"promptKey":"lead_maps_keyword_optimize","version":{"gt":0}},"_max":{"version":true}}',
      '{"data":{"promptKey":"lead_maps_keyword_optimize","title":"地图关键词优化","version":3,"lifecycle":"published","systemPrompt":"Maps prompt","validationResult":{"ok":true,"items":[]},"changeNote":"发布地图规则","createdById":"u-1","createdByName":"Super","publishedAt":"<published-at>"}}',
      '{"where":{"promptKey":"lead_maps_keyword_optimize"},"create":{"promptKey":"lead_maps_keyword_optimize","title":"地图关键词优化","systemPrompt":"Maps prompt"},"update":{"title":"地图关键词优化","systemPrompt":"Maps prompt"}}',
      'delete-draft'
    ]);
  });

  it('publishes one prompt body directly and updates the current prompt config', async () => {
    const now = new Date('2026-06-21T10:45:00.000Z');
    const calls: string[] = [];
    const tx = {
      aiPromptVersion: {
        async aggregate(args: unknown) {
          calls.push(JSON.stringify(args));

          return {
            _max: {
              version: 3
            }
          };
        },
        async create(args: unknown) {
          calls.push(JSON.stringify(args));

          return {
            id: 'published-v4',
            promptKey: 'crm_outreach_base_rules',
            title: 'CRM 开发信基础规则',
            version: 4,
            lifecycle: 'published',
            systemPrompt: 'CRM prompt',
            validationResult: { ok: true, items: [] },
            changeNote: '直接发布全局版本',
            createdById: 'u-1',
            createdByName: 'Super',
            publishedAt: now,
            createdAt: now,
            updatedAt: now
          };
        }
      },
      aiPromptConfig: {
        async upsert(args: unknown) {
          calls.push(JSON.stringify(args));
        }
      }
    };
    const prisma = {
      async $transaction(callback: (transaction: typeof tx) => Promise<unknown>) {
        return callback(tx);
      }
    } as unknown as PrismaService;
    const store = new PrismaAiPromptStore(prisma);

    const record = await store.publishPromptVersion({
      promptKey: 'crm_outreach_base_rules',
      title: 'CRM 开发信基础规则',
      systemPrompt: 'CRM prompt',
      validationResult: { ok: true, items: [] },
      changeNote: '直接发布全局版本',
      userId: 'u-1',
      userName: 'Super'
    });

    const createCall = JSON.parse(calls[1] || '{}') as { data: { publishedAt?: string } };
    assert.match(createCall.data.publishedAt || '', /^\d{4}-\d{2}-\d{2}T/);
    createCall.data.publishedAt = '<published-at>';
    calls[1] = JSON.stringify(createCall);
    assert.equal(record.version, 4);
    assert.equal(record.lifecycle, 'published');
    assert.deepEqual(calls, [
      '{"where":{"promptKey":"crm_outreach_base_rules","version":{"gt":0}},"_max":{"version":true}}',
      '{"data":{"promptKey":"crm_outreach_base_rules","title":"CRM 开发信基础规则","version":4,"lifecycle":"published","systemPrompt":"CRM prompt","validationResult":{"ok":true,"items":[]},"changeNote":"直接发布全局版本","createdById":"u-1","createdByName":"Super","publishedAt":"<published-at>"}}',
      '{"where":{"promptKey":"crm_outreach_base_rules"},"create":{"promptKey":"crm_outreach_base_rules","title":"CRM 开发信基础规则","systemPrompt":"CRM prompt"},"update":{"title":"CRM 开发信基础规则","systemPrompt":"CRM prompt"}}'
    ]);
  });

  it('lists published prompt versions newest first', async () => {
    const updatedAt = new Date('2026-06-21T11:00:00.000Z');
    const prisma = {
      aiPromptVersion: {
        async findMany(args: unknown) {
          assert.deepEqual(args, {
            where: {
              promptKey: 'lead_maps_keyword_optimize',
              version: {
                gt: 0
              }
            },
            orderBy: {
              version: 'desc'
            },
            take: 10
          });

          return [
            {
              id: 'published-v2',
              promptKey: 'lead_maps_keyword_optimize',
              title: '地图关键词优化',
              version: 2,
              lifecycle: 'published',
              systemPrompt: 'Maps prompt v2',
              validationResult: null,
              changeNote: null,
              createdById: 'u-1',
              createdByName: 'Super',
              publishedAt: updatedAt,
              createdAt: updatedAt,
              updatedAt
            }
          ];
        }
      }
    } as unknown as PrismaService;
    const store = new PrismaAiPromptStore(prisma);

    const records = await store.listPromptVersions('lead_maps_keyword_optimize', 10);

    assert.equal(records[0]?.id, 'published-v2');
    assert.equal(records[0]?.version, 2);
  });

  it('records prompt test runs for later diagnostics', async () => {
    const createdAt = new Date('2026-06-21T11:30:00.000Z');
    const prisma = {
      aiPromptTestRun: {
        async create(args: unknown) {
          assert.deepEqual(args, {
            data: {
              promptKey: 'lead_maps_keyword_optimize',
              inputPrompt: '找纽约轴承经销商',
              outputText: '{"serperMapsQueries":[]}',
              validationResult: { ok: false, items: [] },
              success: false,
              durationMs: 1200,
              errorMessage: 'serperMapsQueries 数量不足',
              createdById: 'u-1',
              createdByName: 'Super'
            }
          });

          return {
            id: 'test-run-1',
            promptKey: 'lead_maps_keyword_optimize',
            inputPrompt: '找纽约轴承经销商',
            outputText: '{"serperMapsQueries":[]}',
            validationResult: { ok: false, items: [] },
            success: false,
            durationMs: 1200,
            errorMessage: 'serperMapsQueries 数量不足',
            createdById: 'u-1',
            createdByName: 'Super',
            createdAt
          };
        }
      }
    } as unknown as PrismaService;
    const store = new PrismaAiPromptStore(prisma);

    const record = await store.recordPromptTestRun({
      promptKey: 'lead_maps_keyword_optimize',
      inputPrompt: '找纽约轴承经销商',
      outputText: '{"serperMapsQueries":[]}',
      validationResult: { ok: false, items: [] },
      success: false,
      durationMs: 1200,
      errorMessage: 'serperMapsQueries 数量不足',
      userId: 'u-1',
      userName: 'Super'
    });

    assert.equal(record.id, 'test-run-1');
    assert.equal(record.createdAt, createdAt.toISOString());
  });
});
