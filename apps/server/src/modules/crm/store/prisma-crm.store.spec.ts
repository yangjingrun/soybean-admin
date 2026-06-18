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

  it('loads account detail with member owner scope and newest timeline first', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmStore(prisma as never);

    const detail = await store.getAccountDetail({
      id: 'account-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1'
    });

    assert.equal(detail?.account.id, 'account-1');
    assert.deepEqual(prisma.crmAccount.findFirstCalls[0].where, {
      id: 'account-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1'
    });
    assert.deepEqual(prisma.crmContact.findManyCalls[0], {
      where: {
        organizationId: 'org-1',
        accountId: 'account-1'
      },
      orderBy: {
        createdAt: 'asc'
      }
    });
    assert.deepEqual(prisma.crmTimelineEvent.findManyCalls[0], {
      where: {
        organizationId: 'org-1',
        accountId: 'account-1'
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  });

  it('loads account detail without owner scope for organization admins', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmStore(prisma as never);

    await store.getAccountDetail({
      id: 'account-1',
      organizationId: 'org-1'
    });

    assert.deepEqual(prisma.crmAccount.findFirstCalls[0].where, {
      id: 'account-1',
      organizationId: 'org-1'
    });
  });

  it('loads contacts with organization and optional owner scope', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmStore(prisma as never);

    const contact = await store.findContactById({
      id: 'contact-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1'
    });

    assert.equal(contact?.id, 'contact-1');
    assert.deepEqual(prisma.crmContact.findFirstCalls[0].where, {
      id: 'contact-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1'
    });
  });

  it('updates contact email status through Prisma', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmStore(prisma as never);

    const contact = await store.updateContactEmailStatus('contact-1', 'valid');

    assert.equal(contact?.emailStatus, 'valid');
    assert.deepEqual(prisma.crmContact.updateManyAndReturnCalls[0], {
      where: { id: 'contact-1' },
      data: { emailStatus: 'valid' },
      limit: 1
    });
  });

  it('creates mailbox and uses provider plus email hash for duplicate lookup', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmStore(prisma as never);

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
      authorizedAt: new Date('2026-06-18T09:00:00.000Z')
    });
    const existing = await store.findMailboxByProviderAndEmailHash('gmail', 'hash-1');

    assert.equal(mailbox.id, 'mailbox-1');
    assert.equal(existing?.id, 'mailbox-1');
    assert.deepEqual(prisma.crmMailbox.findUniqueCalls[0].where, {
      provider_emailHash: {
        provider: 'gmail',
        emailHash: 'hash-1'
      }
    });
  });

  it('returns existing mailbox when concurrent create hits global provider email hash uniqueness', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmStore(prisma as never);
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
    const store = new PrismaCrmStore(prisma as never);

    await store.listMailboxes({
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      keyword: 'gmail',
      status: 'active',
      skip: 0,
      take: 20
    });

    assert.deepEqual(prisma.crmMailbox.findManyCalls[0].where, {
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      status: 'active',
      OR: [
        { emailAddress: { contains: 'gmail', mode: 'insensitive' } },
        { maskedEmail: { contains: 'gmail', mode: 'insensitive' } },
        { ownerUserName: { contains: 'gmail', mode: 'insensitive' } }
      ]
    });
    assert.deepEqual(prisma.crmMailbox.findManyCalls[0].orderBy, { updatedAt: 'desc' });
  });

  it('finds and updates mailboxes through scoped identity reads before writes', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmStore(prisma as never);

    const found = await store.findMailboxById({
      id: 'mailbox-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1'
    });
    const updated = await store.updateMailbox('mailbox-1', {
      status: 'paused',
      pausedAt: new Date('2026-06-18T10:00:00.000Z')
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
        pausedAt: new Date('2026-06-18T10:00:00.000Z')
      },
      limit: 1
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
  const mailbox = {
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
    watchExpiration: null,
    lastHistoryId: null,
    authorizedAt: new Date('2026-06-18T09:00:00.000Z'),
    pausedAt: null,
    createdAt: new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: new Date('2026-06-18T09:00:00.000Z')
  };

  return {
    crmAccount: {
      createCalls: [] as Array<{ data: Record<string, unknown> }>,
      findUniqueCalls: [] as Array<{ where: Record<string, unknown> }>,
      findFirstCalls: [] as Array<{ where: Record<string, unknown> }>,
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
      async findFirst(args: { where: Record<string, unknown> }) {
        this.findFirstCalls.push(args);
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
    crmContact: {
      findManyCalls: [] as Array<{ where: Record<string, unknown>; orderBy: Record<string, unknown> }>,
      findFirstCalls: [] as Array<{ where: Record<string, unknown> }>,
      updateManyAndReturnCalls: [] as Array<{
        where: Record<string, unknown>;
        data: Record<string, unknown>;
        limit: number;
      }>,
      async findMany(args: { where: Record<string, unknown>; orderBy: Record<string, unknown> }) {
        this.findManyCalls.push(args);
        return [
          {
            id: 'contact-1',
            organizationId: 'org-1',
            accountId: 'account-1',
            ownerUserId: 'user-1',
            fullName: 'Ali Hassan',
            title: 'Buyer',
            email: 'ali@example.com',
            emailHash: 'hash-1',
            maskedEmail: 'a***@example.com',
            isPublicEmail: false,
            emailStatus: 'unchecked',
            sourceTaskId: null,
            createdAt: new Date('2026-06-18T09:00:00.000Z'),
            updatedAt: new Date('2026-06-18T09:00:00.000Z')
          }
        ];
      },
      async findFirst(args: { where: Record<string, unknown> }) {
        this.findFirstCalls.push(args);
        return {
          id: 'contact-1',
          organizationId: 'org-1',
          accountId: 'account-1',
          ownerUserId: 'user-1',
          fullName: 'Ali Hassan',
          title: 'Buyer',
          email: 'ali@example.com',
          emailHash: 'hash-1',
          maskedEmail: 'a***@example.com',
          isPublicEmail: false,
          emailStatus: 'unchecked',
          sourceTaskId: null,
          createdAt: new Date('2026-06-18T09:00:00.000Z'),
          updatedAt: new Date('2026-06-18T09:00:00.000Z')
        };
      },
      async updateManyAndReturn(args: { where: Record<string, unknown>; data: Record<string, unknown>; limit: number }) {
        this.updateManyAndReturnCalls.push(args);
        return [
          {
            id: 'contact-1',
            organizationId: 'org-1',
            accountId: 'account-1',
            ownerUserId: 'user-1',
            fullName: 'Ali Hassan',
            title: 'Buyer',
            email: 'ali@example.com',
            emailHash: 'hash-1',
            maskedEmail: 'a***@example.com',
            isPublicEmail: false,
            emailStatus: args.data.emailStatus,
            sourceTaskId: null,
            createdAt: new Date('2026-06-18T09:00:00.000Z'),
            updatedAt: new Date('2026-06-18T10:00:00.000Z')
          }
        ];
      }
    },
    crmTimelineEvent: {
      findManyCalls: [] as Array<{ where: Record<string, unknown>; orderBy: Record<string, unknown> }>,
      async findMany(args: { where: Record<string, unknown>; orderBy: Record<string, unknown> }) {
        this.findManyCalls.push(args);
        return [
          {
            id: 'event-1',
            organizationId: 'org-1',
            accountId: 'account-1',
            contactId: null,
            ownerUserId: 'user-1',
            eventType: 'account_imported',
            title: '导入',
            content: null,
            metadata: null,
            createdAt: new Date('2026-06-18T10:00:00.000Z')
          }
        ];
      }
    },
    crmMailbox: {
      createCalls: [] as Array<{ data: Record<string, unknown> }>,
      findUniqueCalls: [] as Array<{ where: Record<string, unknown> }>,
      findFirstCalls: [] as Array<{ where: Record<string, unknown> }>,
      findManyCalls: [] as Array<{
        where: Record<string, unknown>;
        skip: number;
        take: number;
        orderBy: Record<string, unknown>;
      }>,
      updateManyAndReturnCalls: [] as Array<{
        where: Record<string, unknown>;
        data: Record<string, unknown>;
        limit: number;
      }>,
      createError: null as Error | null,
      async create(args: { data: Record<string, unknown> }) {
        this.createCalls.push(args);
        if (this.createError) throw this.createError;
        return mailbox;
      },
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
        skip: number;
        take: number;
        orderBy: Record<string, unknown>;
      }) {
        this.findManyCalls.push(args);
        return [mailbox];
      },
      async count() {
        return 1;
      },
      async updateManyAndReturn(args: { where: Record<string, unknown>; data: Record<string, unknown>; limit: number }) {
        this.updateManyAndReturnCalls.push(args);
        return [{ ...mailbox, ...args.data, updatedAt: new Date('2026-06-18T10:00:00.000Z') }];
      }
    }
  };
}
