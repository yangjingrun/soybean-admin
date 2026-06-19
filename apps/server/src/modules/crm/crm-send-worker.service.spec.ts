import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CrmSendWorkerService } from './crm-send-worker.service';
import type {
  CrmAccountRecord,
  CrmContactRecord,
  CrmEmailSendGateway,
  CrmMailboxRecord,
  CrmMessageRecord,
  CrmSendDeliveryClaimRecord,
  CrmSendQueueJob,
  CrmSequenceEnrollmentRecord,
  CrmSequenceReviewRecord,
  CrmStore
} from './crm.types';

describe('CrmSendWorkerService', () => {
  it('skips stale runVersion jobs without sending or writing status', async () => {
    const store = createWorkerStore({
      enrollment: createEnrollment({ runVersion: 2 }),
      message: createMessage({ status: 'queued' })
    });
    const gateway = createGateway();
    const worker = new CrmSendWorkerService(store as never, gateway);

    await worker.processSendJob(createJob({ runVersion: 1 }));

    assert.equal(gateway.calls.length, 0);
    assert.equal(store.completed.length, 0);
    assert.equal(store.failed.length, 0);
  });

  it('sends active queued first messages and marks them sent', async () => {
    const store = createWorkerStore({
      enrollment: createEnrollment({ status: 'sequence_running', runVersion: 2 }),
      message: createMessage({ status: 'queued' }),
      mailbox: createMailbox({ status: 'active' })
    });
    const gateway = createGateway();
    const worker = new CrmSendWorkerService(store as never, gateway);

    await worker.processSendJob(createJob({ runVersion: 2 }));

    assert.equal(store.claims.length, 1);
    assert.equal(gateway.calls[0].message.id, 'message-1');
    assert.deepEqual(store.completed[0], {
      enrollmentId: 'enrollment-1',
      messageId: 'message-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      runVersion: 2,
      sentAt: store.completed[0].sentAt,
      providerMessageId: 'mock:message-1',
      providerThreadId: 'mock-thread:enrollment-1'
    });
  });

  it('skips sending when delivery claim cannot reserve mailbox quota', async () => {
    const store = createWorkerStore(
      {
        enrollment: createEnrollment({ status: 'sequence_running', runVersion: 2 }),
        message: createMessage({ status: 'queued' }),
        mailbox: createMailbox({ status: 'active' })
      },
      { claimResult: null }
    );
    const gateway = createGateway();
    const worker = new CrmSendWorkerService(store as never, gateway);

    await worker.processSendJob(createJob({ runVersion: 2 }));

    assert.equal(gateway.calls.length, 0);
    assert.equal(store.completed.length, 0);
    assert.equal(store.failed.length, 0);
  });

  it('marks queued messages failed when the send gateway throws', async () => {
    const store = createWorkerStore({
      enrollment: createEnrollment({ status: 'sequence_running' }),
      message: createMessage({ status: 'queued' }),
      mailbox: createMailbox({ status: 'active' })
    });
    const worker = new CrmSendWorkerService(store as never, createGateway(new Error('gmail unavailable')));

    await assert.rejects(() => worker.processSendJob(createJob()), /gmail unavailable/);
    assert.equal(store.failed[0].reason, 'gmail unavailable');
  });
});

interface WorkerStoreInput extends Partial<CrmSequenceReviewRecord> {
  message?: CrmMessageRecord;
}

