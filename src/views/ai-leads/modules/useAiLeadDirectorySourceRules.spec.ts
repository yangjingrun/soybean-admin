import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseDirectorySourceRuleValues, readDirectorySourceRuleRecords } from './directory-source-rules';

describe('parseDirectorySourceRuleValues', () => {
  it('splits batch directory source values by line and removes duplicates', () => {
    assert.deepEqual(
      parseDirectorySourceRuleValues(`
        https://www.yellowpages-uae.ae/search/bearings
        yello.ae
        https://www.yellowpages-uae.ae/search/bearings
      `),
      ['https://www.yellowpages-uae.ae/search/bearings', 'yello.ae']
    );
  });
});

describe('readDirectorySourceRuleRecords', () => {
  it('reads records from the project request wrapper shape', () => {
    const records = [
      {
        id: 'builtin-domain-yellowpages-uae-com',
        value: 'yellowpages-uae.com',
        matchMode: 'domain_suffix' as const,
        enabled: true,
        builtin: true,
        description: '系统内置黄页/目录域名',
        createdAt: '2026-06-26T00:00:00.000Z',
        updatedAt: '2026-06-26T00:00:00.000Z'
      }
    ];

    assert.deepEqual(readDirectorySourceRuleRecords({ data: { records }, error: null }), records);
    assert.equal(readDirectorySourceRuleRecords({ data: { records }, error: new Error('failed') }), null);
  });
});
