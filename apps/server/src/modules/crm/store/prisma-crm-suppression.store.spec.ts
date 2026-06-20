import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PrismaCrmSuppressionStore } from './prisma-crm-suppression.store';

describe('PrismaCrmSuppressionStore', () => {
  it('finds organization blacklist entries by organization and email hash', async () => {
    const prisma = createPrisma({ blacklistEntry: createPrismaBlacklist() });
    const store = new PrismaCrmSuppressionStore(prisma as never);

    const entry = await store.findBlacklistEntry({
      organizationId: 'org-1',
      emailHash: 'hash-1'
    });

    assert.equal(entry?.reason, 'unsubscribe');
    assert.deepEqual(prisma.crmBlacklist.findUniqueCalls[0].where, {
      organizationId_emailHash: {
        organizationId: 'org-1',
        emailHash: 'hash-1'
      }
    });
  });

  it('batch loads organization blacklist entries by email hashes', async () => {
    const prisma = createPrisma({
      blacklistFindManyResults: [
        createPrismaBlacklist({ emailHash: 'hash-1' }),
        createPrismaBlacklist({ id: 'blacklist-2', emailHash: 'hash-2' })
      ]
    });
    const store = new PrismaCrmSuppressionStore(prisma as never);

    const records = await store.listBlacklistEntriesByEmailHashes({
      organizationId: 'org-1',
      emailHashes: ['hash-1', 'hash-2', 'hash-1']
    });

    assert.deepEqual(
      records.map(record => record.emailHash),
      ['hash-1', 'hash-2']
    );
    assert.deepEqual(prisma.crmBlacklist.findManyCalls[0].where, {
      organizationId: 'org-1',
      emailHash: { in: ['hash-1', 'hash-2'] }
    });
  });

  it('upserts organization blacklist entries by organization and email hash', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmSuppressionStore(prisma as never);

    const entry = await store.upsertBlacklistEntry({
      organizationId: 'org-1',
      emailHash: 'hash-1',
      maskedEmail: 'a***@example.com',
      reason: 'unsubscribe',
      sourceAccountId: 'account-1',
      sourceContactId: 'contact-1',
      sourceMessageId: 'inbox-message-1',
      createdById: 'user-1',
      createdByName: 'Alice'
    });

    assert.equal(entry.emailHash, 'hash-1');
    assert.deepEqual(prisma.crmBlacklist.upsertCalls[0].where, {
      organizationId_emailHash: {
        organizationId: 'org-1',
        emailHash: 'hash-1'
      }
    });
    assert.equal(prisma.crmBlacklist.upsertCalls[0].create.sourceMessageId, 'inbox-message-1');
    assert.equal(prisma.crmBlacklist.upsertCalls[0].update.sourceMessageId, 'inbox-message-1');
  });

  it('lists organization blacklist entries by keyword without exposing other organizations', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmSuppressionStore(prisma as never);

    await store.listBlacklistEntries({
      organizationId: 'org-1',
      keyword: 'alice',
      skip: 0,
      take: 20
    });

    assert.deepEqual(prisma.crmBlacklist.findManyCalls[0], {
      where: {
        organizationId: 'org-1',
        OR: [
          { maskedEmail: { contains: 'alice', mode: 'insensitive' } },
          { createdByName: { contains: 'alice', mode: 'insensitive' } }
        ]
      },
      skip: 0,
      take: 20,
      orderBy: { updatedAt: 'desc' }
    });
    assert.deepEqual(prisma.crmBlacklist.countCalls[0], {
      where: prisma.crmBlacklist.findManyCalls[0].where
    });
  });

  it('deletes one organization blacklist entry by scoped id', async () => {
    const prisma = createPrisma({ blacklistEntry: createPrismaBlacklist() });
    const store = new PrismaCrmSuppressionStore(prisma as never);

    const entry = await store.deleteBlacklistEntry({
      id: 'blacklist-1',
      organizationId: 'org-1'
    });

    assert.equal(entry?.id, 'blacklist-1');
    assert.deepEqual(prisma.crmBlacklist.findFirstCalls[0].where, {
      id: 'blacklist-1',
      organizationId: 'org-1'
    });
    assert.deepEqual(prisma.crmBlacklist.deleteCalls[0].where, {
      id: 'blacklist-1'
    });
  });
});

function createPrismaBlacklist(input: Record<string, unknown> = {}) {
  return {
    id: 'blacklist-1',
    organizationId: 'org-1',
    emailHash: 'hash-1',
    maskedEmail: 'a***@example.com',
    reason: 'unsubscribe',
    sourceAccountId: null,
    sourceContactId: null,
    sourceMessageId: null,
    createdById: null,
    createdByName: null,
    createdAt: new Date('2026-06-18T10:00:00.000Z'),
    updatedAt: new Date('2026-06-18T10:00:00.000Z'),
    ...input
  };
}

function createPrisma(options: {
  blacklistEntry?: ReturnType<typeof createPrismaBlacklist> | null;
  blacklistFindManyResults?: ReturnType<typeof createPrismaBlacklist>[];
} = {}) {
  const blacklistEntry = options.blacklistEntry ?? createPrismaBlacklist();

  return {
    crmBlacklist: {
      findUniqueCalls: [] as Array<{ where: Record<string, unknown> }>,
      findManyCalls: [] as Array<{
        where: Record<string, unknown>;
        skip?: number;
        take?: number;
        orderBy?: Record<string, unknown>;
      }>,
      upsertCalls: [] as Array<{
        where: Record<string, unknown>;
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }>,
      countCalls: [] as Array<{ where: Record<string, unknown> }>,
      findFirstCalls: [] as Array<{ where: Record<string, unknown> }>,
      deleteCalls: [] as Array<{ where: Record<string, unknown> }>,
      async findUnique(args: { where: Record<string, unknown> }) {
        this.findUniqueCalls.push(args);
        return options.blacklistEntry === null ? null : blacklistEntry;
      },
      async findMany(args: {
        where: Record<string, unknown>;
        skip?: number;
        take?: number;
        orderBy?: Record<string, unknown>;
      }) {
        this.findManyCalls.push(args);
        return options.blacklistFindManyResults ?? [blacklistEntry];
      },
      async upsert(args: {
        where: Record<string, unknown>;
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }) {
        this.upsertCalls.push(args);
        return { ...blacklistEntry, ...args.create, ...args.update };
      },
      async count(args: { where: Record<string, unknown> }) {
        this.countCalls.push(args);
        return 1;
      },
      async findFirst(args: { where: Record<string, unknown> }) {
        this.findFirstCalls.push(args);
        return options.blacklistEntry === null ? null : blacklistEntry;
      },
      async delete(args: { where: Record<string, unknown> }) {
        this.deleteCalls.push(args);
        return blacklistEntry;
      }
    }
  };
}
