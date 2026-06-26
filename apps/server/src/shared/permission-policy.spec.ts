import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import {
  assertOrganizationAdmin,
  assertSuper,
  canViewEmailBody,
  createOrganizationOwnerFilter,
  createOrganizationOwnerWriteScope,
  createOrganizationReadScope,
  isOrganizationAdmin,
  isSuper,
  requireSuperUserContext
} from './permission-policy';
import type { RequestUserContext } from './request-context';

describe('permission-policy', () => {
  it('recognizes platform super users and organization admins', () => {
    assert.equal(isSuper(createContext({ roles: ['R_SUPER'] })), true);
    assert.equal(isOrganizationAdmin(createContext({ organizationRole: 'admin' })), true);
    assert.equal(isOrganizationAdmin(createContext({ roles: ['R_SUPER'], organizationRole: 'member' })), true);
  });

  it('throws project ForbiddenException for failed assertions', () => {
    assert.throws(() => assertSuper(createContext(), '无权操作'), ForbiddenException);
    assert.throws(() => assertOrganizationAdmin(createContext(), '无权操作'), ForbiddenException);
  });

  it('requires both login context and platform super role', () => {
    const superContext = createContext({ roles: ['R_SUPER'] });

    assert.equal(requireSuperUserContext(superContext, '无权操作'), superContext);
    assert.throws(() => requireSuperUserContext(null, '无权操作'), UnauthorizedException);
    assert.throws(() => requireSuperUserContext(createContext(), '无权操作'), ForbiddenException);
  });

  it('keeps CRM email body visibility rules centralized', () => {
    assert.equal(canViewEmailBody(createContext({ userId: 'owner' }), 'owner'), true);
    assert.equal(canViewEmailBody(createContext({ roles: ['R_SUPER'] }), 'owner'), true);
    assert.equal(
      canViewEmailBody(createContext({ organizationRole: 'admin' }), 'owner', { allowAdminViewMemberEmailBody: true }),
      true
    );
    assert.equal(
      canViewEmailBody(createContext({ organizationRole: 'admin' }), 'owner', { allowAdminViewMemberEmailBody: false }),
      false
    );
  });

  it('creates organization read scopes from the authenticated context', () => {
    assert.deepEqual(createOrganizationReadScope(createContext()), {
      organizationId: 'org-1',
      ownerUserId: 'u-1'
    });
    assert.deepEqual(createOrganizationReadScope(createContext({ organizationRole: 'admin' })), {
      organizationId: 'org-1'
    });
    assert.deepEqual(createOrganizationReadScope(createContext({ roles: ['R_SUPER'], organizationRole: 'member' })), {
      organizationId: 'org-1'
    });
  });

  it('creates owner filters and owner-only write scopes from the authenticated context', () => {
    assert.deepEqual(createOrganizationOwnerFilter(createContext()), { ownerUserId: 'u-1' });
    assert.deepEqual(createOrganizationOwnerFilter(createContext({ organizationRole: 'admin' })), {});
    assert.deepEqual(createOrganizationOwnerWriteScope(createContext({ organizationRole: 'admin' })), {
      organizationId: 'org-1',
      ownerUserId: 'u-1'
    });
  });
});

function createContext(input: Partial<RequestUserContext> = {}): RequestUserContext {
  return {
    userId: input.userId ?? 'u-1',
    userName: input.userName ?? 'Alice',
    roles: input.roles ?? ['R_USER'],
    organizationId: input.organizationId ?? 'org-1',
    organizationRole: input.organizationRole ?? 'member'
  };
}
