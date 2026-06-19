import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildInboxReplyDraftMetadataItems } from './shared';

describe('crm inbox shared helpers', () => {
  it('builds AI reply draft metadata display items with risk notes', () => {
    const items = buildInboxReplyDraftMetadataItems({
      generated: true,
      reason: 'Kept reply concise and avoided unsupported claims.',
      riskNotes: ['确认交期后再承诺', '不要直接报价'],
      productLineId: 'product-line-1',
      productLineName: 'Bearing',
      generatedAt: '2026-06-20T08:00:00.000Z'
    });

    assert.deepEqual(items, [
      { key: 'reason', label: '润色说明', value: 'Kept reply concise and avoided unsupported claims.' },
      { key: 'risk-0', label: '风险提示 1', value: '确认交期后再承诺' },
      { key: 'risk-1', label: '风险提示 2', value: '不要直接报价' },
      { key: 'product-line', label: '产品资料', value: 'Bearing' }
    ]);
  });

  it('omits empty AI reply draft metadata fields', () => {
    assert.deepEqual(
      buildInboxReplyDraftMetadataItems({
        generated: true,
        reason: '',
        riskNotes: [],
        productLineId: null,
        productLineName: null
      }),
      []
    );
  });
});
