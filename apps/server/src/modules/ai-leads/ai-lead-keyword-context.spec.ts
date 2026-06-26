import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildAiLeadExclusionDecisionRules,
  formatAiLeadKeywordContextPromptBlock,
  normalizeAiLeadKeywordContextSnapshot
} from './ai-lead-keyword-context';

describe('AI lead keyword context', () => {
  it('normalizes target region levels and formats them for keyword prompts', () => {
    const snapshot = normalizeAiLeadKeywordContextSnapshot({
      targetRegions: [
        {
          value: 'market:middle_east',
          label: '中东',
          scope: 'market_region',
          marketRegionCode: 'middle_east',
          marketRegionLabel: '中东'
        },
        {
          value: 'country:AE:%E9%98%BF%E8%81%94%E9%85%8B',
          label: '阿联酋',
          countryCode: 'AE',
          scope: 'country',
          marketRegionCode: 'middle_east',
          marketRegionLabel: '中东'
        },
        {
          value: 'admin1:SA:01:Riyadh::',
          label: '沙特阿拉伯 / Riyadh',
          countryCode: 'SA',
          scope: 'admin1',
          marketRegionCode: 'middle_east',
          marketRegionLabel: '中东'
        }
      ],
      targetCustomerTypes: [{ key: 'importer', label: '进口商' }],
      exclusionRules: [],
      targetLeadCount: 20
    });
    const promptBlock = formatAiLeadKeywordContextPromptBlock(snapshot);

    assert.equal(snapshot?.targetRegion?.label, '中东');
    assert.deepEqual(
      snapshot?.targetRegions.map(item => item.scope),
      ['market_region', 'country', 'admin1']
    );
    assert.match(promptBlock, /目标层级说明：大区\/洲用于市场归类，国家用于市场判断，城市\/区域用于精准开发。/);
    assert.match(promptBlock, /市场归类：中东/);
    assert.match(promptBlock, /国家市场：阿联酋、沙特阿拉伯/);
    assert.match(promptBlock, /城市\/区域：沙特阿拉伯 \/ Riyadh/);
  });

  it('formats selected exclusion rules with executable decision guidance', () => {
    const snapshot = normalizeAiLeadKeywordContextSnapshot({
      targetRegion: { value: 'market:middle_east', label: '中东', scope: 'market_region' },
      targetCustomerTypes: [{ key: 'importer', label: '进口商' }],
      exclusionRules: [
        { key: 'china_supplier', label: '中国供应商/出口商' },
        { key: 'marketplace_listing', label: '平台/目录聚合页' },
        { key: 'no_official_website', label: '无官网或证据不足' },
        { key: 'official_brand_hq', label: '品牌总部/竞争品牌官网' }
      ]
    });
    const promptBlock = formatAiLeadKeywordContextPromptBlock(snapshot);
    const rules = buildAiLeadExclusionDecisionRules(snapshot?.exclusionRules);

    assert.equal(rules.length, 4);
    assert.match(promptBlock, /排除类型判定细则/);
    assert.match(promptBlock, /China brands、made in China、manufacturer in China/);
    assert.match(promptBlock, /目录页本身不是客户/);
    assert.match(promptBlock, /地图标题、地址、电话强命中目标买家时/);
    assert.match(promptBlock, /品牌官网的 dealer\/distributor finder 页面可用于反挖本地经销商/);
  });
});
