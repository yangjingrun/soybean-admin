import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createLeadSearchProgressEmitter,
  serializeLeadSearchProgressEvent,
  toLeadSearchPublicResult
} from './ai-lead-search-progress';

describe('ai lead search progress helpers', () => {
  it('creates sequenced business progress events', async () => {
    const emitted: unknown[] = [];
    const emitter = createLeadSearchProgressEmitter('run-1', event => {
      emitted.push(event);
    });

    await emitter.emit({
      type: 'step_progress',
      stepKey: 'collect_public_leads',
      title: '采集公开线索',
      description: '正在采集第 2 组公开线索',
      metrics: [{ key: 'actionCount', label: '采集动作', value: 2, total: 20 }]
    });

    assert.equal(emitted.length, 1);
    assert.match((emitted[0] as { emittedAt: string }).emittedAt, /^20/);
    assert.deepEqual(emitted[0], {
      type: 'step_progress',
      runId: 'run-1',
      sequence: 1,
      emittedAt: (emitted[0] as { emittedAt: string }).emittedAt,
      stepKey: 'collect_public_leads',
      title: '采集公开线索',
      description: '正在采集第 2 组公开线索',
      metrics: [{ key: 'actionCount', label: '采集动作', value: 2, total: 20 }]
    });
  });

  it('serializes one event per NDJSON line', () => {
    const line = serializeLeadSearchProgressEvent({
      type: 'workflow_started',
      runId: 'run-1',
      sequence: 1,
      emittedAt: '2026-06-18T00:00:00.000Z',
      title: '开始搜索采集'
    });

    assert.equal(line.endsWith('\n'), true);
    assert.equal(JSON.parse(line).title, '开始搜索采集');
  });

  it('projects internal search output into ordinary-user-safe result', () => {
    const result = toLeadSearchPublicResult({
      qualityWarnings: ['本地语言查询不足'],
      serperRequests: [{ endpoint: 'search' }],
      serperResults: [
        {
          endpoint: 'search',
          requestBody: { q: 'bearing distributor Saudi Arabia', page: 1 },
          result: {
            organic: [
              {
                title: 'Bearing House',
                link: 'https://bearing.example.com',
                snippet: 'bearing distributor',
                position: 1,
                sitelinks: [{ title: 'Products', link: 'https://bearing.example.com/products' }]
              }
            ],
            relatedSearches: [{ query: 'bearing supplier Saudi Arabia' }]
          }
        }
      ],
      decisions: [{ decision: { nextAction: 'stop' } }],
      candidates: [
        {
          sourceType: 'organic',
          title: 'Bearing House',
          url: 'https://bearing.example.com',
          snippet: 'bearing distributor'
        }
      ],
      stopReason: '已达到目标线索数量'
    });

    assert.equal(result.summary.candidateCount, 1);
    assert.equal(result.summary.actionCount, 1);
    assert.equal(result.summary.qualityCheckCount, 1);
    assert.equal(result.summary.stopReason, '已达到目标线索数量');
    assert.equal(result.candidates[0].sourceLabel, '公开线索');
    assert.deepEqual(result.serperResults, []);
    assert.equal(JSON.stringify(result).includes('apiKey'), false);
  });
});
