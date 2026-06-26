import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isBlockedLeadCandidate } from './ai-lead-candidate-filter';

describe('isBlockedLeadCandidate', () => {
  it('blocks marketplace hosts and marketplace-like titles before enrichment', () => {
    assert.equal(isBlockedLeadCandidate({ url: 'https://shop.taobao.com/item/1', title: '6203 bearing' }), true);
    assert.equal(isBlockedLeadCandidate({ url: 'https://24h.pchome.com.tw/prod/abc', title: '6203 bearing' }), true);
    assert.equal(isBlockedLeadCandidate({ url: 'https://supplier.example.com', title: '6203 bearing 商城' }), true);
  });

  it('keeps independent B2B websites', () => {
    assert.equal(isBlockedLeadCandidate({ url: 'https://bearing-supplier.example.com', title: 'ABC Bearing' }), false);
  });
});
