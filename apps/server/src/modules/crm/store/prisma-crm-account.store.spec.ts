import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaCrmAccountStore } from './prisma-crm-account.store';

describe('PrismaCrmAccountStore', () => {
  describe('accounts', () => {
    it('creates and lists accounts through Prisma with organization scope', async () => {
      const prisma = createPrisma();
      const store = new PrismaCrmAccountStore(prisma as never);

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
      assert.deepEqual(prisma.crmAccount.findManyCalls[0], {
        where: {
          organizationId: 'org-1',
          ownerUserId: 'user-1'
        },
        include: {
          _count: {
            select: {
              contacts: true
            }
          },
          contacts: {
            orderBy: { createdAt: 'asc' },
            take: 1
          }
        },
        skip: 0,
        take: 20,
        orderBy: { updatedAt: 'desc' }
      });
      assert.deepEqual(prisma.crmAccount.countCalls[0], {
        where: prisma.crmAccount.findManyCalls[0].where
      });
      assert.equal(result.total, 1);
      assert.equal(result.records[0].contactCount, 1);
      assert.equal(result.records[0].primaryContact?.id, 'contact-1');
    });

    it('builds keyword and status account filters without dropping organization scope', async () => {
      const prisma = createPrisma();
      const store = new PrismaCrmAccountStore(prisma as never);

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
        AND: [
          {
            OR: [
              { name: { contains: 'bearing', mode: 'insensitive' } },
              { domain: { contains: 'bearing', mode: 'insensitive' } },
              { websiteUrl: { contains: 'bearing', mode: 'insensitive' } },
              { country: { contains: 'bearing', mode: 'insensitive' } },
              { city: { contains: 'bearing', mode: 'insensitive' } },
              { address: { contains: 'bearing', mode: 'insensitive' } },
              { customerType: { contains: 'bearing', mode: 'insensitive' } }
            ]
          }
        ]
      });
    });

    it('builds field account filters for CRM lead filter panel', async () => {
      const prisma = createPrisma();
      const store = new PrismaCrmAccountStore(prisma as never);
      const updatedFrom = new Date('2026-06-01T00:00:00.000Z');
      const updatedTo = new Date('2026-06-24T23:59:59.999Z');

      await store.listAccounts({
        organizationId: 'org-1',
        ownerUserId: 'user-1',
        skip: 0,
        take: 20,
        contactTitle: 'buyer',
        customerType: 'distributor',
        region: 'Riyadh',
        regionKeywords: ['台湾', 'Taiwan'],
        updatedFrom,
        updatedTo
      });

      assert.deepEqual(prisma.crmAccount.findManyCalls[0].where, {
        organizationId: 'org-1',
        ownerUserId: 'user-1',
        customerType: { contains: 'distributor', mode: 'insensitive' },
        contacts: { some: { title: { contains: 'buyer', mode: 'insensitive' } } },
        updatedAt: { gte: updatedFrom, lte: updatedTo },
        AND: [
          {
            OR: [
              { country: { contains: '台湾', mode: 'insensitive' } },
              { city: { contains: '台湾', mode: 'insensitive' } },
              { address: { contains: '台湾', mode: 'insensitive' } },
              { country: { contains: 'Taiwan', mode: 'insensitive' } },
              { city: { contains: 'Taiwan', mode: 'insensitive' } },
              { address: { contains: 'Taiwan', mode: 'insensitive' } },
              { country: { contains: 'Riyadh', mode: 'insensitive' } },
              { city: { contains: 'Riyadh', mode: 'insensitive' } },
              { address: { contains: 'Riyadh', mode: 'insensitive' } }
            ]
          }
        ]
      });
    });

    it('filters listed accounts by AI lead source task without dropping owner scope', async () => {
      const prisma = createPrisma();
      const store = new PrismaCrmAccountStore(prisma as never);

      await store.listAccounts({
        organizationId: 'org-1',
        ownerUserId: 'user-1',
        skip: 0,
        take: 20,
        sourceTaskId: 'task-1'
      });

      assert.deepEqual(prisma.crmAccount.findManyCalls[0].where, {
        organizationId: 'org-1',
        ownerUserId: 'user-1',
        sourceTaskId: 'task-1'
      });
    });

    it('adds primary contact email progress to listed accounts', async () => {
      const scheduledAt = new Date('2026-06-24T08:20:00.000Z');
      const prisma = createPrisma({
        messages: [
          createPrismaMessage({
            id: 'message-1',
            status: 'draft_ready',
            stepIndex: 1,
            scheduledAt,
            enrollment: { totalSteps: 5 }
          })
        ]
      });
      const store = new PrismaCrmAccountStore(prisma as never);

      const result = await store.listAccounts({
        organizationId: 'org-1',
        ownerUserId: 'user-1',
        skip: 0,
        take: 20
      });

      assert.deepEqual(prisma.crmMessage.findManyCalls[0].where, {
        organizationId: 'org-1',
        contactId: { in: ['contact-1'] }
      });
      assert.equal(result.records[0].primaryContact?.emailProgressStatus, 'draft_ready');
      assert.equal(result.records[0].primaryContact?.emailProgressLabel, '第 1/5 封已排期');
      assert.equal(result.records[0].primaryContact?.emailProgressAt, scheduledAt);
      assert.equal(result.records[0].primaryContact?.emailProgressMessageId, 'message-1');
    });

    it('returns the existing account when concurrent create hits a unique conflict', async () => {
      const prisma = createPrisma();
      const store = new PrismaCrmAccountStore(prisma as never);
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

  describe('email verification cache', () => {
    it('finds a fresh global email verification cache by email hash', async () => {
      const prisma = createPrisma();
      const store = new PrismaCrmAccountStore(prisma as never);

      const cache = await store.findEmailVerificationCache({ emailHash: 'email-hash-1' });

      assert.equal(cache?.status, 'valid');
      assert.deepEqual(prisma.crmEmailVerificationCache.findUniqueCalls[0].where, {
        emailHash: 'email-hash-1'
      });
    });

    it('upserts a global email verification cache by email hash', async () => {
      const prisma = createPrisma();
      const store = new PrismaCrmAccountStore(prisma as never);
      const verifiedAt = new Date('2026-06-18T09:00:00.000Z');
      const expiresAt = new Date('2026-07-18T09:00:00.000Z');

      const cache = await store.upsertEmailVerificationCache({
        emailHash: 'email-hash-1',
        maskedEmail: 'a***@example.com',
        domain: 'example.com',
        status: 'valid',
        reason: 'mx_found',
        verifiedAt,
        expiresAt,
        checkedById: 'user-1',
        checkedByName: 'Alice'
      });

      assert.equal(cache.reason, 'mx_found');
      assert.deepEqual(prisma.crmEmailVerificationCache.upsertCalls[0], {
        where: {
          emailHash: 'email-hash-1'
        },
        create: {
          emailHash: 'email-hash-1',
          maskedEmail: 'a***@example.com',
          domain: 'example.com',
          status: 'valid',
          reason: 'mx_found',
          verifiedAt,
          expiresAt,
          checkedById: 'user-1',
          checkedByName: 'Alice'
        },
        update: {
          maskedEmail: 'a***@example.com',
          domain: 'example.com',
          status: 'valid',
          reason: 'mx_found',
          verifiedAt,
          expiresAt,
          checkedById: 'user-1',
          checkedByName: 'Alice'
        }
      });
    });
  });

  describe('archived fingerprints', () => {
    it('finds archived fingerprints by organization and requested fingerprint pairs', async () => {
      const prisma = createPrisma({
        archivedFingerprintResults: [
          createPrismaArchivedFingerprint({ fingerprintType: 'domain', fingerprintValue: 'buyer.example' })
        ]
      });
      const store = new PrismaCrmAccountStore(prisma as never);

      const records = await store.findArchivedFingerprints({
        organizationId: 'org-1',
        fingerprints: [
          { fingerprintType: 'domain', fingerprintValue: 'buyer.example' },
          { fingerprintType: 'email_hash', fingerprintValue: 'email-hash-1' }
        ]
      });

      assert.equal(records.length, 1);
      assert.deepEqual(prisma.crmArchivedFingerprint.findManyCalls[0], {
        where: {
          organizationId: 'org-1',
          OR: [
            { fingerprintType: 'domain', fingerprintValue: 'buyer.example' },
            { fingerprintType: 'email_hash', fingerprintValue: 'email-hash-1' }
          ]
        },
        orderBy: {
          archivedAt: 'desc'
        }
      });
    });

    it('upserts archived fingerprints by organization type and value', async () => {
      const prisma = createPrisma();
      const store = new PrismaCrmAccountStore(prisma as never);
      const archivedAt = new Date('2026-06-18T10:00:00.000Z');

      const record = await store.upsertArchivedFingerprint({
        organizationId: 'org-1',
        fingerprintType: 'domain',
        fingerprintValue: 'buyer.example',
        maskedValue: 'buyer.example',
        accountName: 'Buyer Inc',
        normalizedName: 'buyer inc',
        country: 'AE',
        sourceAccountId: 'account-1',
        sourceContactId: null,
        sourceTaskId: 'task-1',
        archiveReason: 'Not a fit',
        archivedAt
      });

      assert.equal(record.fingerprintValue, 'buyer.example');
      assert.deepEqual(prisma.crmArchivedFingerprint.upsertCalls[0], {
        where: {
          organizationId_fingerprintType_fingerprintValue: {
            organizationId: 'org-1',
            fingerprintType: 'domain',
            fingerprintValue: 'buyer.example'
          }
        },
        create: {
          organizationId: 'org-1',
          fingerprintType: 'domain',
          fingerprintValue: 'buyer.example',
          maskedValue: 'buyer.example',
          accountName: 'Buyer Inc',
          normalizedName: 'buyer inc',
          country: 'AE',
          sourceAccountId: 'account-1',
          sourceContactId: null,
          sourceTaskId: 'task-1',
          archiveReason: 'Not a fit',
          archivedAt
        },
        update: {
          maskedValue: 'buyer.example',
          accountName: 'Buyer Inc',
          normalizedName: 'buyer inc',
          country: 'AE',
          sourceAccountId: 'account-1',
          sourceContactId: null,
          sourceTaskId: 'task-1',
          archiveReason: 'Not a fit',
          archivedAt
        }
      });
    });
  });

  describe('contacts and account detail', () => {
    it('loads account detail with member owner scope and newest timeline first', async () => {
      const prisma = createPrisma();
      const store = new PrismaCrmAccountStore(prisma as never);

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
      const store = new PrismaCrmAccountStore(prisma as never);

      await store.getAccountDetail({
        id: 'account-1',
        organizationId: 'org-1'
      });

      assert.deepEqual(prisma.crmAccount.findFirstCalls[0].where, {
        id: 'account-1',
        organizationId: 'org-1'
      });
    });

    it('adds contact email progress to account detail and prioritizes customer replies', async () => {
      const lastInboundAt = new Date('2026-06-24T07:58:12.000Z');
      const prisma = createPrisma({
        messages: [
          createPrismaMessage({
            id: 'message-queued',
            status: 'queued',
            scheduledAt: new Date('2026-06-24T08:20:00.000Z')
          })
        ],
        inboxThreads: [createPrismaInboxThread({ lastInboundAt })]
      });
      const store = new PrismaCrmAccountStore(prisma as never);

      const detail = await store.getAccountDetail({
        id: 'account-1',
        organizationId: 'org-1',
        ownerUserId: 'user-1'
      });

      assert.equal(detail?.contacts[0].emailProgressStatus, 'replied');
      assert.equal(detail?.contacts[0].emailProgressLabel, '客户已回复');
      assert.equal(detail?.contacts[0].emailProgressAt, lastInboundAt);
      assert.equal(detail?.contacts[0].emailProgressMessageId, null);
    });

    it('loads contacts with organization and optional owner scope', async () => {
      const prisma = createPrisma();
      const store = new PrismaCrmAccountStore(prisma as never);

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
      const store = new PrismaCrmAccountStore(prisma as never);

      const contact = await store.updateContactEmailStatus('contact-1', 'valid');

      assert.equal(contact?.emailStatus, 'valid');
      assert.deepEqual(prisma.crmContact.updateManyAndReturnCalls[0], {
        where: { id: 'contact-1' },
        data: { emailStatus: 'valid' },
        limit: 1
      });
    });
  });
});

/** Creates the smallest Prisma surface needed by the account store tests. */
function createPrisma(
  options: {
    account?: ReturnType<typeof createPrismaAccount> | null;
    archivedFingerprintResults?: ReturnType<typeof createPrismaArchivedFingerprint>[];
    contact?: ReturnType<typeof createPrismaContact> | null;
    enrichmentHistories?: ReturnType<typeof createPrismaLeadEnrichmentHistory>[];
    inboxThreads?: ReturnType<typeof createPrismaInboxThread>[];
    messages?: ReturnType<typeof createPrismaMessage>[];
    timelineEvents?: ReturnType<typeof createPrismaTimelineEvent>[];
  } = {}
) {
  const account = options.account ?? createPrismaAccount();
  const contact = options.contact ?? createPrismaContact();
  const emailVerificationCache = createPrismaEmailVerificationCache();
  const archivedFingerprint = createPrismaArchivedFingerprint();
  const enrichmentHistories = options.enrichmentHistories ?? [];
  const messages = options.messages ?? [];
  const inboxThreads = options.inboxThreads ?? [];
  const timelineEvents = options.timelineEvents ?? [
    createPrismaTimelineEvent({
      id: 'timeline-new',
      title: 'Newest event',
      createdAt: new Date('2026-06-18T10:00:00.000Z')
    }),
    createPrismaTimelineEvent({
      id: 'timeline-old',
      title: 'Old event',
      createdAt: new Date('2026-06-18T09:00:00.000Z')
    })
  ];

  return {
    crmAccount: {
      createCalls: [] as Array<{ data: Record<string, unknown> }>,
      findUniqueCalls: [] as Array<{ where: Record<string, unknown> }>,
      findFirstCalls: [] as Array<{ where: Record<string, unknown> }>,
      findManyCalls: [] as Array<{
        where: Record<string, unknown>;
        include?: Record<string, unknown>;
        skip: number;
        take: number;
        orderBy: Record<string, unknown>;
      }>,
      countCalls: [] as Array<{ where: Record<string, unknown> }>,
      createError: null as Error | null,
      async create(args: { data: Record<string, unknown> }) {
        this.createCalls.push(args);
        if (this.createError) throw this.createError;
        return { ...account, ...args.data };
      },
      async findUnique(args: { where: Record<string, unknown> }) {
        this.findUniqueCalls.push(args);
        return account;
      },
      async findFirst(args: { where: Record<string, unknown> }) {
        this.findFirstCalls.push(args);
        return account;
      },
      async findMany(args: {
        where: Record<string, unknown>;
        include?: Record<string, unknown>;
        skip: number;
        take: number;
        orderBy: Record<string, unknown>;
      }) {
        this.findManyCalls.push(args);
        return account
          ? [{ ...account, _count: { contacts: contact ? 1 : 0 }, contacts: contact ? [contact] : [] }]
          : [];
      },
      async count(args: { where: Record<string, unknown> }) {
        this.countCalls.push(args);
        return account ? 1 : 0;
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
        return contact ? [contact] : [];
      },
      async findFirst(args: { where: Record<string, unknown> }) {
        this.findFirstCalls.push(args);
        return contact;
      },
      async updateManyAndReturn(args: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
        limit: number;
      }) {
        this.updateManyAndReturnCalls.push(args);
        return contact ? [{ ...contact, ...args.data, updatedAt: new Date('2026-06-18T10:00:00.000Z') }] : [];
      }
    },
    crmEmailVerificationCache: {
      findUniqueCalls: [] as Array<{ where: Record<string, unknown> }>,
      upsertCalls: [] as Array<{
        where: Record<string, unknown>;
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }>,
      async findUnique(args: { where: Record<string, unknown> }) {
        this.findUniqueCalls.push(args);
        return emailVerificationCache;
      },
      async upsert(args: {
        where: Record<string, unknown>;
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }) {
        this.upsertCalls.push(args);
        return { ...emailVerificationCache, ...args.create, ...args.update };
      }
    },
    crmArchivedFingerprint: {
      findManyCalls: [] as Array<{ where: Record<string, unknown>; orderBy: Record<string, unknown> }>,
      upsertCalls: [] as Array<{
        where: Record<string, unknown>;
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }>,
      async findMany(args: { where: Record<string, unknown>; orderBy: Record<string, unknown> }) {
        this.findManyCalls.push(args);
        return options.archivedFingerprintResults ?? [archivedFingerprint];
      },
      async upsert(args: {
        where: Record<string, unknown>;
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }) {
        this.upsertCalls.push(args);
        return { ...archivedFingerprint, ...args.create, ...args.update };
      }
    },
    crmLeadEnrichmentHistory: {
      findManyCalls: [] as Array<{ where: Record<string, unknown>; orderBy?: Record<string, unknown> }>,
      upsertCalls: [] as Array<{
        where: Record<string, unknown>;
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }>,
      async findMany(args: { where: Record<string, unknown>; orderBy?: Record<string, unknown> }) {
        this.findManyCalls.push(args);
        return enrichmentHistories;
      },
      async upsert(args: {
        where: Record<string, unknown>;
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }) {
        this.upsertCalls.push(args);
        return { ...createPrismaLeadEnrichmentHistory(), ...args.create, ...args.update };
      }
    },
    crmMessage: {
      findManyCalls: [] as Array<{
        where: Record<string, unknown>;
        select: Record<string, unknown>;
        orderBy: Array<Record<string, unknown>>;
      }>,
      async findMany(args: {
        where: Record<string, unknown>;
        select: Record<string, unknown>;
        orderBy: Array<Record<string, unknown>>;
      }) {
        this.findManyCalls.push(args);
        return messages;
      }
    },
    crmInboxThread: {
      findManyCalls: [] as Array<{
        where: Record<string, unknown>;
        select: Record<string, unknown>;
        orderBy: Record<string, unknown>;
      }>,
      async findMany(args: {
        where: Record<string, unknown>;
        select: Record<string, unknown>;
        orderBy: Record<string, unknown>;
      }) {
        this.findManyCalls.push(args);
        return inboxThreads;
      }
    },
    crmTimelineEvent: {
      findManyCalls: [] as Array<{ where: Record<string, unknown>; orderBy: Record<string, unknown> }>,
      async findMany(args: { where: Record<string, unknown>; orderBy: Record<string, unknown> }) {
        this.findManyCalls.push(args);
        return timelineEvents;
      }
    }
  };
}

function createPrismaLeadEnrichmentHistory(input: Record<string, unknown> = {}) {
  return {
    id: 'history-1',
    organizationId: 'org-1',
    ownerUserId: 'user-1',
    accountId: 'account-1',
    contactId: 'contact-1',
    provider: 'hunter',
    identityType: 'domain',
    identityValue: 'abc.example',
    status: 'success',
    lastAttemptedAt: new Date('2026-06-18T09:00:00.000Z'),
    lastSucceededAt: new Date('2026-06-18T09:00:00.000Z'),
    maskedEmail: 'a***@example.com',
    errorMessage: null,
    createdAt: new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: new Date('2026-06-18T09:00:00.000Z'),
    ...input
  };
}

function createPrismaAccount(input: Record<string, unknown> = {}) {
  return {
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
    updatedAt: new Date('2026-06-18T09:00:00.000Z'),
    ...input
  };
}

function createPrismaContact(input: Record<string, unknown> = {}) {
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
    updatedAt: new Date('2026-06-18T09:00:00.000Z'),
    ...input
  };
}

