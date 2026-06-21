import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { crmPermissionCodes } from '@soybean/shared';
import type { PrismaService } from '../database/prisma.service';
import type { SystemLogService } from '../system-log/system-log.service';
import { SystemRoleService } from './system-role.service';

describe('SystemRoleService', () => {
  it('creates roles with normalized role permissions and records a business log', async () => {
    const roles: TestSystemRole[] = [];
    const logService = createLogServiceStub();
    const service = createService(createPrismaStub(roles), logService);

    const created = await service.create(
      {
        roleName: '销售主管',
        roleCode: 'R_SALES_MANAGER',
        roleDesc: '管理销售相关配置',
        permissions: ['crm:settings:assets:write'],
        status: 'enabled'
      },
      { userId: 'u-super', userName: 'Super', roles: ['R_SUPER'] }
    );

    assert.equal(created.roleCode, 'R_SALES_MANAGER');
    assert.deepEqual(created.permissions, ['crm:settings:assets:read', 'crm:settings:assets:write']);
    assert.equal(logService.records[0].action, 'create');
  });

  it('updates permissions on a role instead of on users', async () => {
    const roles = [
      createRole({
        id: 'role-admin',
        roleCode: 'R_ADMIN',
        permissions: ['crm:settings:assets:read']
      })
    ];
    const logService = createLogServiceStub();
    const service = createService(createPrismaStub(roles), logService);

    const updated = await service.updatePermissions(
      'role-admin',
      ['crm:settings:safety:write'],
      { userId: 'u-super', userName: 'Super', roles: ['R_SUPER'] }
    );

    assert.deepEqual(updated.permissions, ['crm:settings:safety:read', 'crm:settings:safety:write']);
    assert.deepEqual(roles[0].permissions, updated.permissions);
    assert.equal(logService.records[0].action, 'update-permissions');
    assert.deepEqual(logService.records[0].metadata.beforePermissions, ['crm:settings:assets:read']);
    assert.deepEqual(logService.records[0].metadata.afterPermissions, updated.permissions);
  });

  it('does not allow editing super administrator role permissions', async () => {
    const service = createService(createPrismaStub([createRole({ roleCode: 'R_SUPER' })]));

    await assert.rejects(
      () =>
        service.updatePermissions('role-1', ['crm:settings:assets:read'], {
          userId: 'u-super',
          userName: 'Super',
          roles: ['R_SUPER']
        }),
      /超级管理员角色默认拥有全部权限/
    );
  });

  it('rejects unknown permissions', async () => {
    const service = createService(createPrismaStub([]));

    await assert.rejects(
      () =>
        service.create(
          {
            roleName: 'Invalid',
            roleCode: 'R_INVALID',
            permissions: ['unknown:permission' as (typeof crmPermissionCodes)[number]]
          },
          { userId: 'u-super', userName: 'Super', roles: ['R_SUPER'] }
        ),
      /权限不存在/
    );
  });
});

function createService(prisma: ReturnType<typeof createPrismaStub>, logService = createLogServiceStub()) {
  return new SystemRoleService(prisma as unknown as PrismaService, logService as unknown as SystemLogService);
}

function createPrismaStub(roles: TestSystemRole[]) {
  const systemRole = {
    async findMany() {
      return roles;
    },
    async count() {
      return roles.length;
    },
    async findUnique(args: any) {
      return roles.find(role => role.id === args.where.id || role.roleCode === args.where.roleCode) || null;
    },
    async findFirst(args: any) {
      const roleCode = args.where.roleCode?.equals?.toLowerCase();
      const excludeId = args.where.id?.not;

      return (
        roles.find(role => {
          const matchesCode = roleCode ? role.roleCode.toLowerCase() === roleCode : true;
          const matchesExclude = excludeId ? role.id !== excludeId : true;

          return matchesCode && matchesExclude;
        }) || null
      );
    },
    async create(args: any) {
      const role = createRole(args.data);
      roles.push(role);
      return role;
    },
    async update(args: any) {
      const role = roles.find(item => item.id === args.where.id);

      if (!role) {
        throw new Error('role not found');
      }

      Object.assign(role, args.data, { updatedAt: new Date('2026-06-21T02:00:00.000Z') });
      return role;
    }
  };

  return { systemRole };
}

function createLogServiceStub() {
  return {
    records: [] as any[],
    async record(input: any) {
      this.records.push(input);
    }
  };
}

function createRole(input: Partial<TestSystemRole> = {}): TestSystemRole {
  const now = new Date('2026-06-21T01:00:00.000Z');

  return {
    id: input.id || 'role-1',
    roleName: input.roleName || '管理员',
    roleCode: input.roleCode || 'R_ADMIN',
    roleDesc: input.roleDesc ?? null,
    permissions: input.permissions || [],
    status: input.status || 'enabled',
    builtIn: input.builtIn ?? false,
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now
  };
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
