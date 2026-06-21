import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AuthService } from '../auth/auth.service';
import type { PrismaService } from '../database/prisma.service';
import type { SystemLogService } from '../system-log/system-log.service';
import { SystemUserService } from './system-user.service';

describe('SystemUserService', () => {
  it('lists database users with filters and frontend row fields', async () => {
    const users = [
      createUser({
        id: 'u-1',
        userName: 'Super',
        roles: ['R_SUPER'],
        permissions: ['crm:settings:assets:write'],
        status: 'enabled',
        companyName: 'Soybean',
        expireAt: new Date(Date.now() + 86_400_000)
      })
    ];
    const prisma = createPrismaStub(users);
    const service = createService(prisma);

    const result = await service.list({
      current: 2,
      size: 10,
      keyword: 'soy',
      role: 'R_SUPER',
      status: 'enabled',
      expirationStatus: 'active'
    });

    assert.equal(prisma.systemUser.lastFindManyArgs.skip, 10);
    assert.equal(prisma.systemUser.lastFindManyArgs.take, 10);
    assert.deepEqual(prisma.systemUser.lastFindManyArgs.orderBy, { createdAt: 'desc' });
    assert.equal(prisma.systemUser.lastFindManyArgs.where.roles.has, 'R_SUPER');
    assert.equal(prisma.systemUser.lastFindManyArgs.where.status, 'enabled');
    assert.equal(result.total, 1);
    assert.deepEqual(result.records[0], {
      id: 'u-1',
      userName: 'Super',
      nickName: null,
      phone: null,
      email: null,
      roles: ['R_SUPER'],
      permissions: [],
      status: 'enabled',
      organizationId: 'org-default',
      organizationName: '默认组织',
      organizationRole: 'admin',
      companyName: 'Soybean',
      expireAt: users[0].expireAt!.toISOString(),
      remark: null,
      lastLoginAt: null,
      lastLoginIp: null,
      lockedUntil: null,
      expired: false,
      locked: false,
      createdAt: users[0].createdAt.toISOString(),
      updatedAt: users[0].updatedAt.toISOString()
    });
  });

  it('creates a user with a temporary password and records a business log', async () => {
    const users: TestSystemUser[] = [];
    const prisma = createPrismaStub(users);
    const logService = createLogServiceStub();
    const service = createService(prisma, logService);

    const result = await service.create(
      {
        userName: 'Operator',
        roles: ['R_ADMIN'],
        status: 'enabled',
        companyName: ' Soybean '
      },
      { userId: 'u-super', userName: 'Super', roles: ['R_SUPER'] }
    );

    assert.equal(users.length, 1);
    assert.equal(users[0].userName, 'Operator');
    assert.equal(users[0].companyName, 'Soybean');
    assert.equal(users[0].organizationId, 'org-default');
    assert.equal(users[0].organizationRole, 'admin');
    assert.deepEqual(users[0].permissions, []);
    assert.equal(Boolean(users[0].passwordHash), true);
    assert.equal(Boolean(result.temporaryPassword), true);
    assert.equal(result.user.userName, 'Operator');
    assert.equal(result.user.organizationName, '默认组织');
    assert.equal(logService.records[0].module, 'system-user');
    assert.equal(logService.records[0].action, 'create');
  });

  it('filters users by organization id', async () => {
    const users = [
      createUser({ id: 'u-org-1', organizationId: 'org-1' }),
      createUser({ id: 'u-org-2', organizationId: 'org-2' })
    ];
    const prisma = createPrismaStub(users);
    const service = createService(prisma);

    await service.list({ current: 1, size: 10, organizationId: 'org-1' });

    assert.equal(prisma.systemUser.lastFindManyArgs.where.organizationId, 'org-1');
  });

  it('creates and updates users in an enabled organization', async () => {
    const users: TestSystemUser[] = [];
    const organizations = [
      createOrganization({ id: 'org-default', name: '默认组织' }),
      createOrganization({ id: 'org-sales', name: '销售部' })
    ];
    const service = createService(createPrismaStub(users, organizations));
    const operator = { userId: 'u-super', userName: 'Super', roles: ['R_SUPER'] };

    const created = await service.create(
      {
        userName: 'Sales',
        roles: ['R_USER'],
        organizationId: 'org-sales'
      },
      operator
    );
    const updated = await service.update(
      created.user.id,
      {
        organizationId: 'org-default'
      },
      operator
    );

    assert.equal(users[0].organizationId, 'org-default');
    assert.equal(created.user.organizationName, '销售部');
    assert.equal(updated.organizationName, '默认组织');
  });

  it('rejects assigning users to disabled organizations', async () => {
    const service = createService(
      createPrismaStub([], [createOrganization({ id: 'org-disabled', name: '停用组织', status: 'disabled' })])
    );

    await assert.rejects(
      () =>
        service.create(
          {
            userName: 'DisabledOrgUser',
            roles: ['R_USER'],
            organizationId: 'org-disabled'
          },
          { userId: 'u-super', userName: 'Super', roles: ['R_SUPER'] }
        ),
      /组织不存在或已禁用/
    );
  });

  it('does not persist user-level permissions from legacy inputs', async () => {
    const users: TestSystemUser[] = [];
    const service = createService(createPrismaStub(users));

    await service.create(
      {
        userName: 'Assets',
        roles: ['R_USER'],
        permissions: ['crm:settings:assets:write', 'crm:settings:rules:write']
      } as any,
      { userId: 'u-super', userName: 'Super', roles: ['R_SUPER'] }
    );

    assert.deepEqual(users[0].permissions, []);

    const updated = await service.update(
      users[0].id,
      {
        permissions: ['crm:settings:safety:read']
      } as any,
      { userId: 'u-super', userName: 'Super', roles: ['R_SUPER'] }
    );

    assert.deepEqual(users[0].permissions, []);
    assert.deepEqual(updated.permissions, []);
  });

  it('rejects blank user names after trimming', async () => {
    const service = createService(createPrismaStub([]));

    await assert.rejects(
      () =>
        service.create(
          {
            userName: '   ',
            roles: ['R_USER']
          },
          { userId: 'u-super', userName: 'Super', roles: ['R_SUPER'] }
        ),
      /用户名长度需为 2 到 50 个字符/
    );
  });

  it('rejects disabling the current operator from profile update', async () => {
    const users = [
      createUser({
        id: 'u-super',
        userName: 'Super',
        roles: ['R_SUPER']
      }),
      createUser({
        id: 'u-admin',
        userName: 'Admin',
        roles: ['R_ADMIN']
      })
    ];
    const service = createService(createPrismaStub(users));

    await assert.rejects(
      () =>
        service.update(
          'u-super',
          {
            status: 'disabled'
          },
          { userId: 'u-super', userName: 'Super', roles: ['R_SUPER'] }
        ),
      /不能禁用当前登录用户/
    );
  });

  it('rejects removing the operator own super role', async () => {
    const users = [
      createUser({
        id: 'u-super',
        userName: 'Super',
        roles: ['R_SUPER']
      }),
      createUser({
        id: 'u-admin',
        userName: 'Admin',
        roles: ['R_ADMIN']
      })
    ];
    const service = createService(createPrismaStub(users));

    await assert.rejects(
      () =>
        service.update('u-super', { roles: ['R_ADMIN'] }, { userId: 'u-super', userName: 'Super', roles: ['R_SUPER'] }),
      /不能移除自己的超级管理员角色/
    );
  });

  it('keeps at least one active super administrator', async () => {
    const users = [
      createUser({
        id: 'u-super',
        userName: 'Super',
        roles: ['R_SUPER']
      })
    ];
    const service = createService(createPrismaStub(users));

    await assert.rejects(
      () => service.updateStatus('u-super', 'disabled', { userId: 'u-root', userName: 'Root', roles: ['R_SUPER'] }),
      /系统至少需要保留一个可用的超级管理员/
    );
  });

  it('revokes tokens when disabling a user or resetting password', async () => {
    const users = [
      createUser({
        id: 'u-super',
        userName: 'Super',
        roles: ['R_SUPER']
      }),
      createUser({
        id: 'u-admin',
        userName: 'Admin',
        roles: ['R_ADMIN'],
        lockedUntil: new Date('2026-06-18T03:00:00.000Z'),
        failedLoginCount: 5
      })
    ];
    const authService = createAuthServiceStub();
    const service = createService(createPrismaStub(users), createLogServiceStub(), authService);

    await service.updateStatus('u-admin', 'disabled', { userId: 'u-super', userName: 'Super', roles: ['R_SUPER'] });
    const resetResult = await service.resetPassword('u-admin', {
      userId: 'u-super',
      userName: 'Super',
      roles: ['R_SUPER']
    });

    assert.deepEqual(authService.revokedUserIds, ['u-admin', 'u-admin']);
    assert.equal(users[1].lockedUntil, null);
    assert.equal(users[1].failedLoginCount, 0);
    assert.equal(Boolean(resetResult.temporaryPassword), true);
  });
});

