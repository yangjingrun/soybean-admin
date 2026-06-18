import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildSystemUserSearchParams, createDefaultUserFilterModel } from './shared';

describe('system user shared helpers', () => {
  it('creates an empty user filter model', () => {
    assert.deepEqual(createDefaultUserFilterModel(), {
      keyword: '',
      role: null
    });
  });

  it('builds user search params from pagination and filters', () => {
    assert.deepEqual(
      buildSystemUserSearchParams({
        current: 2,
        size: 20,
        filterModel: {
          keyword: ' Super ',
          role: 'R_SUPER'
        }
      }),
      {
        current: 2,
        size: 20,
        keyword: 'Super',
        role: 'R_SUPER'
      }
    );
  });
});
