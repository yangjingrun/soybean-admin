import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaCrmAiDraftWorkerStore } from './prisma-crm-ai-draft-worker.store';
import type { CrmMessageCreateInput } from '../crm.types';

describe('PrismaCrmAiDraftWorkerStore', () => {
  it('creates CRM AI draft task and item rows in one transaction with derived counters', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmAiDraftWorkerStore(prisma as never);

    const result = await store.createAiDraftTask({
      organizationId: 'org-1',
      organizationRole: 'member',
      ownerUserId: 'user-1',
      ownerUserName: 'Alice',
      requestedCount: 2,
      items: [
        {
          enrollmentId: 'enrollment-1',
          messageId: 'message-1',
          contactId: 'contact-1',
          accountId: 'account-1',
          productLineId: 'product-line-1',
          stepIndex: 2,
          status: 'pending'
        },
        {
          enrollmentId: 'missing-enrollment',
          stepIndex: 0,
          status: 'skipped',
          failureType: 'business_skip',
          failureReason: '邮件序列不存在或无权操作'
        }
      ]
    });

    assert.equal(result.task?.requestedCount, 2);
    assert.equal(result.task?.pendingCount, 1);
    assert.equal(result.task?.skippedCount, 1);
    assert.equal(result.task?.effectiveConcurrency, 3);
    assert.equal(prisma.transactionCalls, 1);
    assert.deepEqual(prisma.transactionOptionsCalls[0], {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    });
    assert.deepEqual(prisma.crmAiDraftQueueConfig.findUniqueCalls[0].where, { configKey: 'crm-ai-draft' });
    assert.deepEqual(prisma.crmAiDraftTask.countCalls[0].where, {
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      status: { in: ['queued', 'running'] }
    });
    assert.deepEqual(prisma.crmAiDraftTask.countCalls[1].where, {
      organizationId: 'org-1',
      status: { in: ['queued', 'running'] }
    });
    assert.equal(prisma.crmAiDraftTask.createCalls[0].data.organizationId, 'org-1');
    assert.equal(prisma.crmAiDraftTaskItem.createManyCalls[0].data.length, 2);
    assert.equal(prisma.crmAiDraftTaskItem.createManyCalls[0].data[1].status, 'skipped');
  });

  it('rejects CRM AI draft task creation inside the serializable transaction when active cap is reached', async () => {
    const prisma = createPrisma({
      aiDraftQueueConfig: createPrismaAiDraftQueueConfig({ maxActiveTasksPerUser: 1, maxActiveTasksPerOrg: 5 }),
      aiDraftActiveCountResults: [1, 1]
    });
    const store = new PrismaCrmAiDraftWorkerStore(prisma as never);

    const result = await store.createAiDraftTask({
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      requestedCount: 1,
      items: [{ enrollmentId: 'enrollment-1', stepIndex: 2, status: 'pending' }]
    });

    assert.equal(result.task, null);
    assert.equal(result.limitReason, 'user_active_limit');
    assert.equal(prisma.crmAiDraftTask.createCalls.length, 0);
    assert.equal(prisma.transactionCalls, 1);
  });

  it('maps serializable CRM AI draft task create conflicts to a business conflict result', async () => {
    const prisma = createPrisma({
      transactionError: new Prisma.PrismaClientKnownRequestError('Transaction conflict', {
        code: 'P2034',
        clientVersion: 'test'
      })
    });
    const store = new PrismaCrmAiDraftWorkerStore(prisma as never);

    const result = await store.createAiDraftTask({
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      requestedCount: 1,
      items: [{ enrollmentId: 'enrollment-1', stepIndex: 2, status: 'pending' }]
    });

    assert.equal(result.task, null);
    assert.equal(result.limitReason, 'concurrent_create_conflict');
  });

  it('returns default CRM AI draft queue config when no row exists', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmAiDraftWorkerStore(prisma as never);

    const config = await store.getAiDraftQueueConfig();

    assert.equal(config.itemConcurrency, 3);
    assert.equal(config.maxItemConcurrency, 5);
    assert.equal(config.maxActiveTasksPerUser, 1);
    assert.equal(config.maxActiveTasksPerOrg, 2);
    assert.equal(config.maxAttempts, 3);
    assert.deepEqual(prisma.crmAiDraftQueueConfig.findUniqueCalls[0].where, { configKey: 'crm-ai-draft' });
  });

  it('batch loads sequence review items by scoped ids', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmAiDraftWorkerStore(prisma as never);

    const records = await store.listSequenceReviewItemsByIds({
      ids: ['enrollment-1', 'enrollment-2', 'enrollment-1'],
      organizationId: 'org-1',
      ownerUserId: 'user-1'
    });

    assert.equal(records.length, 1);
    assert.deepEqual(prisma.crmSequenceEnrollment.findManyCalls[0].where, {
      id: { in: ['enrollment-1', 'enrollment-2'] },
      organizationId: 'org-1',
      ownerUserId: 'user-1'
    });
    assert.deepEqual(prisma.crmSequenceEnrollment.findManyCalls[0].include, {
      account: true,
      contact: true,
      productLine: true,
      mailbox: true,
      policy: true,
      messages: {
        orderBy: [{ stepIndex: 'asc' }, { createdAt: 'asc' }]
      }
    });
  });

  it('creates local follow-up draft bundles with scoped enrollment and timeline metadata', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmAiDraftWorkerStore(prisma as never);
    const scheduledAt = new Date('2026-06-23T10:00:00.000Z');

    const result = await store.createFollowUpDraftBundle({
      enrollmentId: 'enrollment-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      message: createFollowUpMessage({ scheduledAt }),
      timelineEvent: createFollowUpTimelineEvent()
    });

    assert.equal(result?.message.stepIndex, 2);
    assert.deepEqual(prisma.crmSequenceEnrollment.findFirstCalls.at(-1)?.where, {
      id: 'enrollment-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1'
    });
    assert.deepEqual(prisma.crmMessage.createCalls.at(-1)?.data, {
      ...createFollowUpMessage({ scheduledAt }),
      enrollmentId: 'enrollment-1'
    });
    assert.deepEqual(prisma.crmTimelineEvent.createCalls.at(-1)?.data.metadata, {
      enrollmentId: 'enrollment-1',
      stepIndex: 2,
      messageId: 'message-2'
    });
  });

  it('returns null without creating follow-up drafts when guards detect state changes', async () => {
    const prisma = createPrisma({ existingNextMessage: createPrismaMessage({ stepIndex: 2 }) });
    const store = new PrismaCrmAiDraftWorkerStore(prisma as never);

    const result = await store.createFollowUpDraftBundle({
      enrollmentId: 'enrollment-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      expectedEnrollmentStatus: ['ready_to_send', 'sequence_running'],
      blockingMessageStatuses: ['draft_pending_review', 'queued', 'failed'],
      taskGuard: {
        taskId: 'task-1',
        runVersion: 1,
        status: 'running'
      },
      message: createFollowUpMessage(),
      timelineEvent: createFollowUpTimelineEvent()
    });

    assert.equal(result, null);
    assert.deepEqual(prisma.crmAiDraftTask.findFirstCalls.at(-1)?.where, {
      id: 'task-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      runVersion: 1,
      status: 'running'
    });
    assert.deepEqual(prisma.crmSequenceEnrollment.findFirstCalls.at(-1)?.where, {
      id: 'enrollment-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      status: { in: ['ready_to_send', 'sequence_running'] }
    });
    assert.deepEqual(prisma.crmMessage.findFirstCalls.at(-1)?.where, {
      enrollmentId: 'enrollment-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      OR: [{ stepIndex: 2 }, { status: { in: ['draft_pending_review', 'queued', 'failed'] } }]
    });
    assert.equal(prisma.crmMessage.createCalls.length, 0);
  });

  it('returns null before creating follow-up drafts when the task run guard no longer matches', async () => {
    const prisma = createPrisma({ aiDraftTaskFindFirstResult: null });
    const store = new PrismaCrmAiDraftWorkerStore(prisma as never);

    const result = await store.createFollowUpDraftBundle({
      enrollmentId: 'enrollment-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      taskGuard: {
        taskId: 'task-1',
        runVersion: 1,
        status: 'running'
      },
      message: createFollowUpMessage(),
      timelineEvent: createFollowUpTimelineEvent()
    });

    assert.equal(result, null);
    assert.equal(prisma.crmSequenceEnrollment.findFirstCalls.length, 0);
    assert.equal(prisma.crmMessage.createCalls.length, 0);
  });

  it('batch loads organization blacklist entries by email hashes', async () => {
    const prisma = createPrisma({
      blacklistFindManyResults: [
        createPrismaBlacklist({ emailHash: 'hash-1' }),
        createPrismaBlacklist({ id: 'blacklist-2', emailHash: 'hash-2' })
      ]
    });
    const store = new PrismaCrmAiDraftWorkerStore(prisma as never);

    const records = await store.listBlacklistEntriesByEmailHashes({
      organizationId: 'org-1',
      emailHashes: ['hash-1', 'hash-2', 'hash-1', '']
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
});

function createFollowUpMessage(
  input: Partial<Omit<CrmMessageCreateInput, 'enrollmentId'>> = {}
): Omit<CrmMessageCreateInput, 'enrollmentId'> {
  return {
    organizationId: 'org-1',
    ownerUserId: 'user-1',
    accountId: 'account-1',
    contactId: 'contact-1',
    mailboxId: 'mailbox-1',
    stepIndex: 2,
    threadMode: 'same_thread' as const,
    subject: 'Follow-up',
    bodyText: 'Hi Ali',
    status: 'draft_pending_review' as const,
    scheduledAt: null,
    providerThreadId: null,
    ...input
  };
}

function createFollowUpTimelineEvent() {
  return {
    organizationId: 'org-1',
    accountId: 'account-1',
    contactId: 'contact-1',
    ownerUserId: 'user-1',
    eventType: 'sequence_follow_up_draft_generated' as const,
    title: '生成后续开发信草稿',
    content: 'Follow-up',
    metadata: {
      enrollmentId: 'enrollment-1',
      stepIndex: 2
    }
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
    threadMode: 'same_thread',
    subject: 'Bearing Series for ABC Trading',
    bodyText: 'Hi Ali',
    status: 'sent',
    scheduledAt: null,
    sentAt: new Date('2026-06-18T10:00:00.000Z'),
    providerMessageId: 'gmail-message-1',
    providerThreadId: 'gmail-thread-1',
    bullJobId: null,
    metadata: null,
    createdAt: new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: new Date('2026-06-18T10:00:00.000Z'),
    ...input
  };
}

function createPrismaAiDraftTask(input: Record<string, unknown> = {}) {
  return {
    id: 'ai-draft-task-1',
    organizationId: 'org-1',
    organizationRole: 'member',
    ownerUserId: 'user-1',
    ownerUserName: 'Alice',
    status: 'queued',
    runVersion: 1,
    bullJobId: null,
    requestedCount: 2,
    successCount: 0,
    skippedCount: 1,
    failedCount: 0,
    retryingCount: 0,
    runningCount: 0,
    pendingCount: 1,
    effectiveConcurrency: 3,
    maxAttempts: 3,
    failureReason: null,
    progressState: null,
    resultSummary: null,
    readAt: null,
    notifiedAt: null,
    startedAt: null,
    finishedAt: null,
    createdAt: new Date('2026-06-20T09:00:00.000Z'),
    updatedAt: new Date('2026-06-20T09:00:00.000Z'),
    ...input
  };
}

function createPrismaAiDraftQueueConfig(input: Record<string, unknown> = {}) {
  return {
    configKey: 'crm-ai-draft',
    itemConcurrency: 3,
    maxItemConcurrency: 5,
    maxActiveTasksPerUser: 1,
    maxActiveTasksPerOrg: 2,
    maxAttempts: 3,
    retryBackoffSeconds: null,
    updatedById: null,
    updatedByName: null,
    updatedAt: new Date('2026-06-20T09:00:00.000Z'),
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

function createPrisma(options: {
  aiDraftTaskFindFirstResult?: ReturnType<typeof createPrismaAiDraftTask> | null;
  aiDraftActiveCountResults?: number[];
  aiDraftQueueConfig?: ReturnType<typeof createPrismaAiDraftQueueConfig> | null;
  blacklistFindManyResults?: ReturnType<typeof createPrismaBlacklist>[];
  existingNextMessage?: ReturnType<typeof createPrismaMessage> | null;
  transactionError?: Error;
} = {}) {
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
    status: 'ready',
    sourceTaskId: null,
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
  const mailbox = {
    id: 'mailbox-1',
    organizationId: 'org-1',
    ownerUserId: 'user-1',
    ownerUserName: 'Alice',
    provider: 'gmail',
    emailAddress: 'alice@gmail.com',
    emailHash: 'mailbox-hash-1',
    maskedEmail: 'a***@gmail.com',
    status: 'active',
    dailyLimit: 50,
    hourlyLimit: 10,
    warmupStage: 'new',
    watchExpiration: null,
    lastHistoryId: null,
    encryptedRefreshToken: 'encrypted-refresh-token-1',
    authorizedAt: new Date('2026-06-18T09:00:00.000Z'),
    pausedAt: null,
    createdAt: new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: new Date('2026-06-18T09:00:00.000Z')
  };
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
    status: 'ready_to_send',
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
    messages: [createPrismaMessage()]
  };
  const aiDraftActiveCountResults = [...(options.aiDraftActiveCountResults ?? [0, 0])];

  return {
    transactionCalls: 0,
    transactionOptionsCalls: [] as Array<Record<string, unknown> | undefined>,
    async $transaction<T>(operation: (tx: unknown) => Promise<T>, transactionOptions?: Record<string, unknown>) {
      this.transactionCalls += 1;
      this.transactionOptionsCalls.push(transactionOptions);
      if (options.transactionError) throw options.transactionError;
      return operation(this);
    },
    crmAiDraftTask: {
      createCalls: [] as Array<{ data: Record<string, unknown> }>,
      countCalls: [] as Array<{ where: Record<string, unknown> }>,
      findFirstCalls: [] as Array<{ where: Record<string, unknown>; orderBy?: Record<string, unknown> }>,
      updateManyAndReturnCalls: [] as Array<{ where: Record<string, unknown>; data: Record<string, unknown> }>,
      async create(args: { data: Record<string, unknown> }) {
        this.createCalls.push(args);
        return createPrismaAiDraftTask(args.data);
      },
      async count(args: { where: Record<string, unknown> }) {
        this.countCalls.push(args);
        return aiDraftActiveCountResults.shift() ?? 0;
      },
      async findFirst(args: { where: Record<string, unknown>; orderBy?: Record<string, unknown> }) {
        this.findFirstCalls.push(args);
        return options.aiDraftTaskFindFirstResult === undefined
          ? createPrismaAiDraftTask()
          : options.aiDraftTaskFindFirstResult;
      },
      async updateManyAndReturn(args: { where: Record<string, unknown>; data: Record<string, unknown> }) {
        this.updateManyAndReturnCalls.push(args);
        return [createPrismaAiDraftTask(args.data)];
      }
    },
    crmAiDraftTaskItem: {
      createManyCalls: [] as Array<{ data: Array<Record<string, unknown>> }>,
      findManyCalls: [] as Array<{ where: Record<string, unknown>; orderBy?: Array<Record<string, unknown>> }>,
      updateManyAndReturnCalls: [] as Array<{ where: Record<string, unknown>; data: Record<string, unknown> }>,
      async createMany(args: { data: Array<Record<string, unknown>> }) {
        this.createManyCalls.push(args);
        return { count: args.data.length };
      },
      async findMany(args: { where: Record<string, unknown>; orderBy?: Array<Record<string, unknown>> }) {
        this.findManyCalls.push(args);
        return [];
      },
      async updateManyAndReturn(args: { where: Record<string, unknown>; data: Record<string, unknown> }) {
        this.updateManyAndReturnCalls.push(args);
        return [];
      }
    },
    crmAiDraftQueueConfig: {
      findUniqueCalls: [] as Array<{ where: Record<string, unknown> }>,
      findUniqueResult: options.aiDraftQueueConfig ?? null,
      async findUnique(args: { where: Record<string, unknown> }) {
        this.findUniqueCalls.push(args);
        return this.findUniqueResult;
      }
    },
    crmSequenceEnrollment: {
      findFirstCalls: [] as Array<{ where: Record<string, unknown>; include?: Record<string, unknown> }>,
      findManyCalls: [] as Array<{ where: Record<string, unknown>; include: Record<string, unknown> }>,
      async findFirst(args: { where: Record<string, unknown>; include?: Record<string, unknown> }) {
        this.findFirstCalls.push(args);
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
      async findMany(args: { where: Record<string, unknown>; include: Record<string, unknown> }) {
        this.findManyCalls.push(args);
        return [enrollment];
      }
    },
    crmMessage: {
      createCalls: [] as Array<{ data: Record<string, unknown> }>,
      findFirstCalls: [] as Array<{ where: Record<string, unknown> }>,
      async create(args: { data: Record<string, unknown> }) {
        this.createCalls.push(args);
        return createPrismaMessage({
          ...args.data,
          id: `message-${this.createCalls.length + 1}`,
          createdAt: new Date('2026-06-18T10:00:00.000Z'),
          updatedAt: new Date('2026-06-18T10:00:00.000Z')
        });
      },
      async findFirst(args: { where: Record<string, unknown> }) {
        this.findFirstCalls.push(args);
        if (args.where.OR) {
          return options.existingNextMessage ?? null;
        }

        return createPrismaMessage();
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
    },
    crmBlacklist: {
      findManyCalls: [] as Array<{ where: Record<string, unknown> }>,
      async findMany(args: { where: Record<string, unknown> }) {
        this.findManyCalls.push(args);
        return options.blacklistFindManyResults ?? [];
      }
    }
  };
}