function createWorkerStore(input: WorkerStoreInput, options: { claimResult?: CrmSendDeliveryClaimRecord | null } = {}) {
  const item: CrmSequenceReviewRecord = {
    enrollment: input.enrollment ?? createEnrollment(),
    account: input.account ?? createAccount(),
    contact: input.contact ?? createContact(),
    productLine: null,
    mailbox: input.mailbox ?? createMailbox(),
    firstMessage: input.firstMessage ?? input.message ?? createMessage()
  } as CrmSequenceReviewRecord & { message?: CrmMessageRecord };
  const completed: Parameters<CrmStore['completeFirstMessageSend']>[0][] = [];
  const failed: Parameters<CrmStore['failFirstMessageSend']>[0][] = [];
  const claims: Parameters<CrmStore['claimFirstMessageSendDelivery']>[0][] = [];

  return {
    completed,
    failed,
    claims,
    async getSequenceReviewItem() {
      return item;
    },
    async claimFirstMessageSendDelivery(args) {
      claims.push(args);
      if ('claimResult' in options) {
        return options.claimResult ?? null;
      }

      if (
        item.enrollment.id !== args.enrollmentId ||
        item.enrollment.organizationId !== args.organizationId ||
        item.enrollment.ownerUserId !== args.ownerUserId ||
        item.enrollment.runVersion !== args.runVersion ||
        item.enrollment.status !== 'sequence_running' ||
        item.firstMessage?.id !== args.messageId ||
        item.firstMessage.status !== 'queued' ||
        item.mailbox?.status !== 'active'
      ) {
        return null;
      }

      if (!item.mailbox || !item.firstMessage) {
        return null;
      }

      return {
        ...item,
        mailbox: item.mailbox,
        firstMessage: item.firstMessage
      };
    },
    async completeFirstMessageSend(args) {
      completed.push(args);
      return null;
    },
    async failFirstMessageSend(args) {
      failed.push(args);
      return null;
    }
  } satisfies Partial<CrmStore> & {
    completed: Parameters<CrmStore['completeFirstMessageSend']>[0][];
    failed: Parameters<CrmStore['failFirstMessageSend']>[0][];
    claims: Parameters<CrmStore['claimFirstMessageSendDelivery']>[0][];
  };
}

function createGateway(error?: Error): CrmEmailSendGateway & { calls: Parameters<CrmEmailSendGateway['sendPlainText']>[0][] } {
  const calls: Parameters<CrmEmailSendGateway['sendPlainText']>[0][] = [];

  return {
    calls,
    async sendPlainText(input) {
      if (error) {
        throw error;
      }

      calls.push(input);
      return {
        providerMessageId: `mock:${input.message.id}`,
        providerThreadId: `mock-thread:${input.enrollment.id}`
      };
    },
    async replyPlainText(input) {
      return { providerMessageId: `mock:reply:${input.thread.id}` };
    }
  };
}

function createJob(input: Partial<CrmSendQueueJob> = {}): CrmSendQueueJob {
  return {
    enrollmentId: input.enrollmentId || 'enrollment-1',
    messageId: input.messageId || 'message-1',
    organizationId: input.organizationId || 'org-1',
    ownerUserId: input.ownerUserId || 'user-1',
    runVersion: input.runVersion ?? 1
  };
}

function createAccount(input: Partial<CrmAccountRecord> = {}): CrmAccountRecord {
  return {
    id: input.id || 'account-1',
    organizationId: input.organizationId || 'org-1',
    ownerUserId: input.ownerUserId || 'user-1',
    name: input.name || 'ABC Trading',
    normalizedName: input.normalizedName || 'abc trading',
    websiteUrl: input.websiteUrl ?? null,
    domain: input.domain ?? 'abc.example',
    country: input.country ?? null,
    customerType: input.customerType ?? null,
    status: input.status || 'sequence_running',
    sourceTaskId: input.sourceTaskId ?? null,
    createdAt: input.createdAt || new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: input.updatedAt || new Date('2026-06-18T09:00:00.000Z')
  };
}

function createContact(input: Partial<CrmContactRecord> = {}): CrmContactRecord {
  return {
    id: input.id || 'contact-1',
    organizationId: input.organizationId || 'org-1',
    accountId: input.accountId || 'account-1',
    ownerUserId: input.ownerUserId || 'user-1',
    fullName: input.fullName ?? 'Ali Hassan',
    title: input.title ?? 'Purchasing Manager',
    email: input.email || 'ali@example.com',
    emailHash: input.emailHash || 'hash-1',
    maskedEmail: input.maskedEmail || 'a***@example.com',
    isPublicEmail: input.isPublicEmail ?? false,
    emailStatus: input.emailStatus || 'valid',
    sourceTaskId: input.sourceTaskId ?? null,
    createdAt: input.createdAt || new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: input.updatedAt || new Date('2026-06-18T09:00:00.000Z')
  };
}