function createPrismaEmailVerificationCache(input: Record<string, unknown> = {}) {
  return {
    emailHash: 'email-hash-1',
    maskedEmail: 'a***@example.com',
    domain: 'example.com',
    status: 'valid',
    reason: 'mx_found',
    verifiedAt: new Date('2026-06-18T09:00:00.000Z'),
    expiresAt: new Date('2026-07-18T09:00:00.000Z'),
    checkedById: 'user-1',
    checkedByName: 'Alice',
    createdAt: new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: new Date('2026-06-18T09:00:00.000Z'),
    ...input
  };
}

function createPrismaMessage(input: Record<string, unknown> = {}) {
  return {
    id: 'message-1',
    contactId: 'contact-1',
    status: 'draft_ready',
    stepIndex: 1,
    scheduledAt: new Date('2026-06-24T08:20:00.000Z'),
    sentAt: null,
    updatedAt: new Date('2026-06-24T08:00:00.000Z'),
    enrollment: {
      totalSteps: 5
    },
    ...input
  };
}

function createPrismaInboxThread(input: Record<string, unknown> = {}) {
  return {
    contactId: 'contact-1',
    lastInboundAt: new Date('2026-06-24T07:58:12.000Z'),
    ...input
  };
}

function createPrismaArchivedFingerprint(input: Record<string, unknown> = {}) {
  return {
    id: 'archived-fingerprint-1',
    organizationId: 'org-1',
    fingerprintType: 'domain',
    fingerprintValue: 'buyer.example',
    maskedValue: 'buyer.example',
    accountName: 'Buyer Inc',
    normalizedName: 'buyer inc',
    country: 'AE',
    sourceAccountId: 'account-1',
    sourceContactId: null,
    sourceTaskId: 'task-1',
    archiveReason: 'Not a fit',
    archivedAt: new Date('2026-06-18T09:00:00.000Z'),
    createdAt: new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: new Date('2026-06-18T09:00:00.000Z'),
    ...input
  };
}

function createPrismaTimelineEvent(input: Record<string, unknown> = {}) {
  return {
    id: 'timeline-1',
    organizationId: 'org-1',
    accountId: 'account-1',
    contactId: 'contact-1',
    ownerUserId: 'user-1',
    eventType: 'note',
    title: 'Initial note',
    content: 'Imported from AI leads',
    metadata: null,
    createdAt: new Date('2026-06-18T09:00:00.000Z'),
    ...input
  };
}
