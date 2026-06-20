import 'reflect-metadata';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';
import { PrismaAiLeadSearchTaskStore } from './prisma-ai-lead-search-task.store';

describe('PrismaAiLeadSearchTaskStore query contracts', () => {
  it('checks current tasks inside the user and organization boundary before creating a task', async () => {
    let capturedWhere: unknown = null;
    const prisma = {
      async $transaction(callback: (tx: unknown) => Promise<unknown>) {
        return callback({
          aiLeadSearchTask: {
            async findMany(args: { where: unknown }) {
              capturedWhere = args.where;
              return [];
            },
            async create() {
              return createTaskModel();
            }
          }
        });
      }
    };
    const store = new PrismaAiLeadSearchTaskStore(prisma as never);

    await store.createTaskIfNoCurrent({
      userId: 'u-1',
      userName: 'User',
      organizationId: 'org-1',
      organizationRole: 'admin',
      requirement: '找沙特轴承进口商',
      targetLeadCount: 20,
      keywordPlan: {},
      priority: 0
    });

    assert.deepEqual(capturedWhere, {
      userId: 'u-1',
      organizationId: 'org-1',
      OR: [{ status: { in: ['queued', 'running', 'interrupted', 'failed'] } }, { status: 'completed', readAt: null }]
    });
  });

  it('keeps a compound index for current task restore queries', () => {
    const schema = readFileSync(resolve(process.cwd(), 'prisma/schema.prisma'), 'utf8');

    assert.match(schema, /@@index\(\[userId,\s*organizationId,\s*status,\s*updatedAt\]\)/);
  });
});

function createTaskModel() {
  return {
    id: 'task-1',
    userId: 'u-1',
    userName: 'User',
    organizationId: 'org-1',
    organizationRole: 'admin',
    requirement: '找沙特轴承进口商',
    targetLeadCount: 20,
    keywordPlan: {},
    status: 'queued',
    priority: 0,
    runVersion: 1,
    progressState: null,
    result: null,
    errorMessage: null,
    bullJobId: null,
    readAt: null,
    notifiedAt: null,
    startedAt: null,
    finishedAt: null,
    createdAt: new Date('2026-06-20T00:00:00.000Z'),
    updatedAt: new Date('2026-06-20T00:00:00.000Z')
  };
}