function createService(
  prisma: ReturnType<typeof createPrismaStub>,
  logService = createLogServiceStub(),
  authService = createAuthServiceStub()
) {
  return new SystemUserService(
    prisma as unknown as PrismaService,
    authService,
    logService as unknown as SystemLogService
  );
}

function createPrismaStub(users: TestSystemUser[], organizations: TestOrganization[] = [createOrganization()]) {
  const systemUser = {
    lastFindManyArgs: null as any,
    async findMany(args: any) {
      systemUser.lastFindManyArgs = args;
      return users;
    },
    async count(args?: any) {
      if (!args?.where) {
        return users.length;
      }

      return users.filter(user => matchesWhere(user, args.where)).length;
    },
    async findUnique(args: any) {
      return users.find(user => user.id === args.where.id || user.userName === args.where.userName) || null;
    },
    async findFirst(args: any) {
      const userName = args.where.userName?.equals?.toLowerCase();
      const excludeId = args.where.id?.not;

      return (
        users.find(user => {
          const matchesName = userName ? user.userName.toLowerCase() === userName : true;
          const matchesExclude = excludeId ? user.id !== excludeId : true;

          return matchesName && matchesExclude;
        }) || null
      );
    },
    async create(args: any) {
      const user = createUser(args.data);
      attachOrganization(user, organizations);
      users.push(user);
      return user;
    },
    async update(args: any) {
      const user = users.find(item => item.id === args.where.id);

      if (!user) {
        throw new Error('user not found');
      }

      Object.assign(user, args.data, { updatedAt: new Date('2026-06-18T02:00:00.000Z') });
      attachOrganization(user, organizations);
      return user;
    }
  };

  const systemRole = {
    async count(args: any) {
      const roleCodes: string[] = args.where.roleCode.in;
      const enabledRoles = new Set(['R_SUPER', 'R_ADMIN', 'R_USER', 'R_CUSTOM']);

      return roleCodes.filter(role => enabledRoles.has(role)).length;
    }
  };

  const organization = {
    async findFirst(args: any) {
      const id = args.where.id;
      const status = args.where.status;

      return organizations.find(item => item.id === id && (!status || item.status === status)) || null;
    }
  };

  return { systemUser, systemRole, organization };
}

