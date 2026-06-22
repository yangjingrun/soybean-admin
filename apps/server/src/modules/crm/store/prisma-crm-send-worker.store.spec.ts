import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PrismaCrmSendWorkerStore } from './prisma-crm-send-worker.store';

describe('PrismaCrmSendWorkerStore', () => {
  it('starts first message sending with enrollment and message status guards', async () => {
    const prisma = createPrm();
    const store = new PrismaCrmSendWorkerStore(prisma as never);

    const result = await store.startFirstMessageSend({
      enrollmentId: 'enrollment-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      fromEnrollmentStatus: 'ready_to_send',
      toEnrollmentStatus: 'sequence_running',
      fromMessageStatus: 'draft_ready',
      toMessageStatus: 'queued',
      accountStatus: 'sequence_running',
      scheduledAt: new Date('2026-06-18T10:00:00.000Z')
    });

    assert.equal(result?.message.status, 'queued');
    assert.deepEqual(prisma.crmSequenceEnrollment.updateManyAndReturnCalls[0].where, {
      id: 'enrollment-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      status: 'ready_to_send'
    });
    assert.deepEqual(prisma.crmMessage.updateManyAndReturnCalls[0].where, {
      enrollmentId: 'enrollment-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      stepIndex: 1,
      status: 'draft_ready'
    });
    assert.equal(prisma.crmTimelineEvent.createCalls.at(-1)?.data.eventType, 'message_send_scheduled');
  });

  it('does not mutate sending state when active mailbox guard fails inside transaction', async () => {
    const prisma = createPrm();
    const store = new PrismaCrmSendWorkerStore(prisma as never);
    prisma.crmMailbox.findUniqueResult = { status: 'paused' };

    const result = await store.startFirstMessageSend({
      enrollmentId: 'enrollment-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      fromEnrollmentStatus: 'ready_to_send',
      toEnrollmentStatus: 'sequence_running',
      fromMessageStatus: 'draft_ready',
      toMessageStatus: 'queued',
      accountStatus: 'sequence_running',
      scheduledAt: new Date('2026-06-18T10:00:00.000Z')
    });

    assert.equal(result, null);
    assert.equal(prisma.crmSequenceEnrollment.updateManyAndReturnCalls.length, 0);
    assert.equal(prisma.crmMessage.updateManyAndReturnCalls.length, 0);
    assert.equal(prisma.crmTimelineEvent.createCalls.length, 0);
  });

  it('claims queued first message delivery by reserving daily and hourly mailbox quota', async () => {
    const prisma = createPrm();
    const store = new PrismaCrmSendWorkerStore(prisma as never);

    const result = await store.claimFirstMessageSendDelivery({
      enrollmentId: 'enrollment-1',
      messageId: 'message-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      runVersion: 1,
      claimedAt: new Date('2026-06-18T10:30:00.000Z')
    });

    assert.equal(result?.firstMessage.id, 'message-1');
    assert.deepEqual(
      prisma.crmMailboxSendUsage.createCalls.map(call => call.data),
      [
        {
          organizationId: 'org-1',
          mailboxId: 'mailbox-1',
          bucketType: 'daily',
          bucketKey: '2026-06-18',
          usedCount: 1
        },
        {
          organizationId: 'org-1',
          mailboxId: 'mailbox-1',
          bucketType: 'hourly',
          bucketKey: '2026-06-18T10',
          usedCount: 1
        }
      ]
    );
  });

  it('skips queued delivery and stops the sequence when the contact is organization blacklisted', async () => {
    const prisma = createPrm({ blacklistEntry: createPrismaBlacklist() });
    const store = new PrismaCrmSendWorkerStore(prisma as never);

    const result = await store.claimFirstMessageSendDelivery({
      enrollmentId: 'enrollment-1',
      messageId: 'message-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      runVersion: 1,
      claimedAt: new Date('2026-06-18T10:30:00.000Z')
    });

    assert.equal(result, null);
    assert.equal(prisma.crmMailboxSendUsage.createCalls.length, 0);
    assert.deepEqual(prisma.crmSequenceEnrollment.updateManyCalls.at(-1), {
      where: {
        id: 'enrollment-1',
        organizationId: 'org-1',
        ownerUserId: 'user-1',
        runVersion: 1,
        status: 'sequence_running'
      },
      data: {
        status: 'stopped',
        runVersion: { increment: 1 }
      }
    });
    assert.deepEqual(prisma.crmMessage.updateManyCalls.at(-1), {
      where: {
        id: 'message-1',
        organizationId: 'org-1',
        ownerUserId: 'user-1',
        status: 'queued'
      },
      data: {
        status: 'skipped',
        bullJobId: null
      }
    });
  });

  it('claims queued follow-up delivery by the job message id instead of the first step', async () => {
    const prisma = createPrm({
      sequenceReviewMessages: [
        createPrismaMessage({ id: 'message-1', status: 'sent', stepIndex: 1 }),
        createPrismaMessage({ id: 'message-2', status: 'queued', stepIndex: 2, threadMode: 'same_thread' })
      ]
    });
    const store = new PrismaCrmSendWorkerStore(prisma as never);

    const result = await store.claimFirstMessageSendDelivery({
      enrollmentId: 'enrollment-1',
      messageId: 'message-2',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      runVersion: 1,
      claimedAt: new Date('2026-06-21T10:30:00.000Z')
    });

    assert.equal(result?.firstMessage.id, 'message-2');
    assert.equal(result?.firstMessage.stepIndex, 2);
  });

  it('finds queued message send target without reserving mailbox quota', async () => {
    const prisma = createPrm();
    const store = new PrismaCrmSendWorkerStore(prisma as never);

    const result = await store.findQueuedMessageSendTarget({
      enrollmentId: 'enrollment-1',
      messageId: 'message-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      runVersion: 1
    });

    assert.equal(result?.firstMessage.id, 'message-1');
    assert.equal(prisma.crmMailboxSendUsage.updateManyCalls.length, 0);
    assert.equal(prisma.crmMailboxSendUsage.createCalls.length, 0);
  });

  it('defers a queued message back to draft_ready with a guarded scheduledAt update', async () => {
    const prisma = createPrm();
    const store = new PrismaCrmSendWorkerStore(prisma as never);
    const scheduledAt = new Date('2026-06-20T13:30:00.000Z');

    const result = await store.deferQueuedMessageSend({
      enrollmentId: 'enrollment-1',
      messageId: 'message-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      runVersion: 1,
      scheduledAt
    });

    assert.equal(result?.status, 'draft_ready');
    assert.deepEqual(prisma.crmMessage.updateManyAndReturnCalls.at(-1)?.data, {
      status: 'draft_ready',
      bullJobId: null,
      scheduledAt
    });
  });

  it('does not claim queued first message delivery when mailbox quota is exhausted', async () => {
    const prisma = createPrm();
    const store = new PrismaCrmSendWorkerStore(prisma as never);
    prisma.crmMailboxSendUsage.updateManyResultCount = 0;
    prisma.crmMailboxSendUsage.findUniqueResult = {
      id: 'usage-1',
      organizationId: 'org-1',
      mailboxId: 'mailbox-1',
      bucketType: 'daily',
      bucketKey: '2026-06-18',
      usedCount: 50,
      createdAt: new Date('2026-06-18T00:00:00.000Z'),
      updatedAt: new Date('2026-06-18T00:00:00.000Z')
    };

    const result = await store.claimFirstMessageSendDelivery({
      enrollmentId: 'enrollment-1',
      messageId: 'message-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      runVersion: 1,
      claimedAt: new Date('2026-06-18T10:30:00.000Z')
    });

    assert.equal(result, null);
  });

  it('persists provider ids when completing first message send', async () => {
    const prisma = createPrm();
    const store = new PrismaCrmSendWorkerStore(prisma as never);
    const sentAt = new Date('2026-06-18T10:45:00.000Z');

    const result = await store.completeFirstMessageSend({
      enrollmentId: 'enrollment-1',
      messageId: 'message-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      runVersion: 1,
      sentAt,
      providerMessageId: 'gmail-message-1',
      providerThreadId: 'gmail-thread-1'
    });

    assert.equal(result?.message.status, 'sent');
    assert.deepEqual(prisma.crmMessage.updateManyAndReturnCalls.at(-1)?.data, {
      status: 'sent',
      sentAt,
      providerMessageId: 'gmail-message-1',
      providerThreadId: 'gmail-thread-1',
      recipientTimeZone: 'Asia/Dubai'
    });
  });

  it('creates only the next follow-up draft when completing first message send', async () => {
    const prisma = createPrm();
    const store = new PrismaCrmSendWorkerStore(prisma as never);
    const sentAt = new Date('2026-06-18T10:45:00.000Z');
    const scheduledAt = new Date('2026-06-21T10:45:00.000Z');

    const result = await store.completeFirstMessageSend({
      enrollmentId: 'enrollment-1',
      messageId: 'message-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      runVersion: 1,
      sentAt,
      providerMessageId: 'gmail-message-1',
      providerThreadId: 'gmail-thread-1',
      nextMessage: {
        organizationId: 'org-1',
        ownerUserId: 'user-1',
        accountId: 'account-1',
        contactId: 'contact-1',
        mailboxId: 'mailbox-1',
        stepIndex: 2,
        threadMode: 'same_thread',
        subject: 'Bearing Series for ABC Trading',
        bodyText: 'Hi Ali,\n\nJust following up.',
        status: 'draft_pending_review',
        scheduledAt,
        providerThreadId: 'gmail-thread-1'
      }
    });

    assert.equal(result?.nextMessage?.stepIndex, 2);
    assert.equal(prisma.crmMessage.createCalls.length, 1);
    assert.deepEqual(prisma.crmMessage.createCalls[0].data, {
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      accountId: 'account-1',
      contactId: 'contact-1',
      mailboxId: 'mailbox-1',
      stepIndex: 2,
      threadMode: 'same_thread',
      subject: 'Bearing Series for ABC Trading',
      bodyText: 'Hi Ali,\n\nJust following up.',
      status: 'draft_pending_review',
      scheduledAt,
      providerThreadId: 'gmail-thread-1',
      enrollmentId: 'enrollment-1'
    });
    assert.equal(prisma.crmTimelineEvent.createCalls.at(-1)?.data.eventType, 'message_sent');
    assert.deepEqual(prisma.crmTimelineEvent.createCalls.at(-1)?.data.metadata, {
      enrollmentId: 'enrollment-1',
      messageId: 'message-1',
      runVersion: 1,
      nextMessageId: 'message-2',
      nextStepIndex: 2
    });
  });

  it('reuses an existing local follow-up draft when completing first message send', async () => {
    const existingNextMessage = createPrismaMessage({
      id: 'message-local-2',
      stepIndex: 2,
      status: 'draft_ready',
      threadMode: 'same_thread',
      scheduledAt: new Date('2026-06-21T10:45:00.000Z')
    });
    const prisma = createPrm({ existingNextMessage });
    const store = new PrismaCrmSendWorkerStore(prisma as never);

    const result = await store.completeFirstMessageSend({
      enrollmentId: 'enrollment-1',
      messageId: 'message-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      runVersion: 1,
      sentAt: new Date('2026-06-18T10:45:00.000Z'),
      providerMessageId: 'gmail-message-1',
      providerThreadId: 'gmail-thread-1',
      nextMessage: {
        organizationId: 'org-1',
        ownerUserId: 'user-1',
        accountId: 'account-1',
        contactId: 'contact-1',
        mailboxId: 'mailbox-1',
        stepIndex: 2,
        threadMode: 'same_thread',
        subject: 'Bearing Series for ABC Trading',
        bodyText: 'Hi Ali,\n\nJust following up.',
        status: 'draft_pending_review',
        scheduledAt: new Date('2026-06-21T10:45:00.000Z'),
        providerThreadId: 'gmail-thread-1'
      }
    });

    assert.equal(result?.nextMessage?.id, 'message-local-2');
    assert.equal(prisma.crmMessage.createCalls.length, 0);
    assert.deepEqual(prisma.crmMessage.findFirstCalls.at(-1)?.where, {
      enrollmentId: 'enrollment-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      stepIndex: 2
    });
    const metadata = prisma.crmTimelineEvent.createCalls.at(-1)?.data.metadata as
      | { nextMessageId?: string }
      | undefined;
    assert.equal(metadata?.nextMessageId, 'message-local-2');
  });

  it('records the sent follow-up step when completing a later queued message', async () => {
    const prisma = createPrm({
      sentMessageResult: createPrismaMessage({
        id: 'message-2',
        status: 'queued',
        stepIndex: 2,
        threadMode: 'same_thread'
      })
    });
    const store = new PrismaCrmSendWorkerStore(prisma as never);
    const sentAt = new Date('2026-06-21T10:45:00.000Z');

    const result = await store.completeFirstMessageSend({
      enrollmentId: 'enrollment-1',
      messageId: 'message-2',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      runVersion: 1,
      sentAt,
      providerMessageId: 'gmail-message-2',
      providerThreadId: 'gmail-thread-1'
    });

    assert.equal(result?.message.stepIndex, 2);
    assert.deepEqual(prisma.crmSequenceEnrollment.updateManyAndReturnCalls[0].data, { currentStep: 2 });
  });
});

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
    status: 'draft_pending_review',
    scheduledAt: null,
    sentAt: null,
    bullJobId: null,
    providerMessageId: 'gmail-message-1',
    providerThreadId: null,
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

