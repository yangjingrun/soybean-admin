import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createDefaultLeadSearchForm } from './useAiLeadKeywordOptimization';

describe('AI lead keyword optimization state helpers', () => {
  it('creates an empty requirement form with the default target lead count', () => {
    assert.deepEqual(createDefaultLeadSearchForm(20), {
      productLineId: null,
      targetRegionValue: '',
      targetRegionLabel: '',
      targetRegionCountryCode: null,
      targetCustomerTypeKeys: [
        'importer',
        'distributor_dealer',
        'wholesaler_stockist',
        'industrial_supplier',
        'mro_spare_parts'
      ],
      exclusionRuleKeys: [
        'china_supplier',
        'wrong_market',
        'b2c_only',
        'marketplace_listing',
        'no_official_website',
        'irrelevant_product',
        'job_news_blog'
      ],
      keywordText: '',
      requirement: '',
      targetLeadCount: 20,
      leadSourceMode: 'search'
    });
  });
});