function matchesWhere(user: TestSystemUser, where: any) {
  if (where.id?.not && user.id === where.id.not) {
    return false;
  }

  if (where.status && user.status !== where.status) {
    return false;
  }

  if (where.organizationId && user.organizationId !== where.organizationId) {
    return false;
  }

  if (where.roles?.has && !user.roles.includes(where.roles.has)) {
    return false;
  }

  if (where.OR) {
    return where.OR.some((condition: any) => {
      if ('expireAt' in condition && condition.expireAt === null) {
        return user.expireAt === null;
      }

      if (condition.expireAt?.gt) {
        return Boolean(user.expireAt && user.expireAt > condition.expireAt.gt);
      }

      return false;
    });
  }

  return true;
}

function attachOrganization(user: TestSystemUser, organizations: TestOrganization[]) {
  const organization = organizations.find(item => item.id === user.organizationId) || organizations[0];

  user.organization = organization;
}

function createLogServiceStub() {
  return {
    records: [] as any[],
    async record(input: any) {
      this.records.push(input);
    }
  };
}

function createAuthServiceStub(): AuthService & { revokedUserIds: string[] } {
  const revokedUserIds: string[] = [];

  return {
    revokedUserIds,
    revokeUserTokens(userId: string) {
      revokedUserIds.push(userId);
    }
  } as unknown as AuthService & { revokedUserIds: string[] };
}

function createUser(input: Partial<TestSystemUser> = {}): TestSystemUser {
  const now = new Date('2026-06-18T01:00:00.000Z');

  return {
    id: input.id || `u-${Math.random().toString(36).slice(2)}`,
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

function createOrganization(input: Partial<TestOrganization> = {}): TestOrganization {
  const now = new Date('2026-06-18T01:00:00.000Z');

  return {
    id: input.id || 'org-default',
    name: input.name || '默认组织',
    status: input.status || 'enabled',
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

interface TestOrganization {
  id: string;
  name: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}
