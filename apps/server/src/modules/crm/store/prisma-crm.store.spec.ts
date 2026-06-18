import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaCrmStore } from './prisma-crm.store';

describe('PrismaCrmStore', () => {
  it('creates and lists accounts through Prisma with organization scope', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmStore(prisma as never);

    await store.createAccount({
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      name: 'ABC Trading',
      normalizedName: 'abc trading',
      websiteUrl: 'https://abc.example',
      domain: 'abc.example',
      country: 'AE',
      customerType: 'distributor',
      status: 'missing_contact',
      sourceTaskId: 'task-1'
    });
    const result = await store.listAccounts({
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      skip: 0,
      take: 20
    });

    assert.equal(prisma.crmAccount.createCalls[0].data.organizationId, 'org-1');
    assert.deepEqual(prisma.crmAccount.findManyCalls[0].where, {
      organizationId: 'org-1',
      ownerUserId: 'user-1'
    });
    assert.equal(result.total, 1);
  });

  it('builds keyword and status account filters without dropping organization scope', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmStore(prisma as never);

    await store.listAccounts({
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      skip: 0,
      take: 20,
      keyword: 'bearing',
      status: 'ready'
    });

    assert.deepEqual(prisma.crmAccount.findManyCalls[0].where, {
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      status: 'ready',
      OR: [
        { name: { contains: 'bearing', mode: 'insensitive' } },
        { domain: { contains: 'bearing', mode: 'insensitive' } },
        { websiteUrl: { contains: 'bearing', mode: 'insensitive' } },
        { country: { contains: 'bearing', mode: 'insensitive' } },
        { customerType: { contains: 'bearing', mode: 'insensitive' } }
      ]
    });
  });

  it('returns the existing account when concurrent create hits a unique conflict', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmStore(prisma as never);
    prisma.crmAccount.createError = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: 'test'
    });

    const account = await store.createAccount({
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      name: 'ABC Trading',
      normalizedName: 'abc trading',
      websiteUrl: 'https://abc.example',
      domain: 'abc.example',
      country: 'AE',
      customerType: 'distributor',
      status: 'missing_contact',
      sourceTaskId: 'task-1'
    });

    assert.equal(account.id, 'account-1');
    assert.deepEqual(prisma.crmAccount.findUniqueCalls[0].where, {
      organizationId_ownerUserId_domain: {
        organizationId: 'org-1',
        ownerUserId: 'user-1',
        domain: 'abc.example'
      }
    });
  });
});

function createPrisma() {
  const account = {
    id: 'account-1',
    organizationId: 'org-1',
    ownerUserId: 'user-1',
    name: 'ABC Trading',
    normalizedName: 'abc trading',
    websiteUrl: 'https://abc.example',
    domain: 'abc.example',
    country: 'AE',
    customerType: 'distributor',
    status: 'missing_contact',
    sourceTaskId: 'task-1',
    createdAt: new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: new Date('2026-06-18T09:00:00.000Z')
  };

  return {
    crmAccount: {
      createCalls: [] as Array<{ data: Record<string, unknown> }>,
      findUniqueCalls: [] as Array<{ where: Record<string, unknown> }>,
      findManyCalls: [] as Array<{ where: Record<string, unknown> }>,
      createError: null as Error | null,
      async create(args: { data: Record<string, unknown> }) {
        this.createCalls.push(args);
        if (this.createError) throw this.createError;
        return account;
      },
      async findUnique(args: { where: Record<string, unknown> }) {
        this.findUniqueCalls.push(args);
        return account;
      },
      async findMany(args: { where: Record<string, unknown> }) {
        this.findManyCalls.push(args);
        return [account];
      },
      async count() {
        return 1;
      }
    },
    crmContact: {},
    crmTimelineEvent: {}
  };
}
