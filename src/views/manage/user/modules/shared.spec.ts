import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildSystemUserSearchParams,
  createDefaultUserFilterModel,
  getDefaultUserPermissionsByRoles,
  formatUserDateTime,
  getUserExpirationState,
  getUserLockedState,
  userPermissionGroups,
  userExpirationLabelMap,
  userStatusLabelMap
} from './shared';

describe('system user shared helpers', () => {
  it('creates an empty user filter model', () => {
    assert.deepEqual(createDefaultUserFilterModel(), {
      keyword: '',
      role: null,
      status: null,
      expirationStatus: null
    });
  });

  it('builds user search params from pagination and filters', () => {
    assert.deepEqual(
      buildSystemUserSearchParams({
        current: 2,
        size: 20,
        filterModel: {
          keyword: ' Super ',
          role: 'R_SUPER',
          status: 'enabled',
          expirationStatus: 'active'
        }
      }),
      {
        current: 2,
        size: 20,
        keyword: 'Super',
        role: 'R_SUPER',
        status: 'enabled',
        expirationStatus: 'active'
      }
    );
  });

  it('skips empty optional search filters', () => {
    assert.deepEqual(
      buildSystemUserSearchParams({
        current: 1,
        size: 10,
        filterModel: createDefaultUserFilterModel()
      }),
      {
        current: 1,
        size: 10
      }
    );
  });

  it('exposes labels for enabled, disabled and expiration states', () => {
    assert.equal(userStatusLabelMap.enabled, '启用');
    assert.equal(userStatusLabelMap.disabled, '禁用');
    assert.equal(userExpirationLabelMap.active, '有效');
    assert.equal(userExpirationLabelMap.expired, '已过期');
  });

  it('exposes CRM permission groups for user assignment', () => {
    assert.equal(userPermissionGroups.length > 0, true);
    assert.equal(
      userPermissionGroups.some(group => group.options.some(option => option.value === 'crm:settings:assets:write')),
      true
    );
    assert.deepEqual(getDefaultUserPermissionsByRoles(['R_USER']), []);
    assert.equal(getDefaultUserPermissionsByRoles(['R_ADMIN']).includes('crm:settings:assets:write'), true);
  });

  it('reads expiration and lock display state from row flags', () => {
    assert.deepEqual(getUserExpirationState({ expired: false } as Api.SystemUser.UserListItem), {
      label: '有效',
      type: 'success'
    });
    assert.deepEqual(getUserLockedState({ locked: true } as Api.SystemUser.UserListItem), {
      label: '已锁定',
      type: 'error'
    });
  });

  it('formats nullable user datetime values', () => {
    assert.equal(formatUserDateTime('2026-06-18T10:11:12.000+08:00'), '2026-06-18 10:11:12');
    assert.equal(formatUserDateTime(null), '-');
  });
});
