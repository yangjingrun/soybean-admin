import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SystemLogService } from './system-log.service';
import type { SystemLogRecord, SystemLogRecordInput, SystemLogStore, SystemLogWhereInput } from './system-log.types';

describe('SystemLogService', () => {
  it('filters by page, time range, user and error level', async () => {
    const store = createStoreStub([
      createLog({
        id: 'log-1',
        level: 'error',
        status: 'failed',
        userId: 'u-1',
        userName: 'Super',
        createdAt: new Date('2026-06-17T01:00:00.000Z')
      })
    ]);
    const service = new SystemLogService(store);

    const result = await service.list({
      current: 2,
      size: 10,
      level: 'error',
      userId: 'u-1',
      startTime: '2026-06-17T00:00:00.000Z',
      endTime: '2026-06-18T00:00:00.000Z',
      keyword: '模型'
    });

    assert.equal(store.lastFindManyArgs?.skip, 10);
    assert.equal(store.lastFindManyArgs?.take, 10);
    assert.deepEqual(store.lastFindManyArgs?.orderBy, { createdAt: 'desc' });
    assert.deepEqual(store.lastFindManyArgs?.where, {
      level: 'error',
      userId: 'u-1',
      createdAt: {
        gte: new Date('2026-06-17T00:00:00.000Z'),
        lte: new Date('2026-06-18T00:00:00.000Z')
      },
      OR: [
        { message: { contains: '模型', mode: 'insensitive' } },
        { action: { contains: '模型', mode: 'insensitive' } },
        { module: { contains: '模型', mode: 'insensitive' } },
        { userName: { contains: '模型', mode: 'insensitive' } },
        { errorMessage: { contains: '模型', mode: 'insensitive' } }
      ]
    });
    assert.equal(result.current, 2);
    assert.equal(result.size, 10);
    assert.equal(result.total, 1);
    assert.equal(result.records[0].id, 'log-1');
    assert.equal(result.records[0].createdAt, '2026-06-17T01:00:00.000Z');
  });

  it('normalizes string pagination from http query params', async () => {
    const store = createStoreStub([]);
    const service = new SystemLogService(store);

    const result = await service.list({
      current: '3',
      size: '15'
    });

    assert.equal(store.lastFindManyArgs?.skip, 30);
    assert.equal(store.lastFindManyArgs?.take, 15);
    assert.equal(result.current, 3);
    assert.equal(result.size, 15);
  });

  it('records sanitized metadata without secret fields', async () => {
    const store = createStoreStub([]);
    const service = new SystemLogService(store);

    await service.record({
      level: 'info',
      status: 'success',
      module: 'ai-gateway',
      action: 'generate-text',
      message: 'AI 文本生成成功',
      userId: 'u-1',
      userName: 'Super',
      metadata: {
        prompt: '找客户',
        apiKey: 'sk-test',
        nested: {
          token: 'secret',
          model: 'gpt-4o-mini'
        }
      }
    });

    assert.deepEqual(store.lastCreateArgs?.metadata, {
      prompt: '找客户',
      nested: {
        model: 'gpt-4o-mini'
      }
    });
  });
});

function createLog(overrides: Partial<SystemLogRecord> = {}): SystemLogRecord {
  return {
    id: 'log-1',
    level: 'info',
    status: 'success',
    module: 'auth',
    action: 'login',
    message: '登录成功',
    userId: null,
    userName: null,
    errorCode: null,
    errorMessage: null,
    metadata: null,
    createdAt: new Date('2026-06-17T00:00:00.000Z'),
    ...overrides
  };
}

function createStoreStub(records: SystemLogRecord[]) {
  const stub = {
    lastFindManyArgs: null as { where: SystemLogWhereInput; skip: number; take: number; orderBy: { createdAt: 'desc' } } | null,
    lastCreateArgs: null as SystemLogRecordInput | null,
    async list(args: { where: SystemLogWhereInput; skip: number; take: number; orderBy: { createdAt: 'desc' } }) {
      stub.lastFindManyArgs = args;

      return records;
    },
    async count() {
      return records.length;
    },
    async findById(id: string) {
      return records.find(item => item.id === id) ?? null;
    },
    async create(input: SystemLogRecordInput) {
      stub.lastCreateArgs = input;

      return createLog(input as Partial<SystemLogRecord>);
    },
    async listUsers() {
      return [];
    }
  } satisfies SystemLogStore & {
    lastFindManyArgs: { where: SystemLogWhereInput; skip: number; take: number; orderBy: { createdAt: 'desc' } } | null;
    lastCreateArgs: SystemLogRecordInput | null;
  };

  return stub;
}
