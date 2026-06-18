import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatHistorySubject, formatHistoryTargetRegions } from './history-display';

const keywordPlan: Api.AiLeads.OptimizedKeywordPlan = {
  resolvedProductKeywords: '6204 bearing, deep groove ball bearing',
  resolvedTargetRegions: 'South Korea',
  resolvedTargetCustomerProfile: 'bearing distributors and wholesalers',
  resolvedTargetLeadCount: null,
  structuredRequirement: '寻找韩国轴承经销商和批发商',
  buyerSegments: [],
  serperSearchQueries: [],
  searchExecutionRules: {
    keep: [],
    exclude: [],
    websiteCheckPages: [],
    dedupeKeys: []
  }
};

describe('ai leads history display helpers', () => {
  it('formats English target regions as Chinese labels', () => {
    assert.equal(formatHistoryTargetRegions('Saudi Arabia'), '沙特阿拉伯');
    assert.equal(formatHistoryTargetRegions('United Arab Emirates'), '阿联酋');
  });

  it('keeps existing Chinese target regions readable', () => {
    assert.equal(formatHistoryTargetRegions('沙特阿拉伯'), '沙特阿拉伯');
  });

  it('formats multiple target regions consistently', () => {
    assert.equal(formatHistoryTargetRegions('South Korea, Mexico'), '韩国、墨西哥');
  });

  it('formats a compact history subject from product, region and customer profile', () => {
    assert.equal(formatHistorySubject(keywordPlan), '轴承  韩国  经销商/批发商');
  });
});
