import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  aiLeadKeywordOptimizeTimeout,
  aiLeadSearchOrchestrateTimeout,
  buildDeleteLeadKeywordHistoryRequestConfig,
  buildCreateLeadDirectorySourceRuleRequestConfig,
  buildCreateLeadSearchTaskRequestConfig,
  buildDeleteLeadDirectorySourceRuleRequestConfig,
  buildCurrentLeadSearchTaskRequestConfig,
  buildLeadDirectorySourceRuleListRequestConfig,
  buildLeadKeywordHistoryListRequestConfig,
  buildLeadKeywordOptimizeRequestConfig,
  buildLeadQueueConfigRequestConfig,
  buildLeadSearchTaskActionRequestConfig,
  buildLeadSearchTaskRequestConfig,
  buildLeadSearchOrchestrateRequestConfig,
  buildSaveLeadQueueConfigRequestConfig,
  buildUpdateLeadDirectorySourceRuleRequestConfig,
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

  it('builds search task creation request with optimized keyword plan', () => {
    const payload = {
      requirement: '找沙特轴承进口商',
      targetLeadCount: 20,
      productLineId: 'product-line-1',
      keywordPlan: {
        resolvedProductKeywords: '6204 bearing',
        resolvedTargetRegions: '沙特阿拉伯',
        resolvedTargetCustomerProfile: '进口商',
        resolvedTargetLeadCount: 20,
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

    const config = buildCreateLeadSearchTaskRequestConfig(payload);

    assert.equal(config.url, '/ai-leads/search-tasks');
    assert.equal(config.method, 'post');
    assert.deepEqual(config.data, payload);
  });

  it('builds search task read and action request configs', () => {
    assert.deepEqual(buildCurrentLeadSearchTaskRequestConfig(), {
      url: '/ai-leads/search-tasks/current',
      method: 'get'
    });
    assert.deepEqual(buildLeadSearchTaskRequestConfig('task-1'), {
      url: '/ai-leads/search-tasks/task-1',
      method: 'get'
    });
    assert.deepEqual(buildLeadSearchTaskActionRequestConfig('task-1', 'interrupt'), {
      url: '/ai-leads/search-tasks/task-1/interrupt',
      method: 'post'
    });
    assert.deepEqual(buildLeadSearchTaskActionRequestConfig('task-1', 'read'), {
      url: '/ai-leads/search-tasks/task-1/read',
      method: 'post'
    });
  });

  it('builds ai leads queue config request configs', () => {
    assert.deepEqual(buildLeadQueueConfigRequestConfig(), {
      url: '/ai-leads/queue-config',
      method: 'get'
    });
    assert.deepEqual(buildSaveLeadQueueConfigRequestConfig({ workerConcurrency: 2 }), {
      url: '/ai-leads/queue-config',
      method: 'post',
      data: { workerConcurrency: 2 }
    });
  });

  it('builds directory source rule request configs', () => {
    const payload = {
      value: 'example-directory.com',
      matchMode: 'domain_suffix' as const,
      enabled: true,
      description: '测试目录'
    };

    assert.deepEqual(buildLeadDirectorySourceRuleListRequestConfig(), {
      url: '/ai-leads/directory-source-rules',
      method: 'get'
    });
    assert.deepEqual(buildCreateLeadDirectorySourceRuleRequestConfig(payload), {
      url: '/ai-leads/directory-source-rules',
      method: 'post',
      data: payload
    });
    assert.deepEqual(buildUpdateLeadDirectorySourceRuleRequestConfig('rule-1', payload), {
      url: '/ai-leads/directory-source-rules/rule-1',
      method: 'patch',
      data: payload
    });
    assert.deepEqual(buildDeleteLeadDirectorySourceRuleRequestConfig('rule-1'), {
      url: '/ai-leads/directory-source-rules/rule-1',
      method: 'delete'
    });
  });
});
