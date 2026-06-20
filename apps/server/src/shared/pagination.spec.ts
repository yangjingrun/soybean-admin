import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createPageResult } from './pagination';

describe('pagination', () => {
  it('builds the standard pagination payload', () => {
    assert.deepEqual(
      createPageResult({
        current: 2,
        size: 20,
        total: 31,
        records: [{ id: 'record-1' }]
      }),
      {
        current: 2,
        size: 20,
        total: 31,
        records: [{ id: 'record-1' }]
      }
    );
  });
});
