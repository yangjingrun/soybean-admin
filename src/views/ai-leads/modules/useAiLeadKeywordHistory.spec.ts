import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { sortKeywordHistoryRecords } from './useAiLeadKeywordHistory';

function createRecord(id: string, updatedAt: string): Api.AiLeads.KeywordHistoryRecord {
  return {
    id,
    requirement: `requirement-${id}`,
    resultText: '{}',
    keywordPlan: {
      resolvedProductKeywords: 'bearing',
      resolvedTargetRegions: 'Saudi Arabia',
      resolvedTargetCustomerProfile: 'importer',
      resolvedTargetLeadCount: 20,
      structuredRequirement: 'Find bearing importers',
      buyerSegments: [],
      serperSearchQueries: [],
      searchExecutionRules: {
        keep: [],
        exclude: [],
        websiteCheckPages: [],
        dedupeKeys: []
      }
    },
    finishReason: 'stop',
    usage: {
      inputTokens: null,
      outputTokens: null,
      totalTokens: null
    },
    createdAt: updatedAt,
    updatedAt
  };
}

describe('AI lead keyword history helpers', () => {
  it('sorts keyword history records newest first without mutating the input array', () => {
    const older = createRecord('older', '2026-06-20T01:00:00.000Z');
    const newer = createRecord('newer', '2026-06-20T02:00:00.000Z');
    const records = [older, newer];

    assert.deepEqual(
      sortKeywordHistoryRecords(records).map(record => record.id),
      ['newer', 'older']
    );
    assert.deepEqual(
      records.map(record => record.id),
      ['older', 'newer']
    );
  });
});
