import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PrismaCrmSendSchedulerStore } from './prisma-crm-send-scheduler.store';

describe('PrismaCrmSendSchedulerStore', () => {
  it('batch loads owner send states with preferences and grouped message counts', async () => {
    const from = new Date('2026-06-20T00:00:00.000Z');
    const to = new Date('2026-06-21T00:00:00.000Z');
    const prisma = createPrisma({
      sendPreferences: [
        createPrismaSendPreference({
          organizationId: 'org-1',
          ownerUserId: 'user-1',
          dailySendLimit: 20,
          followUpSharePercent: 40
        })
      ],
      ownerQueuedRows: [{ organizationId: 'org-1', ownerUserId: 'user-1', _count: { _all: 4 } }],
      ownerDispatchedRows: [
        { organizationId: 'org-1', ownerUserId: 'user-1', stepIndex: 1, _count: { _all: 2 } },
        { organizationId: 'org-1', ownerUserId: 'user-1', stepIndex: 2, _count: { _all: 3 } }
      ]
    });
    const store = new PrismaCrmSendSchedulerStore(prisma as never);

    const result = await store.listOwnerSendStates({
      owners: [
        { organizationId: 'org-1', ownerUserId: 'user-1' },
        { organizationId: 'org-1', ownerUserId: 'user-2' },
        { organizationId: 'org-1', ownerUserId: 'user-1' }
      ],
      from,
      to
    });

    assert.deepEqual(
      result.map(item => ({
        ownerUserId: item.ownerUserId,
        dailyLimit: item.preference?.dailySendLimit ?? null,
        queuedCount: item.queuedCount,
        dailyCount: item.dailyCount,
        firstTouchCount: item.firstTouchCount,
        followUpCount: item.followUpCount
      })),
      [
        {
          ownerUserId: 'user-1',
          dailyLimit: 20,
          queuedCount: 4,
          dailyCount: 5,
          firstTouchCount: 2,
          followUpCount: 3
        },
        {
          ownerUserId: 'user-2',
          dailyLimit: null,
          queuedCount: 0,
          dailyCount: 0,
          firstTouchCount: 0,
          followUpCount: 0
        }
      ]
    );
    assert.deepEqual(prisma.crmUserSendPreference.findManyCalls[0].where, {
      OR: [
        { organizationId: 'org-1', ownerUserId: 'user-1' },
        { organizationId: 'org-1', ownerUserId: 'user-2' }
      ]
    });
    assert.deepEqual(
      prisma.crmMessage.groupByCalls.map(call => call.by),
      [
        ['organizationId', 'ownerUserId'],
        ['organizationId', 'ownerUserId', 'stepIndex']
      ]
    );
  });

  it('batch loads mailbox send states with daily and hourly grouped counts', async () => {
    const day = {
      from: new Date('2026-06-20T00:00:00.000Z'),
      to: new Date('2026-06-21T00:00:00.000Z')
    };
    const hour = {
      from: new Date('2026-06-20T10:00:00.000Z'),
      to: new Date('2026-06-20T11:00:00.000Z')
    };
    const prisma = createPrisma({
      mailboxDailyRows: [{ organizationId: 'org-1', mailboxId: 'mailbox-1', _count: { _all: 8 } }],
      mailboxHourlyRows: [{ organizationId: 'org-1', mailboxId: 'mailbox-1', _count: { _all: 2 } }]
    });
    const store = new PrismaCrmSendSchedulerStore(prisma as never);

    const result = await store.listMailboxSendStates({
      mailboxes: [
        { organizationId: 'org-1', mailboxId: 'mailbox-1' },
        { organizationId: 'org-1', mailboxId: 'mailbox-2' },
        { organizationId: 'org-1', mailboxId: 'mailbox-1' }
      ],
      day,
      hour
    });

    assert.deepEqual(result, [
      {
        organizationId: 'org-1',
        mailboxId: 'mailbox-1',
        dailyCount: 8,
        hourlyCount: 2
      },
      {
        organizationId: 'org-1',
        mailboxId: 'mailbox-2',
        dailyCount: 0,
        hourlyCount: 0
      }
    ]);
    assert.deepEqual(
      prisma.crmMessage.groupByCalls.slice(-2).map(call => call.by),
      [
        ['organizationId', 'mailboxId'],
        ['organizationId', 'mailboxId']
      ]
    );
    assert.deepEqual(prisma.crmMessage.groupByCalls.at(-2)?.where, {
      AND: [
        {
          OR: [
            { organizationId: 'org-1', mailboxId: 'mailbox-1' },
            { organizationId: 'org-1', mailboxId: 'mailbox-2' }
          ]
        },
        {
          OR: [
            { status: 'queued', scheduledAt: { gte: day.from, lt: day.to } },
            { status: 'sent', sentAt: { gte: day.from, lt: day.to } }
          ]
        }
      ]
    });
  });

  it('pushes due send candidate guards into the Prisma query', async () => {
    const prisma = createPrisma({
      message: createPrismaMessage({
        id: 'message-due',
        status: 'draft_ready',
        mailboxId: 'mailbox-1',
        scheduledAt: new Date('2026-06-18T10:00:00.000Z')
      })
    });
    const store = new PrismaCrmSendSchedulerStore(prisma as never);
    const now = new Date('2026-06-18T10:30:00.000Z');

    await store.listDueSendCandidates({ now, take: 50 });

    assert.deepEqual(prisma.crmMessage.findManyCalls[0].where, {
      status: 'draft_ready',
      scheduledAt: {
        lte: now
      },
      mailboxId: {
        not: null
      },
      mailbox: {
        is: {
          status: 'active'
        }
      },
      enrollment: {
        status: 'sequence_running'
      },
      contact: {
        emailStatus: {
          not: 'unsubscribed'
        }
      }
    });
  });

  it('batch loads blacklists for due send candidates without per-candidate lookups', async () => {
    const now = new Date('2026-06-18T10:30:00.000Z');
    const prisma = createPrisma({
      blacklistFindManyResults: [
        createPrismaBlacklist({
          organizationId: 'org-1',
          emailHash: 'hash-1'
        })
      ],
      messages: [
        createPrismaMessage({
          id: 'message-blacklisted',
          organizationId: 'org-1',
          contactId: 'contact-1',
          contactEmailHash: 'hash-1',
          status: 'draft_ready',
          mailboxId: 'mailbox-1',
          scheduledAt: new Date('2026-06-18T10:00:00.000Z')
        }),
        createPrismaMessage({
          id: 'message-sendable',
          organizationId: 'org-2',
          contactId: 'contact-2',
          contactEmailHash: 'hash-2',
          status: 'draft_ready',
          mailboxId: 'mailbox-2',
          scheduledAt: new Date('2026-06-18T10:05:00.000Z')
        })
      ]
    });
    const store = new PrismaCrmSendSchedulerStore(prisma as never);

    const result = await store.listDueSendCandidates({ now, take: 50 });

    assert.deepEqual(
      result.map(item => item.message.id),
      ['message-sendable']
    );
    assert.equal(prisma.crmBlacklist.findUniqueCalls.length, 0);
    assert.deepEqual(prisma.crmBlacklist.findManyCalls.at(-1), {
      where: {
        OR: [
          { organizationId: 'org-1', emailHash: 'hash-1' },
          { organizationId: 'org-2', emailHash: 'hash-2' }
        ]
      },
      select: {
        organizationId: true,
        emailHash: true
      }
    });
  });

  it('updates a message with the scheduler status guard', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmSendSchedulerStore(prisma as never);

    const result = await store.updateMessage(
      'message-1',
      'org-1',
      { status: 'queued', bullJobId: 'crm-send:message-1:1' },
      { status: 'draft_ready' }
    );

    assert.equal(result?.status, 'queued');
    assert.deepEqual(prisma.crmMessage.updateManyAndReturnCalls[0], {
      where: {
        id: 'message-1',
        organizationId: 'org-1',
        status: 'draft_ready'
      },
      data: {
        status: 'queued',
        bullJobId: 'crm-send:message-1:1'
      },
      limit: 1
    });
  });
});

