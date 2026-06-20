import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PrismaCrmGmailWatchStore } from './prisma-crm-gmail-watch.store';

describe('PrismaCrmGmailWatchStore', () => {
  it('lists active Gmail mailboxes that need watch renewal', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmGmailWatchStore(prisma as never);
    const renewBefore = new Date('2026-06-19T12:00:00.000Z');

    await store.listMailboxesForWatchRenewal({
      provider: 'gmail',
      renewBefore,
      take: 25
    });

    assert.deepEqual(prisma.crmMailbox.findManyCalls[0], {
      where: {
        provider: 'gmail',
        status: 'active',
        OR: [{ watchExpiration: null }, { watchExpiration: { lte: renewBefore } }]
      },
      orderBy: [{ watchExpiration: 'asc' }, { updatedAt: 'asc' }],
      take: 25
    });
  });

  it('finds and updates mailboxes through scoped identity reads before writes', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmGmailWatchStore(prisma as never);
    const pausedAt = new Date('2026-06-18T10:00:00.000Z');

    const found = await store.findMailboxById({
      id: 'mailbox-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1'
    });
    const updated = await store.updateMailbox('mailbox-1', {
      status: 'paused',
      pausedAt
    });

    assert.equal(found?.id, 'mailbox-1');
    assert.equal(updated?.status, 'paused');
    assert.deepEqual(prisma.crmMailbox.findFirstCalls[0].where, {
      id: 'mailbox-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1'
    });
    assert.deepEqual(prisma.crmMailbox.updateManyAndReturnCalls[0], {
      where: { id: 'mailbox-1' },
      data: {
        status: 'paused',
        pausedAt
      },
      limit: 1
    });
  });

  it('finds a Gmail mailbox by provider and email hash', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmGmailWatchStore(prisma as never);

    const mailbox = await store.findMailboxByProviderAndEmailHash('gmail', 'hash-1');

    assert.equal(mailbox?.id, 'mailbox-1');
    assert.deepEqual(prisma.crmMailbox.findUniqueCalls[0].where, {
      provider_emailHash: {
        provider: 'gmail',
        emailHash: 'hash-1'
      }
    });
  });

  it('advances mailbox Gmail history id with the current checkpoint guard', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmGmailWatchStore(prisma as never);

    const mailbox = await store.advanceMailboxHistoryId({
      mailboxId: 'mailbox-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      fromHistoryId: '100',
      toHistoryId: '120'
    });

    assert.equal(mailbox?.lastHistoryId, '120');
    assert.deepEqual(prisma.crmMailbox.updateManyAndReturnCalls[0], {
      where: {
        id: 'mailbox-1',
        organizationId: 'org-1',
        ownerUserId: 'user-1',
        lastHistoryId: '100'
      },
      data: {
        lastHistoryId: '120',
        syncIssueType: null,
        syncIssueAt: null,
        syncIssueMessage: null
      },
      limit: 1
    });
  });

  it('marks Gmail mailbox auth expired and pauses pending sends for that mailbox', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmGmailWatchStore(prisma as never);
    const expiredAt = new Date('2026-06-18T10:50:00.000Z');

    const result = await store.markMailboxAuthorizationExpired({
      mailboxId: 'mailbox-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      reason: 'invalid_grant',
      expiredAt
    });

    assert.equal(result?.mailbox.status, 'auth_expired');
    assert.equal(result?.pausedEnrollmentCount, 1);
    assert.equal(result?.resetMessageCount, 1);
    assert.deepEqual(prisma.crmMailbox.updateManyAndReturnCalls.at(-1), {
      where: {
        id: 'mailbox-1',
        organizationId: 'org-1',
        ownerUserId: 'user-1'
      },
      data: {
        status: 'auth_expired',
        watchExpiration: null,
        pausedAt: expiredAt
      },
      limit: 1
    });
    assert.deepEqual(prisma.crmSequenceEnrollment.updateManyCalls.at(-1), {
      where: {
        organizationId: 'org-1',
        ownerUserId: 'user-1',
        mailboxId: 'mailbox-1',
        status: { in: ['ready_to_send', 'sequence_running'] }
      },
      data: {
        status: 'paused',
        runVersion: { increment: 1 }
      }
    });
    assert.deepEqual(prisma.crmMessage.updateManyCalls.at(-1), {
      where: {
        organizationId: 'org-1',
        ownerUserId: 'user-1',
        mailboxId: 'mailbox-1',
        status: 'queued'
      },
      data: {
        status: 'draft_ready',
        bullJobId: null
      }
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
    transactionCalls: 0,
    async $transaction<T>(operation: (tx: unknown) => Promise<T>) {
      this.transactionCalls += 1;
      return operation(this);
    },
    crmMailbox: {
      findUniqueCalls: [] as Array<{ where: Record<string, unknown> }>,
      findFirstCalls: [] as Array<{ where: Record<string, unknown> }>,
      findManyCalls: [] as Array<{
        where: Record<string, unknown>;
        orderBy: Array<Record<string, unknown>>;
        take: number;
      }>,
      updateManyAndReturnCalls: [] as Array<{
        where: Record<string, unknown>;
        data: Record<string, unknown>;
        limit?: number;
      }>,
      async findUnique(args: { where: Record<string, unknown> }) {
        this.findUniqueCalls.push(args);
        return mailbox;
      },
      async findFirst(args: { where: Record<string, unknown> }) {
        this.findFirstCalls.push(args);
        return mailbox;
      },
      async findMany(args: {
        where: Record<string, unknown>;
        orderBy: Array<Record<string, unknown>>;
        take: number;
      }) {
        this.findManyCalls.push(args);
        return [mailbox];
      },
      async updateManyAndReturn(args: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
        limit: number;
      }) {
        this.updateManyAndReturnCalls.push(args);
        return [{ ...mailbox, ...args.data, updatedAt: new Date('2026-06-18T10:00:00.000Z') }];
      }
    },
    crmSequenceEnrollment: {
      updateManyCalls: [] as Array<{ where: Record<string, unknown>; data: Record<string, unknown> }>,
      async updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }) {
        this.updateManyCalls.push(args);
        return { count: 1 };
      }
    },
    crmMessage: {
      updateManyCalls: [] as Array<{ where: Record<string, unknown>; data: Record<string, unknown> }>,
      async updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }) {
        this.updateManyCalls.push(args);
        return { count: 1 };
      }
    }
  };
}
