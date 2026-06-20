import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ForbiddenException, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { AuthGuard } from './auth.guard';
import { IS_PUBLIC_KEY, ROLES_KEY } from './auth.decorators';
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
  it('allows users with one required role', () => {
    const guard = new RolesGuard(createReflector({ roles: ['R_SUPER'] }));
    const request = createRequest();
    request.user = createUser(['R_SUPER']);

    assert.equal(guard.canActivate(createExecutionContext(request)), true);
  });

  it('rejects users without required roles', () => {
    const guard = new RolesGuard(createReflector({ roles: ['R_SUPER'] }));
    const request = createRequest();
    request.user = createUser(['R_ADMIN']);

    assert.throws(() => guard.canActivate(createExecutionContext(request)), ForbiddenException);
  });
});

function createReflector(options: { isPublic?: boolean; roles?: string[] }): Reflector {
  return {
    getAllAndOverride(key: string) {
      if (key === IS_PUBLIC_KEY) {
        return options.isPublic;
      }

      if (key === ROLES_KEY) {
        return options.roles;
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

function createUser(roles = ['R_ADMIN']) {
  return {
    userId: 'u-1',
    userName: 'tester',
    roles,
    buttons: [],
    organizationId: 'org-default',
    organizationName: '默认组织',
    organizationRole: 'member' as const
  };
}

interface TestRequest {
  headers: Record<string, string | undefined>;
  user?: ReturnType<typeof createUser>;
}
