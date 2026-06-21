import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { crmPermissionCodes } from '@soybean/shared';
import type { PrismaService } from '../database/prisma.service';
import type { AppConfigService } from '../app-config/app-config.service';
import type { RedisService } from '../redis/redis.service';
import { AuthService } from './auth.service';
import { hashPassword } from './password';

describe('AuthService', () => {
  it('logs in enabled database users and resolves issued access tokens', async () => {
    const password = await hashPassword('123456');
    const user = createUser({ passwordHash: password.hash, passwordSalt: password.salt });
    const service = createService([user]);

    const token = await service.login('super', '123456', undefined, undefined, '127.0.0.1');

    assert.equal(Boolean(token?.token), true);
    assert.deepEqual(await service.getUserByAccessToken(token!.token), {
      userId: '1',
      userName: 'Super',
      roles: ['R_SUPER'],
      buttons: [...crmPermissionCodes],
      organizationId: 'org-default',
      organizationName: '默认组织',
      organizationRole: 'admin'
    });
    assert.equal(user.failedLoginCount, 0);
    assert.equal(user.lastLoginIp, '127.0.0.1');
  });

  it('persists issued sessions so access tokens survive service restart', async () => {
    const password = await hashPassword('123456');
    const user = createUser({ passwordHash: password.hash, passwordSalt: password.salt });
    const store = createPrismaStore([user]);
    const service = createServiceFromStore(store);

    const token = await service.login('Super', '123456', undefined, undefined, '127.0.0.1', 'Chrome');
    const restartedService = createServiceFromStore(store);

    assert.equal(store.sessions.length, 1);
    assert.equal(store.sessions[0].userId, user.id);
    assert.equal(store.sessions[0].loginIp, '127.0.0.1');
    assert.equal(store.sessions[0].userAgent, 'Chrome');
    assert.deepEqual(await restartedService.getUserByAccessToken(token!.token), {
      userId: '1',
      userName: 'Super',
      roles: ['R_SUPER'],
      buttons: [...crmPermissionCodes],
      organizationId: 'org-default',
      organizationName: '默认组织',
      organizationRole: 'admin'
    });
  });

  it('reuses the fixed development session when the dev account logs in repeatedly', async () => {
    const password = await hashPassword('123456');
    const user = createUser({ id: '4', passwordHash: password.hash, passwordSalt: password.salt });
    const store = createPrismaStore([user]);
    const service = createServiceFromStore(store, createAppConfigService({ authDevFixedTokenEnabled: true }));

    const firstToken = await service.login('Super', '123456');
    const secondToken = await service.login('Super', '123456');

    assert.deepEqual(secondToken, firstToken);
    assert.equal(store.sessions.length, 1);
    assert.equal(store.sessions[0].revokedAt, null);
    assert.equal(Boolean(await service.getUserByAccessToken(secondToken!.token)), true);
  });

  it('rotates refresh tokens and revokes the old session token', async () => {
    const password = await hashPassword('123456');
    const user = createUser({ passwordHash: password.hash, passwordSalt: password.salt });
    const store = createPrismaStore([user]);
    const service = createServiceFromStore(store);
    const firstToken = await service.login('Super', '123456');

    const rotatedToken = await service.refresh(firstToken!.refreshToken);

    assert.equal(Boolean(rotatedToken?.token), true);
    assert.equal(await service.refresh(firstToken!.refreshToken), null);
    assert.equal(await service.getUserByAccessToken(firstToken!.token), null);
    assert.equal(Boolean(await service.getUserByAccessToken(rotatedToken!.token)), true);
  });

  it('returns permissions from enabled roles for non-super users', async () => {
    const password = await hashPassword('123456');
    const user = createUser({
      userName: 'Operator',
      roles: ['R_USER'],
      permissions: [],
      passwordHash: password.hash,
      passwordSalt: password.salt
    });
    const service = createService(
      [user],
      [
        createRole({
          roleCode: 'R_USER',
          permissions: ['crm:settings:assets:write']
        })
      ]
    );

    const token = await service.login('Operator', '123456');

    assert.deepEqual((await service.getUserByAccessToken(token!.token))?.buttons, [
      'crm:settings:assets:read',
      'crm:settings:assets:write'
    ]);
  });

  it('ignores user-level permissions when resolving runtime buttons', async () => {
    const password = await hashPassword('123456');
    const user = createUser({
      userName: 'Safety',
      roles: ['R_USER'],
      permissions: ['crm:settings:safety:write'],
      passwordHash: password.hash,
      passwordSalt: password.salt
    });
    const service = createService([user], [createRole({ roleCode: 'R_USER', permissions: [] })]);

    const token = await service.login('Safety', '123456');

    assert.deepEqual((await service.getUserByAccessToken(token!.token))?.buttons, []);
  });

  it('rejects disabled, expired and locked users', async () => {
    const password = await hashPassword('123456');
    const baseUser = { passwordHash: password.hash, passwordSalt: password.salt };
    const service = createService([
      createUser({ id: 'disabled', userName: 'Disabled', status: 'disabled', ...baseUser }),
      createUser({ id: 'expired', userName: 'Expired', expireAt: new Date(Date.now() - 1000), ...baseUser }),
      createUser({ id: 'locked', userName: 'Locked', lockedUntil: new Date(Date.now() + 60_000), ...baseUser })
    ]);

    assert.equal(await service.login('Disabled', '123456'), null);
    assert.equal(await service.login('Expired', '123456'), null);
    assert.equal(await service.login('Locked', '123456'), null);
  });

  it('locks users for fifteen minutes after five failed password attempts', async () => {
    const password = await hashPassword('123456');
    const user = createUser({ passwordHash: password.hash, passwordSalt: password.salt });
    const service = createService([user]);

    for (let index = 0; index < 5; index += 1) {
      assert.equal(await service.login('Super', 'bad-password'), null);
    }

    assert.equal(user.failedLoginCount, 5);
    assert.equal(Boolean(user.lockedUntil && user.lockedUntil.getTime() > Date.now()), true);
    assert.equal(await service.login('Super', '123456'), null);
  });

  it('revokes all issued tokens for one user', async () => {
    const password = await hashPassword('123456');
    const user = createUser({ passwordHash: password.hash, passwordSalt: password.salt });
    const service = createService([user]);
    const firstToken = await service.login('Super', '123456');
    const secondToken = await service.login('Super', '123456');

    await service.revokeUserTokens(user.id);

    assert.equal(await service.getUserByAccessToken(firstToken!.token), null);
    assert.equal(await service.getUserByAccessToken(secondToken!.token), null);
  });

  it('changes password and revokes other sessions only', async () => {
    const password = await hashPassword('123456');
    const user = createUser({ passwordHash: password.hash, passwordSalt: password.salt });
    const service = createService([user]);
    const currentToken = await service.login('Super', '123456');
    const otherToken = await service.login('Super', '123456');
    user.failedLoginCount = 3;
    user.lockedUntil = new Date();

    await service.changePassword(user.id, '123456', 'abc123', currentToken!.token);

    assert.equal(Boolean(await service.getUserByAccessToken(currentToken!.token)), true);
    assert.equal(await service.getUserByAccessToken(otherToken!.token), null);
    assert.equal(user.failedLoginCount, 0);
    assert.equal(user.lockedUntil, null);
    assert.equal(await service.login('Super', '123456'), null);
    assert.equal(Boolean(await service.login('Super', 'abc123')), true);
  });

  it('rejects changing password when old password is wrong', async () => {
    const password = await hashPassword('123456');
    const user = createUser({ passwordHash: password.hash, passwordSalt: password.salt });
    const service = createService([user]);

    await assert.rejects(() => service.changePassword(user.id, 'badpwd', 'abc123', ''), /原密码错误/);
  });
});