function createMailbox(input: Partial<CrmMailboxRecord> = {}): CrmMailboxRecord {
  return {
    id: input.id || 'mailbox-1',
    organizationId: input.organizationId || 'org-1',
    ownerUserId: input.ownerUserId || 'user-1',
    ownerUserName: input.ownerUserName ?? 'Alice',
    provider: 'gmail',
    emailAddress: input.emailAddress || 'alice@gmail.com',
    emailHash: input.emailHash || 'mailbox-hash',
    maskedEmail: input.maskedEmail || 'a***@gmail.com',
    status: input.status || 'active',
    dailyLimit: input.dailyLimit ?? 50,
    hourlyLimit: input.hourlyLimit ?? 10,
    warmupStage: input.warmupStage || 'new',
    encryptedRefreshToken: input.encryptedRefreshToken ?? null,
    watchExpiration: input.watchExpiration ?? null,
    lastHistoryId: input.lastHistoryId ?? null,
    authorizedAt: input.authorizedAt || new Date('2026-06-18T09:00:00.000Z'),
    pausedAt: input.pausedAt ?? null,
    createdAt: input.createdAt || new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: input.updatedAt || new Date('2026-06-18T09:00:00.000Z')
  };
}

function createEnrollment(input: Partial<CrmSequenceEnrollmentRecord> = {}): CrmSequenceEnrollmentRecord {
  return {
    id: input.id || 'enrollment-1',
    organizationId: input.organizationId || 'org-1',
    ownerUserId: input.ownerUserId || 'user-1',
    accountId: input.accountId || 'account-1',
    contactId: input.contactId || 'contact-1',
    productLineId: input.productLineId ?? null,
    mailboxId: input.mailboxId ?? 'mailbox-1',
    name: input.name || 'ABC Trading - Ali Hassan',
    status: input.status || 'sequence_running',
    currentStep: input.currentStep ?? 1,
    totalSteps: input.totalSteps ?? 5,
    runVersion: input.runVersion ?? 1,
    createdById: input.createdById || 'user-1',
    createdByName: input.createdByName ?? 'Alice',
    createdAt: input.createdAt || new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: input.updatedAt || new Date('2026-06-18T09:00:00.000Z')
  };
}

function createMessage(input: Partial<CrmMessageRecord> = {}): CrmMessageRecord {
  return {
    id: input.id || 'message-1',
    organizationId: input.organizationId || 'org-1',
    ownerUserId: input.ownerUserId || 'user-1',
    accountId: input.accountId || 'account-1',
    contactId: input.contactId || 'contact-1',
    enrollmentId: input.enrollmentId || 'enrollment-1',
    mailboxId: input.mailboxId ?? 'mailbox-1',
    stepIndex: input.stepIndex ?? 1,
    threadMode: input.threadMode || 'new_subject',
    subject: input.subject || 'Bearing Series for ABC Trading',
    bodyText: input.bodyText || 'Hi Ali,\n\nWould it be useful if I sent a short product list?\n\nBest regards,\nAlice',
    status: input.status || 'queued',
    scheduledAt: input.scheduledAt ?? new Date('2026-06-18T10:00:00.000Z'),
    sentAt: input.sentAt ?? null,
    bullJobId: input.bullJobId ?? 'send-job-1',
    providerMessageId: input.providerMessageId ?? null,
    providerThreadId: input.providerThreadId ?? null,
    createdAt: input.createdAt || new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: input.updatedAt || new Date('2026-06-18T09:00:00.000Z')
  };
}