function createPrm(
  options: {
    blacklistEntry?: ReturnType<typeof createPrismaBlacklist> | null;
    existingNextMessage?: ReturnType<typeof createPrismaMessage> | null;
    sequenceReviewMessages?: ReturnType<typeof createPrismaMessage>[];
    sentMessageResult?: ReturnType<typeof createPrismaMessage>;
  } = {}
) {
  const account = {
    id: 'account-1',
    organizationId: 'org-1',
    ownerUserId: 'user-1',
    name: 'ABC Trading',
    normalizedName: 'abc trading',
    websiteUrl: 'https://abc.example',
    domain: 'abc.example',
    country: 'AE',
    city: 'Dubai',
    address: 'Sheikh Zayed Road',
    timeZone: 'Asia/Dubai',
    customerType: 'distributor',
    status: 'missing_contact',
    sourceTaskId: 'task-1',
    createdAt: new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: new Date('2026-06-18T09:00:00.000Z')
  };
  const contact = {
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
    encryptedRefreshToken: 'encrypted-refresh-token-1',
    watchExpiration: null,
    lastHistoryId: null,
    authorizedAt: new Date('2026-06-18T09:00:00.000Z'),
    pausedAt: null,
    createdAt: new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: new Date('2026-06-18T09:00:00.000Z')
  };
  const productLine = {
    id: 'product-line-1',
    organizationId: 'org-1',
    name: 'Bearing Series',
    targetCustomerType: 'distributor',
    coreSellingPoints: 'Stable supply',
    moq: '100 pcs',
    leadTime: '15 days',
    paymentTerms: 'T/T',
    certifications: 'ISO 9001',
    catalogUrl: '/catalog/bearing.pdf',
    websiteUrl: 'https://example.com/bearing',
    commonModelsText: '6204, 6205',
    aiWritingConfig: null,
    status: 'active',
    createdById: 'user-1',
    createdByName: 'Alice',
    createdAt: new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: new Date('2026-06-18T09:00:00.000Z')
  };
  const message = createPrismaMessage();
  const enrollment = {
    id: 'enrollment-1',
    organizationId: 'org-1',
    ownerUserId: 'user-1',
    accountId: 'account-1',
    contactId: 'contact-1',
    productLineId: 'product-line-1',
    mailboxId: 'mailbox-1',
    policyId: null,
    name: 'ABC Trading - Ali Hassan',
    status: 'draft_review_pending',
    currentStep: 1,
    totalSteps: 5,
    runVersion: 1,
    createdById: 'user-1',
    createdByName: 'Alice',
    createdAt: new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: new Date('2026-06-18T09:00:00.000Z'),
    account,
    contact,
    productLine,
    mailbox,
    policy: null,
    messages: [message]
  };

  return {
    transactionCalls: 0,
    async $transaction<T>(operation: (tx: unknown) => Promise<T>) {
      this.transactionCalls += 1;
      return operation(this);
    },
    crmAccount: {
      updateCalls: [] as Array<{ where: Record<string, unknown>; data: Record<string, unknown> }>,
      findUniqueCalls: [] as Array<{ where: Record<string, unknown>; select?: Record<string, unknown> }>,
      async findUnique(args: { where: Record<string, unknown>; select?: Record<string, unknown> }) {
        this.findUniqueCalls.push(args);
        return args.select ? { timeZone: account.timeZone } : account;
      },
      async update(args: { where: Record<string, unknown>; data: Record<string, unknown> }) {
        this.updateCalls.push(args);
        return { ...account, ...args.data, updatedAt: new Date('2026-06-18T10:00:00.000Z') };
      }
    },
    crmBlacklist: {
      findUniqueCalls: [] as Array<{ where: Record<string, unknown> }>,
      findUniqueResult: options.blacklistEntry ?? null,
      async findUnique(args: { where: Record<string, unknown> }) {
        this.findUniqueCalls.push(args);
        return this.findUniqueResult;
      }
    },
    crmContact: {
      findUniqueCalls: [] as Array<{ where: Record<string, unknown> }>,
      async findUnique(args: { where: Record<string, unknown> }) {
        this.findUniqueCalls.push(args);
        return contact;
      }
    },
    crmMailbox: {
      findUniqueCalls: [] as Array<{ where: Record<string, unknown> }>,
      findUniqueResult: null as Partial<typeof mailbox> | null,
      async findUnique(args: { where: Record<string, unknown> }) {
        this.findUniqueCalls.push(args);
        return this.findUniqueResult ? { ...mailbox, ...this.findUniqueResult } : mailbox;
      }
    },
    crmMailboxSendUsage: {
      createCalls: [] as Array<{ data: Record<string, unknown> }>,
      findUniqueCalls: [] as Array<{ where: Record<string, unknown> }>,
      updateManyCalls: [] as Array<{ where: Record<string, unknown>; data: Record<string, unknown> }>,
      updateManyResultCount: 0,
      findUniqueResult: null as Record<string, unknown> | null,
      async updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }) {
        this.updateManyCalls.push(args);
        return { count: this.updateManyResultCount };
      },
      async findUnique(args: { where: Record<string, unknown> }) {
        this.findUniqueCalls.push(args);
        return this.findUniqueResult;
      },
      async create(args: { data: Record<string, unknown> }) {
        this.createCalls.push(args);
        return {
          id: `usage-${this.createCalls.length}`,
          ...args.data,
          createdAt: new Date('2026-06-18T10:00:00.000Z'),
          updatedAt: new Date('2026-06-18T10:00:00.000Z')
        };
      }
    },
    crmMessage: {
      createCalls: [] as Array<{ data: Record<string, unknown> }>,
      findFirstCalls: [] as Array<{ where: Record<string, unknown>; include?: Record<string, unknown> }>,
      updateManyAndReturnCalls: [] as Array<{
        where: Record<string, unknown>;
        data: Record<string, unknown>;
        limit?: number;
      }>,
      updateManyCalls: [] as Array<{ where: Record<string, unknown>; data: Record<string, unknown> }>,
      async create(args: { data: Record<string, unknown> }) {
        this.createCalls.push(args);
        return createPrismaMessage({
          ...args.data,
          id: `message-${this.createCalls.length + 1}`,
          createdAt: new Date('2026-06-18T10:00:00.000Z'),
          updatedAt: new Date('2026-06-18T10:00:00.000Z')
        });
      },
      async findFirst(args: { where: Record<string, unknown>; include?: Record<string, unknown> }) {
        this.findFirstCalls.push(args);
        if (args.where.stepIndex && !args.where.status) {
          return options.existingNextMessage ?? null;
        }
        if (args.where.status === 'queued' && options.sentMessageResult) {
          return options.sentMessageResult;
        }
        return message;
      },
      async updateManyAndReturn(args: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
        limit?: number;
      }) {
        this.updateManyAndReturnCalls.push(args);
        return [
          { ...(options.sentMessageResult ?? message), ...args.data, updatedAt: new Date('2026-06-18T10:00:00.000Z') }
        ];
      },
      async updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }) {
        this.updateManyCalls.push(args);
        return { count: 1 };
      }
    },
    crmSequenceEnrollment: {
      findFirstCalls: [] as Array<{ where: Record<string, unknown>; include?: Record<string, unknown> }>,
      updateManyAndReturnCalls: [] as Array<{
        where: Record<string, unknown>;
        data: Record<string, unknown>;
        limit?: number;
      }>,
      updateManyCalls: [] as Array<{ where: Record<string, unknown>; data: Record<string, unknown> }>,
      async findFirst(args: { where: Record<string, unknown>; include?: Record<string, unknown> }) {
        this.findFirstCalls.push(args);
        if (args.include && args.where.status === 'sequence_running') {
          return {
            ...enrollment,
            status: 'sequence_running',
            messages: options.sequenceReviewMessages ?? [{ ...message, status: 'queued' }]
          };
        }

        return args.include
          ? enrollment
          : {
              ...enrollment,
              account: undefined,
              contact: undefined,
              productLine: undefined,
              mailbox: undefined,
              messages: undefined
            };
      },
      async updateManyAndReturn(args: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
        limit?: number;
      }) {
        this.updateManyAndReturnCalls.push(args);
        return [{ ...enrollment, ...args.data, updatedAt: new Date('2026-06-18T10:00:00.000Z') }];
      },
      async updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }) {
        this.updateManyCalls.push(args);
        return { count: 1 };
      }
    },
    crmTimelineEvent: {
      createCalls: [] as Array<{ data: Record<string, unknown> }>,
      async create(args: { data: Record<string, unknown> }) {
        this.createCalls.push(args);
        return {
          id: 'event-1',
          organizationId: 'org-1',
          accountId: 'account-1',
          contactId: 'contact-1',
          ownerUserId: 'user-1',
          eventType: args.data.eventType,
          title: args.data.title,
          content: args.data.content ?? null,
          metadata: args.data.metadata ?? null,
          createdAt: new Date('2026-06-18T10:00:00.000Z')
        };
      }
    }
  };
}
