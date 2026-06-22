import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildSystemUserSearchParams,
  createDefaultUserFilterModel,
  formatUserDateTime,
  getUserExpirationState,
  getUserLockedState,
  userExpirationLabelMap,
  userStatusLabelMap
} from './shared';
describe('system user shared helpers', () => {
  it('creates an empty user filter model', () => {
    assert.deepEqual(createDefaultUserFilterModel(), {
      keyword: '',
      organizationId: null,
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
          organizationId: 'org-default',
          role: 'R_SUPER',
          status: 'enabled',
          expirationStatus: 'active'
        }
      }),
      {
        current: 2,
        size: 20,
        keyword: 'Super',
        organizationId: 'org-default',
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
  it('reads expiration and lock display state from row flags', () => {
    assert.deepEqual(getUserExpirationState({ expired: false, expireAt: null }), {
      label: '长期有效',
      description: '',
      type: 'success'
    });
    assert.deepEqual(
      getUserExpirationState({
        expired: false,
        expireAt: '2026-06-18T10:11:12.000+08:00'
      }),
      {
        label: '有效至',
        description: '2026-06-18',
        type: 'success'
      }
    );
    assert.deepEqual(
      getUserExpirationState({
        expired: true,
        expireAt: '2026-06-18T10:11:12.000+08:00'
      }),
      {
        label: '已过期',
        description: '2026-06-18',
        type: 'error'
      }
    );
    assert.deepEqual(
      getUserLockedState({
        locked: true,
        lockedUntil: '2026-06-18T10:11:12.000+08:00'
      }),
      {
        label: '锁定至',
        description: '2026-06-18 10:11:12',
        type: 'error'
      }
    );
    assert.deepEqual(getUserLockedState({ locked: false, lockedUntil: null }), {
      label: '正常',
      description: '',
      type: 'success'
    });
  });
  it('formats nullable user date and datetime values', () => {
    assert.equal(formatUserDateTime('2026-06-18T10:11:12.000+08:00'), '2026-06-18 10:11:12');
    assert.equal(formatUserDateTime(null), '-');
  });
});
