import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ForbiddenException, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { AuthGuard } from './auth.guard';
import {
  AUTH_POLICY_KEY,
  IS_PUBLIC_KEY,
  ROLE_DENIED_MESSAGE_KEY,
  ROLES_KEY,
  type AuthPolicyMetadata
} from './auth.decorators';
import type { AuthService } from './auth.service';
import { RolesGuard } from './roles.guard';

describe('AuthGuard', () => {
  it('skips public routes', async () => {
    const request = createRequest();
    const guard = new AuthGuard(createReflector({ isPublic: true }), createAuthService(null));

    assert.equal(await guard.canActivate(createExecutionContext(request)), true);
  });

  it('attaches the bearer token user to the request', async () => {
    const request = createRequest('Bearer access-token');
    const guard = new AuthGuard(createReflector({}), createAuthService(createUser()));

    assert.equal(await guard.canActivate(createExecutionContext(request)), true);
    assert.deepEqual(request.user, createUser());
  });

  it('rejects missing or invalid tokens', async () => {
    const guard = new AuthGuard(createReflector({}), createAuthService(null));

    await assert.rejects(() => guard.canActivate(createExecutionContext(createRequest())), UnauthorizedException);
  });
});

describe('RolesGuard', () => {
  it('allows routes without role metadata', () => {
    const guard = new RolesGuard(createReflector({}));
    const request = createRequest();
    request.user = createUser(['R_USER']);

    assert.equal(guard.canActivate(createExecutionContext(request)), true);
  });

  it('allows users with one required role', () => {
    const guard = new RolesGuard(createReflector({ policy: { anyRoles: ['R_SUPER'] } }));
    const request = createRequest();
    request.user = createUser(['R_SUPER']);

    assert.equal(guard.canActivate(createExecutionContext(request)), true);
  });

  it('allows users that match an organization-role policy', () => {
    const guard = new RolesGuard(createReflector({ policy: { anyOrganizationRoles: ['admin'] } }));
    const request = createRequest();
    request.user = createUser(['R_USER'], 'admin');

    assert.equal(guard.canActivate(createExecutionContext(request)), true);
  });

  it('allows users that match all required role codes', () => {
    const guard = new RolesGuard(createReflector({ policy: { allRoles: ['R_ADMIN', 'R_AUDITOR'] } }));
    const request = createRequest();
    request.user = createUser(['R_ADMIN', 'R_AUDITOR']);

    assert.equal(guard.canActivate(createExecutionContext(request)), true);
  });

  it('keeps legacy Roles metadata compatible', () => {
    const guard = new RolesGuard(createReflector({ roles: ['R_SUPER'] }));
    const request = createRequest();
    request.user = createUser(['R_SUPER']);

    assert.equal(guard.canActivate(createExecutionContext(request)), true);
  });

  it('rejects users without required roles', () => {
    const guard = new RolesGuard(createReflector({ policy: { anyRoles: ['R_SUPER'] } }));
    const request = createRequest();
    request.user = createUser(['R_ADMIN']);

    assert.throws(() => guard.canActivate(createExecutionContext(request)), ForbiddenException);
  });

  it('rejects users that only match part of an all-roles policy', () => {
    const guard = new RolesGuard(createReflector({ policy: { allRoles: ['R_ADMIN', 'R_AUDITOR'] } }));
    const request = createRequest();
    request.user = createUser(['R_ADMIN']);

    assert.throws(() => guard.canActivate(createExecutionContext(request)), ForbiddenException);
  });

  it('allows policy metadata with only a message so helpers can be introduced incrementally', () => {
    const guard = new RolesGuard(createReflector({ policy: { deniedMessage: '暂不限制' } }));
    const request = createRequest();
    request.user = createUser(['R_USER']);

    assert.equal(guard.canActivate(createExecutionContext(request)), true);
  });

  it('uses route-specific denial messages when provided', () => {
    const guard = new RolesGuard(
      createReflector({ policy: { anyRoles: ['R_SUPER'], deniedMessage: '无权访问用户管理' } })
    );
    const request = createRequest();
    request.user = createUser(['R_ADMIN']);

    assert.throws(() => guard.canActivate(createExecutionContext(request)), {
      message: '无权访问用户管理'
    });
  });
});

function createReflector(options: {
  isPublic?: boolean;
  policy?: AuthPolicyMetadata;
  roles?: string[];
  roleDeniedMessage?: string;
}): Reflector {
  return {
    getAllAndOverride(key: string) {
      if (key === IS_PUBLIC_KEY) {
        return options.isPublic;
      }

      if (key === ROLES_KEY) {
        return options.roles;
      }

      if (key === AUTH_POLICY_KEY) {
        return options.policy;
      }

      if (key === ROLE_DENIED_MESSAGE_KEY) {
        return options.roleDeniedMessage;
      }

      return undefined;
    }
  } as unknown as Reflector;
}

function createAuthService(user: ReturnType<typeof createUser> | null): AuthService {
  return {
    async getUserByAccessToken(token: string) {
      return token === 'access-token' ? user : null;
    }
  } as unknown as AuthService;
}

function createExecutionContext(request: TestRequest): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => request
    })
  } as unknown as ExecutionContext;
}

function createRequest(authorization?: string): TestRequest {
  return {
    headers: {
      authorization
    }
  };
}

function createUser(roles = ['R_ADMIN'], organizationRole: 'admin' | 'member' = 'member') {
  return {
    userId: 'u-1',
    userName: 'tester',
    nickName: null,
    phone: null,
    email: null,
    roles,
    buttons: [],
    organizationId: 'org-default',
    organizationName: '默认组织',
    organizationRole
  };
}

interface TestRequest {
  headers: Record<string, string | undefined>;
  user?: ReturnType<typeof createUser>;
}
