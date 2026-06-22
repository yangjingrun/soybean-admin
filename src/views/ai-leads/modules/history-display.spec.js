import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatHistorySubject, formatHistorySubjectTokens, formatHistoryTargetRegions } from './history-display';
const keywordPlan = {
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
  it('keeps only the country signal from descriptive target regions', () => {
    assert.equal(formatHistoryTargetRegions('韩国；重点城市、产业与贸易区'), '韩国');
  });
  it('formats a compact history subject from product, region and customer profile', () => {
    assert.equal(formatHistorySubject(keywordPlan), '轴承  韩国  经销商/批发商');
  });
  it('splits the compact subject into styleable tokens', () => {
    assert.deepEqual(formatHistorySubjectTokens(keywordPlan), [
      { type: 'product', text: '轴承' },
      { type: 'region', text: '韩国' },
      { type: 'customer', text: '经销商/批发商' }
    ]);
  });
});
