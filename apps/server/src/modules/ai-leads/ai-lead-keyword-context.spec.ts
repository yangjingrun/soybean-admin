import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatAiLeadKeywordContextPromptBlock, normalizeAiLeadKeywordContextSnapshot } from './ai-lead-keyword-context';

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
});