function createPrisma(
  options: {
    message?: ReturnType<typeof createPrismaMessage>;
    messages?: Array<ReturnType<typeof createPrismaMessage>>;
    sendPreferences?: Array<ReturnType<typeof createPrismaSendPreference>>;
    ownerQueuedRows?: Array<{
      organizationId: string;
      ownerUserId: string;
      _count: { _all: number };
    }>;
    ownerDispatchedRows?: Array<{
      organizationId: string;
      ownerUserId: string;
      stepIndex: number;
      _count: { _all: number };
    }>;
    mailboxDailyRows?: Array<{
      organizationId: string;
      mailboxId: string;
      _count: { _all: number };
    }>;
    mailboxHourlyRows?: Array<{
      organizationId: string;
      mailboxId: string;
      _count: { _all: number };
    }>;
    blacklistFindManyResults?: ReturnType<typeof createPrismaBlacklist>[];
  } = {}
) {
  const account = createPrismaAccount();
  const contact = createPrismaContact();
  const mailbox = createPrismaMailbox();
  const productLine = createPrismaProductLine();
  const enrollment = createPrismaEnrollment({ productLine });
  const message = options.message ?? createPrismaMessage();
  const messages = options.messages ?? [message];
  const sendPreferences = options.sendPreferences ?? [createPrismaSendPreference()];

  function attachMessageRelations(item: ReturnType<typeof createPrismaMessage>) {
    return {
      ...item,
      account: {
        ...account,
        id: item.accountId,
        organizationId: item.organizationId,
        ownerUserId: item.ownerUserId
      },
      contact: {
        ...contact,
        id: item.contactId,
        organizationId: item.organizationId,
        ownerUserId: item.ownerUserId,
        emailHash: typeof item.contactEmailHash === 'string' ? item.contactEmailHash : contact.emailHash
      },
      mailbox: {
        ...mailbox,
        id: item.mailboxId,
        organizationId: item.organizationId,
        ownerUserId: item.ownerUserId
      },
      enrollment: {
        ...enrollment,
        id: item.enrollmentId,
        organizationId: item.organizationId,
        ownerUserId: item.ownerUserId,
        accountId: item.accountId,
        contactId: item.contactId,
        mailboxId: item.mailboxId,
        status: 'sequence_running',
        productLine
      }
    };
  }

  return {
    crmGlobalConfig: {
      findUniqueCalls: [] as Array<{ where: Record<string, unknown> }>,
      async findUnique(args: { where: Record<string, unknown> }) {
        this.findUniqueCalls.push(args);
        return null;
      }
    },
    crmUserSendPreference: {
      findManyCalls: [] as Array<{ where: Record<string, unknown> }>,
      async findMany(args: { where: Record<string, unknown> }) {
        this.findManyCalls.push(args);
        return sendPreferences;
      }
    },
    crmBlacklist: {
      findUniqueCalls: [] as Array<{ where: Record<string, unknown> }>,
      findManyCalls: [] as Array<{
        where: Record<string, unknown>;
        select?: Record<string, unknown>;
      }>,
      async findMany(args: { where: Record<string, unknown>; select?: Record<string, unknown> }) {
        this.findManyCalls.push(args);

        return options.blacklistFindManyResults ?? [];
      }
    },
    crmMessage: {
      findManyCalls: [] as Array<{
        where: Record<string, unknown>;
        orderBy?: Array<Record<string, unknown>>;
        take?: number;
      }>,
      groupByCalls: [] as Array<{
        by: string[];
        where: Record<string, unknown>;
        _count: Record<string, unknown>;
      }>,
      updateManyAndReturnCalls: [] as Array<{
        where: Record<string, unknown>;
        data: Record<string, unknown>;
        limit?: number;
      }>,
      async findMany(args: {
        where: Record<string, unknown>;
        orderBy?: Array<Record<string, unknown>>;
        take?: number;
      }) {
        this.findManyCalls.push(args);
        return messages.map(item => attachMessageRelations(item));
      },
      async groupBy(args: { by: string[]; where: Record<string, unknown>; _count: Record<string, unknown> }) {
        this.groupByCalls.push(args);
        if (args.by.includes('mailboxId')) {
          const mailboxGroupByCalls = this.groupByCalls.filter(call => call.by.includes('mailboxId')).length;

          return mailboxGroupByCalls === 1 ? (options.mailboxDailyRows ?? []) : (options.mailboxHourlyRows ?? []);
        }

        if (args.by.includes('stepIndex')) {
          return options.ownerDispatchedRows ?? [];
        }

        return options.ownerQueuedRows ?? [];
      },
      async updateManyAndReturn(args: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
        limit?: number;
      }) {
        this.updateManyAndReturnCalls.push(args);

        return [{ ...message, ...args.data, updatedAt: new Date('2026-06-18T10:00:00.000Z') }];
      }
    }
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
    status: 'sequence_running',
    sourceTaskId: null,
    archivedAt: null,
    archiveReason: null,
    archiveSlimmedAt: null,
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
    emailStatus: 'valid',
    sourceTaskId: null,
    createdAt: new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: new Date('2026-06-18T09:00:00.000Z'),
    ...input
  };
}

