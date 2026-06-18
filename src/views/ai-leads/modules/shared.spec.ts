import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createKeywordOptimizationViewModel,
  formatKeywordOptimizationVisibleText,
  parseKeywordOptimizationPlan
} from './shared';

const keywordPlan: Api.AiLeads.OptimizedKeywordPlan = {
  resolvedProductKeywords: '6204 bearing, deep groove ball bearing',
  resolvedTargetRegions: '沙特阿拉伯',
  resolvedTargetCustomerProfile: '轴承进口商和工业品经销商',
  resolvedTargetLeadCount: null,
  structuredRequirement: '中国河北轴承供应商寻找沙特进口商和经销商。',
  buyerSegments: [
    {
      buyerType: 'Importer',
      purchaseReason: '补充本地轴承库存并转售给工业客户',
      websiteSignals: ['Import', 'Bearing catalog'],
      priorityContacts: ['Purchasing Manager'],
      priorityLevel: '高'
    }
  ],
  serperSearchQueries: [
    {
      buyerType: 'Importer',
      intent: 'importer',
      q: '6204 bearing importer Saudi Arabia',
      location: 'Saudi Arabia',
      gl: 'sa',
      hl: 'en',
      priority: '高'
    }
  ],
  serperMapsQueries: [
    {
      buyerType: 'Industrial supplier',
      intent: 'industrial_supplier',
      q: 'bearing supplier Riyadh',
      location: 'Riyadh',
      city: 'Riyadh',
      gl: 'sa',
      hl: 'en',
      priority: '高',
      expectedPlaceTypes: ['Bearing supplier']
    }
  ],
  searchExecutionRules: {
    keep: ['importer'],
    exclude: ['school'],
    websiteCheckPages: ['Products'],
    dedupeKeys: ['domain']
  }
};

describe('ai leads keyword optimization helpers', () => {
  it('parses the AI keyword optimization JSON text', () => {
    const result = parseKeywordOptimizationPlan(JSON.stringify(keywordPlan));

    assert.equal(result.resolvedProductKeywords, keywordPlan.resolvedProductKeywords);
    assert.equal(result.serperSearchQueries[0].q, '6204 bearing importer Saudi Arabia');
  });

  it('keeps business summary visible while hiding query details for regular users', () => {
    const viewModel = createKeywordOptimizationViewModel(keywordPlan, false);

    assert.equal(viewModel.summaryItems.length, 4);
    assert.equal(viewModel.buyerSegments.length, 1);
    assert.equal(viewModel.showQueryDetails, false);
    assert.deepEqual(viewModel.searchQueries, []);
    assert.deepEqual(viewModel.mapsQueries, []);
  });

  it('shows Search and Maps query details for super administrators', () => {
    const viewModel = createKeywordOptimizationViewModel(keywordPlan, true);

    assert.equal(viewModel.showQueryDetails, true);
    assert.equal(viewModel.searchQueries[0].q, '6204 bearing importer Saudi Arabia');
    assert.equal(viewModel.mapsQueries[0].q, 'bearing supplier Riyadh');
  });

  it('formats only visible fields when regular users copy the result', () => {
    const viewModel = createKeywordOptimizationViewModel(keywordPlan, false);
    const text = formatKeywordOptimizationVisibleText(viewModel);

    assert.match(text, /需求归纳：中国河北轴承供应商寻找沙特进口商和经销商。/);
    assert.match(text, /买家类型：Importer/);
    assert.doesNotMatch(text, /6204 bearing importer Saudi Arabia/);
    assert.doesNotMatch(text, /bearing supplier Riyadh/);
  });
});
