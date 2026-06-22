import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildSystemOrganizationSearchParams,
  createDefaultOrganizationFilterModel,
  formatOrganizationDateTime,
  organizationStatusLabelMap,
  organizationStatusTagTypeMap
} from './shared';
describe('system organization shared helpers', () => {
  it('creates an empty organization filter model', () => {
    assert.deepEqual(createDefaultOrganizationFilterModel(), {
      keyword: '',
      status: null
    });
  });
  it('builds organization search params from pagination and filters', () => {
    assert.deepEqual(
      buildSystemOrganizationSearchParams({
        current: 2,
        size: 20,
        filterModel: {
          keyword: ' Default Org ',
          status: 'enabled'
        }
      }),
      {
        current: 2,
        size: 20,
        keyword: 'Default Org',
        status: 'enabled'
      }
    );
  });
  it('skips empty optional organization filters', () => {
    assert.deepEqual(
      buildSystemOrganizationSearchParams({
        current: 1,
        size: 10,
        filterModel: createDefaultOrganizationFilterModel()
      }),
      {
        current: 1,
        size: 10
      }
    );
  });
  it('exposes organization status labels and tag types', () => {
    assert.equal(organizationStatusLabelMap.enabled, '启用');
    assert.equal(organizationStatusLabelMap.disabled, '禁用');
    assert.equal(organizationStatusTagTypeMap.enabled, 'success');
    assert.equal(organizationStatusTagTypeMap.disabled, 'error');
  });
  it('formats nullable organization datetime values', () => {
    assert.equal(formatOrganizationDateTime('2026-06-18T10:11:12.000+08:00'), '2026-06-18 10:11:12');
    assert.equal(formatOrganizationDateTime(null), '-');
  });
});
