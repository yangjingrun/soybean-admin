import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { aiLeadKeywordOptimizeTimeout, buildLeadKeywordOptimizeRequestConfig } from './ai-leads.shared';

describe('ai leads api helpers', () => {
  it('uses a longer request timeout for keyword optimization generation', () => {
    const payload = {
      requirement: '找沙特轴承进口商'
    };

    const config = buildLeadKeywordOptimizeRequestConfig(payload);

    assert.equal(config.url, '/ai-leads/keyword-optimize');
    assert.equal(config.method, 'post');
    assert.equal(config.timeout, aiLeadKeywordOptimizeTimeout);
    assert.equal(config.timeout, 60 * 1000);
    assert.deepEqual(config.data, payload);
  });
});
