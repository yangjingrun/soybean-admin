import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { UnauthorizedException } from '@nestjs/common';
import { requireRequestUserContext, resolveRequestUserDisplayName, toRequestUserContext } from './request-context';

describe('request-context', () => {
  it('converts an authenticated user snapshot to a service context', () => {
    const context = toRequestUserContext({
      userId: 'u-1',
      userName: 'Alice',
      nickName: 'Alice Chen',
      phone: null,
      email: null,
      roles: ['R_USER'],
      buttons: ['BASIC'],
      organizationId: 'org-1',
      organizationName: 'Org',
      organizationRole: 'member'
    });

    assert.deepEqual(context, {
      userId: 'u-1',
      userName: 'Alice',
      nickName: 'Alice Chen',
      roles: ['R_USER'],
      buttons: ['BASIC'],
      organizationId: 'org-1',
      organizationRole: 'member'
    });
  });

  it('resolves display name from configured nickname before login name', () => {
    assert.equal(resolveRequestUserDisplayName({ userName: 'User', nickName: 'Alice Chen' }), 'Alice Chen');
    assert.equal(resolveRequestUserDisplayName({ userName: 'User', nickName: null }), 'User');
  });

  it('throws a unified unauthorized exception when context is missing', () => {
    assert.throws(() => requireRequestUserContext(null), UnauthorizedException);
  });
});