function createService(users: TestSystemUser[], roles?: TestSystemRole[]) {
  return createServiceFromStore(createPrismaStore(users, roles));
}

function createServiceFromStore(store: ReturnType<typeof createPrismaStore>, appConfigService?: AppConfigService) {
  return new AuthService({} as unknown as RedisService, store.prisma, appConfigService);
}

function createPrismaStore(users: TestSystemUser[], roles: TestSystemRole[] = createDefaultRoles()) {
  const sessions: TestAuthSession[] = [];
  const prisma = {
    systemUser: {
      findFirst({ where }: { where: { userName: { equals: string } } }) {
        const userName = where.userName.equals.toLowerCase();

        return Promise.resolve(users.find(user => user.userName.toLowerCase() === userName) || null);
      },
      findUnique({ where }: { where: { id: string } }) {
        return Promise.resolve(users.find(user => user.id === where.id) || null);
      },
      update({ where, data }: { where: { id: string }; data: Partial<TestSystemUser> }) {
        const user = users.find(item => item.id === where.id);

        if (!user) {
          throw new Error('user not found');
        }

        Object.assign(user, data);

        return Promise.resolve(user);
      }
    },
    systemRole: {
      findMany({ where }: { where: { roleCode: { in: string[] }; status: string } }) {
        return Promise.resolve(
          roles.filter(role => where.roleCode.in.includes(role.roleCode) && role.status === where.status)
        );
      }
    },
    authSession: {
      create({ data }: { data: TestAuthSession }) {
        assertUniqueSessionToken(sessions, data);
        sessions.push({ ...data });

        return Promise.resolve(data);
      },
      upsert({
        where,
        update,
        create
      }: {
        where: { accessTokenHash: string };
        update: TestAuthSession;
        create: TestAuthSession;
      }) {
        const session = sessions.find(item => item.accessTokenHash === where.accessTokenHash);

        if (session) {
          Object.assign(session, update);

          return Promise.resolve(session);
        }

        assertUniqueSessionToken(sessions, create);
        sessions.push({ ...create });

        return Promise.resolve(create);
      },
      findFirst({ where }: { where: { accessTokenHash?: string; refreshTokenHash?: string; revokedAt: null } }) {
        const session =
          sessions.find(item => {
            if (item.revokedAt !== null) {
              return false;
            }

            return where.accessTokenHash
              ? item.accessTokenHash === where.accessTokenHash
              : item.refreshTokenHash === where.refreshTokenHash;
          }) || null;

        return Promise.resolve(session ? { ...session, user: users.find(user => user.id === session.userId) } : null);
      },
      update({ where, data }: { where: { id: string }; data: Partial<TestAuthSession> }) {
        const session = sessions.find(item => item.id === where.id);

        if (!session) {
          throw new Error('session not found');
        }

        Object.assign(session, data);

        return Promise.resolve(session);
      },
      updateMany({
        where,
        data
      }: {
        where: {
          userId?: string;
          id?: string;
          revokedAt?: Date | null;
          accessTokenHash?: { not: string };
        };
        data: Partial<TestAuthSession>;
      }) {
        const matchedSessions = sessions.filter(session => {
          if (where.userId && session.userId !== where.userId) {
            return false;
          }

          if (where.id && session.id !== where.id) {
            return false;
          }

          if (where.accessTokenHash?.not && session.accessTokenHash === where.accessTokenHash.not) {
            return false;
          }

          if ('revokedAt' in where && session.revokedAt !== where.revokedAt) {
            return false;
          }

          return true;
        });

        matchedSessions.forEach(session => Object.assign(session, data));

        return Promise.resolve({ count: matchedSessions.length });
      }
    }
  } as unknown as PrismaService;

  return { prisma, sessions };
}

