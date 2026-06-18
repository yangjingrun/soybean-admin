import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  aiLeadKeywordOptimizeTimeout,
  aiLeadSearchOrchestrateTimeout,
  buildDeleteLeadKeywordHistoryRequestConfig,
  buildLeadKeywordHistoryListRequestConfig,
  buildLeadKeywordOptimizeRequestConfig,
  buildLeadSearchOrchestrateRequestConfig,
  buildUpdateLeadKeywordHistoryRequestConfig
} from './ai-leads.shared';

describe('ai leads api helpers', () => {
  it('uses a longer request timeout for keyword optimization generation', () => {
    const payload = {
      requirement: '找沙特轴承进口商'
    };

    const config = buildLeadKeywordOptimizeRequestConfig(payload);

    assert.equal(config.url, '/ai-leads/keyword-optimize');
    assert.equal(config.method, 'post');
    assert.equal(config.timeout, aiLeadKeywordOptimizeTimeout);
    assert.equal(config.timeout, 120 * 1000);
    assert.deepEqual(config.data, payload);
  });

  it('builds keyword history list request config', () => {
    const config = buildLeadKeywordHistoryListRequestConfig({ size: 10 });

    assert.equal(config.url, '/ai-leads/keyword-histories');
    assert.equal(config.method, 'get');
    assert.deepEqual(config.params, { size: 10 });
  });

  it('builds keyword history update request config', () => {
    const payload = {
      requirement: '找沙特轴承进口商',
      keywordPlan: {
        resolvedProductKeywords: '6204 bearing',
        resolvedTargetRegions: '沙特阿拉伯',
        resolvedTargetCustomerProfile: '进口商',
        resolvedTargetLeadCount: null,
        structuredRequirement: '找沙特轴承进口商',
        buyerSegments: [],
        serperSearchQueries: [],
        searchExecutionRules: {
          keep: [],
          exclude: [],
          websiteCheckPages: [],
          dedupeKeys: []
        }
      }
    };
    const config = buildUpdateLeadKeywordHistoryRequestConfig('history-1', payload);

    assert.equal(config.url, '/ai-leads/keyword-histories/history-1');
    assert.equal(config.method, 'patch');
    assert.deepEqual(config.data, payload);
  });

  it('builds keyword history delete request config', () => {
    const config = buildDeleteLeadKeywordHistoryRequestConfig('history-1');

    assert.equal(config.url, '/ai-leads/keyword-histories/history-1');
    assert.equal(config.method, 'delete');
  });

  it('builds search orchestration request with required target lead count', () => {
    const payload = {
      requirement: '找韩国轴承进口商',
      targetLeadCount: 20
    };

    const config = buildLeadSearchOrchestrateRequestConfig(payload);

    assert.equal(config.url, '/ai-leads/search-orchestrate');
    assert.equal(config.method, 'post');
    assert.equal(config.timeout, aiLeadSearchOrchestrateTimeout);
    assert.deepEqual(config.data, payload);
  });
});
