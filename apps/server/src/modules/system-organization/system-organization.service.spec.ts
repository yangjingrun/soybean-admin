import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { PrismaService } from '../database/prisma.service';
import type { SystemLogService } from '../system-log/system-log.service';
import { SystemOrganizationService } from './system-organization.service';

describe('SystemOrganizationService', () => {
  it('lists organizations with pagination filters and user counters', async () => {
    const organizations = [
      createOrganization({ id: 'org-1', name: 'Alpha', status: 'enabled' }),
      createOrganization({ id: 'org-2', name: 'Beta', status: 'disabled' })
    ];
    const users = [
      createUser({ organizationId: 'org-1', organizationRole: 'admin' }),
      createUser({ organizationId: 'org-1', organizationRole: 'member' }),
      createUser({ organizationId: 'org-2', organizationRole: 'member' })
    ];
    const prisma = createPrismaStub(organizations, users);
    const service = createService(prisma);

    const result = await service.list({ current: 1, size: 10, keyword: 'a', status: 'enabled' });

    assert.deepEqual(prisma.organization.lastFindManyArgs.where, {
      name: { contains: 'a', mode: 'insensitive' },
      status: 'enabled'
    });
    assert.equal(result.total, 1);
    assert.deepEqual(result.records[0], {
      id: 'org-1',
      name: 'Alpha',
      status: 'enabled',
      userCount: 2,
      adminCount: 1,
      createdAt: organizations[0].createdAt.toISOString(),
      updatedAt: organizations[0].updatedAt.toISOString()
    });
  });

  it('returns enabled organizations for user assignment controls', async () => {
    const service = createService(
      createPrismaStub([
        createOrganization({ id: 'org-enabled', name: 'Enabled', status: 'enabled' }),
        createOrganization({ id: 'org-disabled', name: 'Disabled', status: 'disabled' })
      ])
    );

    const result = await service.listEnabled();

    assert.deepEqual(result, [{ id: 'org-enabled', name: 'Enabled' }]);
  });

  it('creates, updates and toggles organizations with business logs', async () => {
    const organizations: TestOrganization[] = [];
    const prisma = createPrismaStub(organizations);
    const logService = createLogServiceStub();
    const service = createService(prisma, logService);
    const operator = { userId: 'u-super', userName: 'Super', roles: ['R_SUPER'] };

    const created = await service.create({ name: ' AI外贸管理系统 ', status: 'enabled' }, operator);
    const updated = await service.update(created.id, { name: 'AI外贸管理系统 Inc.' }, operator);
    const disabled = await service.updateStatus(created.id, 'disabled', operator);

    assert.equal(organizations[0].name, 'AI外贸管理系统 Inc.');
    assert.equal(updated.name, 'AI外贸管理系统 Inc.');
    assert.equal(disabled.status, 'disabled');
    assert.deepEqual(logService.records.map(record => record.action), ['create', 'update', 'disable']);
  });

  it('rejects blank or duplicated organization names', async () => {
    const service = createService(createPrismaStub([createOrganization({ name: 'Alpha' })]));

    await assert.rejects(
      () => service.create({ name: '   ' }, { userId: 'u-super', userName: 'Super', roles: ['R_SUPER'] }),
      /组织名称不能为空/
    );
    await assert.rejects(
      () => service.create({ name: 'alpha' }, { userId: 'u-super', userName: 'Super', roles: ['R_SUPER'] }),
      /组织名称已存在/
    );
  });
});

function createService(prisma: ReturnType<typeof createPrismaStub>, logService = createLogServiceStub()) {
  return new SystemOrganizationService(
    prisma as unknown as PrismaService,
    logService as unknown as SystemLogService
  );
}

function createPrismaStub(organizations: TestOrganization[], users: TestUser[] = []) {
  const organization = {
    lastFindManyArgs: null as any,
    async findMany(args: any) {
      organization.lastFindManyArgs = args;

      return organizations.filter(item => matchesOrganizationWhere(item, args.where));
    },
    async count(args: any) {
      return organizations.filter(item => matchesOrganizationWhere(item, args.where)).length;
    },
    async findUnique(args: any) {
      return organizations.find(item => item.id === args.where.id) || null;
    },
    async findFirst(args: any) {
      const name = args.where.name?.equals?.toLowerCase();
      const excludeId = args.where.id?.not;

      return (
        organizations.find(item => item.name.toLowerCase() === name && (!excludeId || item.id !== excludeId)) || null
      );
    },
    async create(args: any) {
      const record = createOrganization(args.data);
      organizations.push(record);

      return record;
    },
    async update(args: any) {
      const record = organizations.find(item => item.id === args.where.id);

      if (!record) {
        throw new Error('organization not found');
      }

      Object.assign(record, args.data, { updatedAt: new Date('2026-06-21T02:00:00.000Z') });

      return record;
    }
  };

  const systemUser = {
    async groupBy(args: any) {
      const filtered = users.filter(user => {
        if (args.where.organizationId?.in && !args.where.organizationId.in.includes(user.organizationId)) {
          return false;
        }

        if (args.where.organizationRole && user.organizationRole !== args.where.organizationRole) {
          return false;
        }

        return true;
      });

      return Array.from(new Set(filtered.map(user => user.organizationId))).map(organizationId => ({
        organizationId,
        _count: {
          _all: filtered.filter(user => user.organizationId === organizationId).length
        }
      }));
    }
  };

  return { organization, systemUser };
}

function matchesOrganizationWhere(record: TestOrganization, where: any = {}) {
  if (where.status && record.status !== where.status) {
    return false;
  }

  if (where.name?.contains && !record.name.toLowerCase().includes(where.name.contains.toLowerCase())) {
    return false;
  }

  return true;
}

function createOrganization(input: Partial<TestOrganization> = {}): TestOrganization {
  const now = new Date('2026-06-21T01:00:00.000Z');

  return {
    id: input.id || `org-${Math.random().toString(36).slice(2)}`,
    name: input.name || '默认组织',
    status: input.status || 'enabled',
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now
  };
}

function createUser(input: Partial<TestUser> = {}): TestUser {
  return {
    id: input.id || `u-${Math.random().toString(36).slice(2)}`,
    organizationId: input.organizationId || 'org-default',
    organizationRole: input.organizationRole || 'member'
  };
}

function createLogServiceStub() {
  return {
    records: [] as any[],
    async record(input: any) {
      this.records.push(input);
    }
  };
}

interface TestOrganization {
  id: string;
  name: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

interface TestUser {
  id: string;
  organizationId: string;
  organizationRole: string;
}
