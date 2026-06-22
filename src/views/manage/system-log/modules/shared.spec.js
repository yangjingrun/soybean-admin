import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildSystemLogSearchParams, createDefaultFilterModel } from './shared';
describe('system log shared helpers', () => {
  it('builds query params from pagination and explicit filters', () => {
    const filterModel = createDefaultFilterModel();
    filterModel.timeRange = [
      new Date('2026-06-17T00:00:00.000Z').getTime(),
      new Date('2026-06-17T12:00:00.000Z').getTime()
    ];
    filterModel.module = 'ai-gateway';
    filterModel.level = 'error';
    filterModel.status = 'failed';
    filterModel.keyword = ' 模型失败 ';
    assert.deepEqual(
      buildSystemLogSearchParams({
        current: 2,
        size: 20,
        filterModel
      }),
      {
        current: 2,
        size: 20,
        startTime: '2026-06-17T00:00:00.000Z',
        endTime: '2026-06-17T12:00:00.000Z',
        module: 'ai-gateway',
        level: 'error',
        status: 'failed',
        keyword: '模型失败'
      }
    );
  });
});
