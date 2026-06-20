import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { UnauthorizedException } from '@nestjs/common';
import { requireRequestUserContext, toRequestUserContext } from './request-context';

describe('request-context', () => {
  it('converts an authenticated user snapshot to a service context', () => {
    const context = toRequestUserContext({
      userId: 'u-1',
      userName: 'Alice',
      roles: ['R_USER'],
      buttons: ['BASIC'],
      organizationId: 'org-1',
      organizationName: 'Org',
      organizationRole: 'member'
    });

    assert.deepEqual(context, {
      userId: 'u-1',
      userName: 'Alice',
      roles: ['R_USER'],
      organizationId: 'org-1',
      organizationRole: 'member'
    });
  });

  it('throws a unified unauthorized exception when context is missing', () => {
    assert.throws(() => requireRequestUserContext(null), UnauthorizedException);
  });
});
