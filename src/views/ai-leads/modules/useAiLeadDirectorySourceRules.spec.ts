import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseDirectorySourceRuleValues } from './directory-source-rules';

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