function createPrismaMailbox(input: Record<string, unknown> = {}) {
  return {
    id: 'mailbox-1',
    organizationId: 'org-1',
    ownerUserId: 'user-1',
    ownerUserName: 'Alice',
    provider: 'gmail',
    emailAddress: 'alice@gmail.com',
    emailHash: 'mailbox-hash',
    maskedEmail: 'a***@gmail.com',
    status: 'active',
    dailyLimit: 50,
    hourlyLimit: 10,
    warmupStage: 'ready',
    encryptedRefreshToken: null,
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

function createPrismaProductLine(input: Record<string, unknown> = {}) {
  return {
    id: 'product-line-1',
    organizationId: 'org-1',
    name: 'Bearing Series',
    targetCustomerType: 'distributor',
    coreSellingPoints: 'Stable supply',
    moq: '100 pcs',
    leadTime: '15 days',
    paymentTerms: 'T/T',
    certifications: 'ISO 9001',
    catalogUrl: null,
    websiteUrl: null,
    commonModelsText: '6204, 6205',
    aiWritingConfig: null,
    status: 'active',
    createdById: 'user-1',
    createdByName: 'Alice',
    createdAt: new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: new Date('2026-06-18T09:00:00.000Z'),
    ...input
  };
}

function createPrismaEnrollment(input: Record<string, unknown> = {}) {
  return {
    id: 'enrollment-1',
    organizationId: 'org-1',
    ownerUserId: 'user-1',
    accountId: 'account-1',
    contactId: 'contact-1',
    productLineId: 'product-line-1',
    mailboxId: 'mailbox-1',
    policyId: null,
    name: 'ABC Trading - Ali Hassan',
    status: 'sequence_running',
    currentStep: 1,
    totalSteps: 5,
    runVersion: 1,
    createdById: 'user-1',
    createdByName: 'Alice',
    createdAt: new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: new Date('2026-06-18T09:00:00.000Z'),
    ...input
  };
}

function createPrismaMessage(input: Record<string, unknown> = {}) {
  return {
    id: 'message-1',
    organizationId: 'org-1',
    ownerUserId: 'user-1',
    accountId: 'account-1',
    contactId: 'contact-1',
    enrollmentId: 'enrollment-1',
    mailboxId: 'mailbox-1',
    stepIndex: 1,
    threadMode: 'new_subject',
    subject: 'Bearing Series for ABC Trading',
    bodyText: 'Hi Ali',
    status: 'draft_ready',
    scheduledAt: null,
    sentAt: null,
    bullJobId: null,
    providerMessageId: null,
    providerThreadId: null,
    metadata: null,
    contactEmailHash: undefined,
    createdAt: new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: new Date('2026-06-18T09:00:00.000Z'),
    ...input
  };
}

function createPrismaSendPreference(input: Record<string, unknown> = {}) {
  return {
    id: 'send-preference-1',
    organizationId: 'org-1',
    ownerUserId: 'user-1',
    ownerUserName: 'Alice',
    dailySendLimit: 50,
    followUpSharePercent: 70,
    updatedById: 'user-1',
    updatedByName: 'Alice',
    createdAt: new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: new Date('2026-06-18T09:00:00.000Z'),
    ...input
  };
}

function createPrismaBlacklist(input: Record<string, unknown> = {}) {
  return {
    id: 'blacklist-1',
    organizationId: 'org-1',
    emailHash: 'hash-1',
    maskedEmail: 'a***@example.com',
    reason: 'unsubscribe',
    sourceAccountId: 'account-1',
    sourceContactId: 'contact-1',
    sourceMessageId: 'inbox-message-1',
    createdById: 'user-1',
    createdByName: 'Alice',
    createdAt: new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: new Date('2026-06-18T09:00:00.000Z'),
    ...input
  };
}
