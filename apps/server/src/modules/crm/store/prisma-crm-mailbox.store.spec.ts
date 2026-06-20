import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaCrmMailboxStore } from './prisma-crm-mailbox.store';

describe('PrismaCrmMailboxStore', () => {
  it('creates mailbox and uses provider plus email hash for duplicate lookup', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmMailboxStore(prisma as never);

    const mailbox = await store.createMailbox({
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      ownerUserName: 'Alice',
      provider: 'gmail',
      emailAddress: 'alice@gmail.com',
      emailHash: 'hash-1',
      maskedEmail: 'a***@gmail.com',
      status: 'active',
      dailyLimit: 50,
      hourlyLimit: 10,
      warmupStage: 'new',
      encryptedRefreshToken: 'encrypted-refresh-token-1',
      authorizedAt: new Date('2026-06-18T09:00:00.000Z')
    });
    const existing = await store.findMailboxByProviderAndEmailHash('gmail', 'hash-1');

    assert.equal(mailbox.id, 'mailbox-1');
    assert.equal(mailbox.encryptedRefreshToken, 'encrypted-refresh-token-1');
    assert.equal(existing?.id, 'mailbox-1');
    assert.deepEqual(prisma.crmMailbox.createCalls[0].data.encryptedRefreshToken, 'encrypted-refresh-token-1');
    assert.deepEqual(prisma.crmMailbox.findUniqueCalls[0].where, {
      provider_emailHash: {
        provider: 'gmail',
        emailHash: 'hash-1'
      }
    });
  });

  it('returns existing mailbox when concurrent create hits global provider email hash uniqueness', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmMailboxStore(prisma as never);
    prisma.crmMailbox.createError = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: 'test'
    });

    const mailbox = await store.createMailbox({
      organizationId: 'org-2',
      ownerUserId: 'user-2',
      ownerUserName: 'Bob',
      provider: 'gmail',
      emailAddress: 'alice@gmail.com',
      emailHash: 'hash-1',
      maskedEmail: 'a***@gmail.com',
      status: 'active',
      dailyLimit: 50,
      hourlyLimit: 10,
      warmupStage: 'new',
      authorizedAt: new Date('2026-06-18T09:00:00.000Z')
    });

    assert.equal(mailbox.id, 'mailbox-1');
    assert.deepEqual(prisma.crmMailbox.findUniqueCalls[0].where, {
      provider_emailHash: {
        provider: 'gmail',
        emailHash: 'hash-1'
      }
    });
  });

  it('lists mailboxes with organization, owner, keyword and status filters', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmMailboxStore(prisma as never);

    const result = await store.listMailboxes({
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      keyword: 'gmail',
      status: 'active',
      skip: 0,
      take: 20
    });

    assert.equal(result.total, 1);
    assert.deepEqual(prisma.crmMailbox.findManyCalls[0], {
      where: {
        organizationId: 'org-1',
        ownerUserId: 'user-1',
        status: 'active',
        OR: [
          { emailAddress: { contains: 'gmail', mode: 'insensitive' } },
          { maskedEmail: { contains: 'gmail', mode: 'insensitive' } },
          { ownerUserName: { contains: 'gmail', mode: 'insensitive' } }
        ]
      },
      skip: 0,
      take: 20,
      orderBy: { updatedAt: 'desc' }
    });
    assert.deepEqual(prisma.crmMailbox.countCalls[0], {
      where: prisma.crmMailbox.findManyCalls[0].where
    });
  });
});

function createPrismaMailbox(input: Record<string, unknown> = {}) {
  return {
    id: 'mailbox-1',
    organizationId: 'org-1',
    ownerUserId: 'user-1',
    ownerUserName: 'Alice',
    provider: 'gmail',
    emailAddress: 'alice@gmail.com',
    emailHash: 'hash-1',
    maskedEmail: 'a***@gmail.com',
    status: 'active',
    dailyLimit: 50,
    hourlyLimit: 10,
    warmupStage: 'new',
    encryptedRefreshToken: 'encrypted-refresh-token-1',
    watchExpiration: null,
    lastHistoryId: null,
    syncIssueType: null,
    syncIssueAt: null,
    syncIssueMessage: null,
    authorizedAt: new Date('2026-06-18T09:00:00.000Z'),
    pausedAt: null,
    createdAt: new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: new Date('2026-06-18T09:00:00.000Z'),
    ...input
  };
}

function createPrisma() {
  const mailbox = createPrismaMailbox();

  return {
    crmMailbox: {
      createError: null as Error | null,
      createCalls: [] as Array<{ data: Record<string, unknown> }>,
      findUniqueCalls: [] as Array<{ where: Record<string, unknown> }>,
      findManyCalls: [] as Array<{
        where: Record<string, unknown>;
        skip: number;
        take: number;
        orderBy: Record<string, unknown>;
      }>,
      countCalls: [] as Array<{ where: Record<string, unknown> }>,
      async create(args: { data: Record<string, unknown> }) {
        this.createCalls.push(args);

        if (this.createError) {
          throw this.createError;
        }

        return { ...mailbox, ...args.data };
      },
      async findUnique(args: { where: Record<string, unknown> }) {
        this.findUniqueCalls.push(args);
        return mailbox;
      },
      async findMany(args: {
        where: Record<string, unknown>;
        skip: number;
        take: number;
        orderBy: Record<string, unknown>;
      }) {
        this.findManyCalls.push(args);
        return [mailbox];
      },
      async count(args: { where: Record<string, unknown> }) {
        this.countCalls.push(args);
        return 1;
      }
    }
  };
}
