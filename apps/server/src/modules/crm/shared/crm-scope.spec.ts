import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createCrmOwnerFilter,
  createCrmOwnerWriteScope,
  createCrmReadScope,
  requireCrmOrganizationAdminScope
} from './crm-scope';
import type { CrmUserContext } from './crm-context';

function createContext(overrides: Partial<CrmUserContext> = {}): CrmUserContext {
  return {
    userId: 'user-1',
    userName: 'Member',
    roles: ['R_USER'],
    organizationId: 'org-1',
    organizationRole: 'member',
    ...overrides
  };
}

test('createCrmReadScope keeps ordinary members owner-scoped', () => {
  assert.deepEqual(createCrmReadScope(createContext()), {
    organizationId: 'org-1',
    ownerUserId: 'user-1'
  });
});

test('createCrmReadScope allows organization admins to read organization scope', () => {
  assert.deepEqual(createCrmReadScope(createContext({ organizationRole: 'admin' })), {
    organizationId: 'org-1'
  });
});

test('createCrmOwnerFilter omits organizationId for repository calls that already include it', () => {
  assert.deepEqual(createCrmOwnerFilter(createContext()), { ownerUserId: 'user-1' });
  assert.deepEqual(createCrmOwnerFilter(createContext({ organizationRole: 'admin' })), {});
});

test('createCrmOwnerWriteScope is always owner-only', () => {
  assert.deepEqual(
    createCrmOwnerWriteScope(createContext({ roles: ['R_SUPER'], organizationRole: 'admin' })),
    {
      organizationId: 'org-1',
      ownerUserId: 'user-1'
    }
  );
});

test('requireCrmOrganizationAdminScope rejects ordinary members', () => {
  assert.throws(() => requireCrmOrganizationAdminScope(createContext()), /组织管理员/);
});