function assertUniqueSessionToken(sessions: TestAuthSession[], data: TestAuthSession) {
  const duplicated = sessions.some(
    session => session.accessTokenHash === data.accessTokenHash || session.refreshTokenHash === data.refreshTokenHash
  );

  if (duplicated) {
    throw new Error('Unique constraint failed on the fields: accessTokenHash or refreshTokenHash');
  }
}

function createAppConfigService(overrides: Partial<AppConfigService['config']>): AppConfigService {
  return {
    config: {
      nodeEnv: 'development',
      isProduction: false,
      serverRuntimeRole: 'all',
      port: 9528,
      serverCorsOrigins: null,
      databaseUrl: undefined,
      redisUrl: 'redis://127.0.0.1:6379',
      aiConfigSecretEncryptionKey: undefined,
      authAccessTokenTtlSeconds: 7200,
      authRefreshTokenTtlSeconds: 1209600,
      authDevFixedTokenEnabled: false,
      crmEnableMockEndpoints: false,
      crmGmailIntegrationEnv: {},
      ...overrides
    }
  } as AppConfigService;
}

function createUser(input: Partial<TestSystemUser> = {}): TestSystemUser {
  const now = new Date();

  return {
    id: input.id || '1',
    userName: input.userName || 'Super',
    nickName: input.nickName ?? null,
    phone: input.phone ?? null,
    email: input.email ?? null,
    roles: input.roles || ['R_SUPER'],
    permissions: input.permissions || [],
    status: input.status || 'enabled',
    organizationId: input.organizationId || 'org-default',
    organizationRole: input.organizationRole || 'admin',
    organization: input.organization || {
      id: input.organizationId || 'org-default',
      name: '默认组织',
      status: 'enabled',
      createdAt: now,
      updatedAt: now
    },
    companyName: input.companyName ?? null,
    expireAt: input.expireAt ?? null,
    remark: input.remark ?? null,
    passwordHash: input.passwordHash || '',
    passwordSalt: input.passwordSalt || '',
    lastLoginAt: input.lastLoginAt ?? null,
    lastLoginIp: input.lastLoginIp ?? null,
    failedLoginCount: input.failedLoginCount ?? 0,
    lockedUntil: input.lockedUntil ?? null,
    passwordResetAt: input.passwordResetAt ?? null,
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now
  };
}

