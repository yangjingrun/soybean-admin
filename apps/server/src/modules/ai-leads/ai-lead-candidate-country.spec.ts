import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applySerperRequestCountry,
  buildCandidateCountryPatch,
  resolveSerperRequestCountry
} from './ai-lead-candidate-country';

describe('ai lead candidate country helpers', () => {
  it('resolves Serper country from gl before location', () => {
    assert.equal(resolveSerperRequestCountry({ gl: 'kr', location: 'South Korea' }), '韩国');
    assert.equal(resolveSerperRequestCountry({ gl: '', location: 'South Korea' }), '韩国');
    assert.equal(resolveSerperRequestCountry({ gl: '', location: 'Taipei, Taiwan' }), '台湾');
  });

  it('attaches Serper request country to collected candidates', () => {
    assert.deepEqual(
      applySerperRequestCountry([{ title: 'ABC Bearing' }], {
        gl: 'sa',
        location: 'Saudi Arabia'
      }),
      [{ title: 'ABC Bearing', country: '沙特阿拉伯' }]
    );
  });

  it('builds a CRM import country patch only for non-empty candidate country', () => {
    assert.deepEqual(buildCandidateCountryPatch({ country: ' KR ' }), { country: '韩国' });
    assert.deepEqual(buildCandidateCountryPatch({ country: ' 台灣 ' }), { country: '台湾' });
    assert.deepEqual(buildCandidateCountryPatch({ country: '' }), {});
    assert.deepEqual(buildCandidateCountryPatch({}), {});
  });
});
