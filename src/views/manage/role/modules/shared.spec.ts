import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildRolePermissionChangePreview,
  buildSystemRoleSearchParams,
  createDefaultRoleFilterModel,
  getPermissionLabel,
  rolePermissionGroups,
  roleStatusLabelMap
} from './shared';

describe('system role shared helpers', () => {
  it('builds role search params and skips empty filters', () => {
    assert.deepEqual(
      buildSystemRoleSearchParams({
        current: 2,
        size: 20,
        filterModel: {
          keyword: ' admin ',
          status: 'enabled'
        }
      }),
      {
        current: 2,
        size: 20,
        keyword: 'admin',
        status: 'enabled'
      }
    );

    assert.deepEqual(
      buildSystemRoleSearchParams({
        current: 1,
        size: 10,
        filterModel: createDefaultRoleFilterModel()
      }),
      {
        current: 1,
        size: 10
      }
    );
  });

  it('exposes permission groups and role status labels', () => {
    assert.equal(roleStatusLabelMap.enabled, '启用');
    assert.equal(roleStatusLabelMap.disabled, '禁用');
    assert.equal(getPermissionLabel('crm:settings:assets:write'), '维护写信资料');
    assert.equal(rolePermissionGroups.some(group => group.key === 'crm_settings_assets'), true);
  });

  it('builds normalized role permission change previews', () => {
    const preview = buildRolePermissionChangePreview(
      ['crm:settings:assets:read'],
      ['crm:settings:assets:write']
    );

    assert.equal(preview.changed, true);
    assert.deepEqual(preview.added, ['crm:settings:assets:write']);
    assert.deepEqual(preview.removed, []);
  });
});