function createDefaultRoles(): TestSystemRole[] {
  return [
    createRole({ roleCode: 'R_SUPER', permissions: [...crmPermissionCodes] }),
    createRole({ roleCode: 'R_ADMIN', permissions: [] }),
    createRole({ roleCode: 'R_USER', permissions: [] })
  ];
}

function createRole(input: Partial<TestSystemRole> = {}): TestSystemRole {
  const now = new Date();

  return {
    id: input.id || `role-${input.roleCode || 'R_USER'}`,
    roleName: input.roleName || input.roleCode || 'R_USER',
    roleCode: input.roleCode || 'R_USER',
    roleDesc: input.roleDesc ?? null,
    permissions: input.permissions || [],
    status: input.status || 'enabled',
    builtIn: input.builtIn ?? false,
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now
  };
}

interface TestSystemUser {
  id: string;
  userName: string;
  nickName: string | null;
  phone: string | null;
  email: string | null;
  roles: string[];
  permissions: string[];
  status: string;
  organizationId: string;
  organizationRole: string;
  organization: {
    id: string;
    name: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  };
  companyName: string | null;
  expireAt: Date | null;
  remark: string | null;
  passwordHash: string;
  passwordSalt: string;
  lastLoginAt: Date | null;
  lastLoginIp: string | null;
  failedLoginCount: number;
  lockedUntil: Date | null;
  passwordResetAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface TestSystemRole {
  id: string;
  roleName: string;
  roleCode: string;
  roleDesc: string | null;
  permissions: string[];
  status: string;
  builtIn: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface TestAuthSession {
  id: string;
  userId: string;
  accessTokenHash: string;
  refreshTokenHash: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
  revokedAt: Date | null;
  loginIp: string | null;
  userAgent: string | null;
  lastUsedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
