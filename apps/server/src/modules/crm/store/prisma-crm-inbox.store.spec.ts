import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaCrmInboxStore } from './prisma-crm-inbox.store';

describe('PrismaCrmInboxStore', () => {
  it('lists inbox threads with scoped filters and include data', async () => {
    const prisma = createInboxPrisma();
    const store = new PrismaCrmInboxStore(prisma as never);

    const result = await store.listInboxThreads({
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      keyword: 'reply',
      status: 'pending',
      mailboxId: 'mailbox-1',
      skip: 0,
      take: 20
    });

    assert.equal(result.total, 1);
    assert.equal(result.records[0].thread.id, 'inbox-thread-1');
    assert.equal(result.records[0].lastMessage?.id, 'inbox-message-1');
    assert.deepEqual(prisma.crmInboxThread.findManyCalls[0].where, {
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      status: 'pending',
      mailboxId: 'mailbox-1',
      OR: [
        { subject: { contains: 'reply', mode: 'insensitive' } },
        { account: { name: { contains: 'reply', mode: 'insensitive' } } },
        { account: { domain: { contains: 'reply', mode: 'insensitive' } } },
        { contact: { fullName: { contains: 'reply', mode: 'insensitive' } } },
        { contact: { title: { contains: 'reply', mode: 'insensitive' } } },
        { contact: { maskedEmail: { contains: 'reply', mode: 'insensitive' } } }
      ]
    });
  });

  it('updates inbox thread status and writes timeline event', async () => {
    const prisma = createInboxPrisma();
    const store = new PrismaCrmInboxStore(prisma as never);

    const result = await store.updateInboxThreadStatus({
      id: 'inbox-thread-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      fromStatus: 'pending',
      toStatus: 'handled',
      accountStatus: 'followed_up'
    });

    assert.equal(result?.thread.status, 'handled');
    assert.deepEqual(prisma.crmInboxThread.updateManyAndReturnCalls[0], {
      where: {
        id: 'inbox-thread-1',
        organizationId: 'org-1',
        ownerUserId: 'user-1',
        status: 'pending'
      },
      data: {
        status: 'handled',
        unreadCount: 0
      },
      limit: 1
    });
    assert.deepEqual(prisma.crmAccount.updateCalls[0], {
      where: { id: 'account-1' },
      data: { status: 'followed_up' }
    });
    assert.equal(prisma.crmTimelineEvent.createCalls.at(-1)?.data.eventType, 'inbox_status_changed');
  });

  it('saves inbox reply draft fields without creating messages or changing thread state', async () => {
    const prisma = createInboxPrisma();
    const store = new PrismaCrmInboxStore(prisma as never);
    const updatedAt = new Date('2026-06-18T12:00:00.000Z');

    const result = await store.saveInboxThreadReplyDraft({
      id: 'inbox-thread-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      topic: 'send catalogue',
      bodyText: 'Polished reply body',
      metadata: {
        generated: true,
        reason: '根据用户主题润色扩写',
        riskNotes: ['人工确认']
      },
      updatedAt,
      updatedById: 'user-1',
      updatedByName: 'Alice'
    });

    assert.equal(result?.thread.replyDraftBodyText, 'Polished reply body');
    assert.equal(result?.thread.status, 'pending');
    assert.equal(result?.thread.unreadCount, 1);
    assert.equal(result?.thread.messageCount, 1);
    assert.deepEqual(prisma.crmInboxThread.updateManyAndReturnCalls.at(-1)?.data, {
      replyDraftTopic: 'send catalogue',
      replyDraftBodyText: 'Polished reply body',
      replyDraftMetadata: {
        generated: true,
        reason: '根据用户主题润色扩写',
        riskNotes: ['人工确认']
      },
      replyDraftUpdatedAt: updatedAt,
      replyDraftUpdatedById: 'user-1',
      replyDraftUpdatedByName: 'Alice'
    });
    assert.equal(prisma.crmInboxMessage.createCalls.length, 0);
    assert.equal(prisma.crmTimelineEvent.createCalls.length, 0);
  });

  it('marks an inbox thread handled when Gmail removes UNREAD', async () => {
    const prisma = createInboxPrisma();
    const store = new PrismaCrmInboxStore(prisma as never);

    const result = await store.syncInboxThreadGmailState({
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      mailboxId: 'mailbox-1',
      providerThreadId: 'enrollment-1',
      providerMessageId: 'gmail-message-1',
      changeType: 'labels_removed',
      labelIds: ['UNREAD']
    });

    assert.equal(result?.thread.status, 'handled');
    assert.equal(result?.thread.unreadCount, 0);
    assert.deepEqual(prisma.crmInboxThread.updateCalls.at(-1)?.data, {
      status: 'handled',
      unreadCount: 0
    });
    assert.equal(prisma.crmTimelineEvent.createCalls.at(-1)?.data.eventType, 'gmail_label_synced');
    assert.deepEqual(prisma.crmTimelineEvent.createCalls.at(-1)?.data.metadata, {
      providerMessageId: 'gmail-message-1',
      providerThreadId: 'enrollment-1',
      changeType: 'labels_removed',
      labelIds: ['UNREAD'],
      fromStatus: 'pending',
      toStatus: 'handled'
    });
  });

  it('archives an inbox thread when Gmail removes INBOX without deleting local messages', async () => {
    const prisma = createInboxPrisma();
    const store = new PrismaCrmInboxStore(prisma as never);

    const result = await store.syncInboxThreadGmailState({
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      mailboxId: 'mailbox-1',
      providerThreadId: 'enrollment-1',
      providerMessageId: 'gmail-message-1',
      changeType: 'labels_removed',
      labelIds: ['INBOX']
    });

    assert.equal(result?.thread.status, 'archived');
    assert.equal(result?.thread.unreadCount, 0);
    assert.deepEqual(prisma.crmInboxThread.updateCalls.at(-1)?.data, {
      status: 'archived',
      unreadCount: 0
    });
    assert.equal(prisma.crmInboxMessage.createCalls.length, 0);
    assert.equal(prisma.crmTimelineEvent.createCalls.at(-1)?.data.eventType, 'gmail_thread_archived');
  });

  it('replies to inbox thread with mailbox sender and marks it handled', async () => {
    const prisma = createInboxPrisma();
    const store = new PrismaCrmInboxStore(prisma as never);
    const sentAt = new Date('2026-06-18T11:30:00.000Z');

    const result = await store.replyInboxThread({
      id: 'inbox-thread-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      subject: 'Re: Bearing Series for ABC Trading',
      bodyText: 'Thanks, I will send details today.',
      sentAt,
      providerMessageId: 'mock:reply-1'
    });

    assert.equal(result?.thread.status, 'handled');
    assert.equal(result?.account.status, 'followed_up');
    assert.deepEqual(prisma.crmInboxMessage.createCalls.at(-1)?.data, {
      threadId: 'inbox-thread-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      accountId: 'account-1',
      contactId: 'contact-1',
      enrollmentId: 'enrollment-1',
      mailboxId: 'mailbox-1',
      provider: 'gmail',
      providerMessageId: 'mock:reply-1',
      replyToMessageId: 'inbox-message-1',
      fromEmail: 'alice@gmail.com',
      fromEmailHash: 'mailbox-hash-1',
      maskedFromEmail: 'a***@gmail.com',
      subject: 'Re: Bearing Series for ABC Trading',
      snippet: 'Thanks, I will send details today.',
      bodyText: 'Thanks, I will send details today.',
      receivedAt: sentAt,
      messageType: 'customer_reply'
    });
    assert.deepEqual(prisma.crmInboxThread.updateCalls.at(-1)?.data, {
      status: 'handled',
      unreadCount: 0,
      messageCount: { increment: 1 }
    });
    assert.equal(prisma.crmTimelineEvent.createCalls.at(-1)?.data.eventType, 'inbox_replied');
  });

  it('returns existing inbox message when ingesting duplicate provider message', async () => {
    const prisma = createInboxPrisma();
    const store = new PrismaCrmInboxStore(prisma as never);

    const result = await store.ingestCustomerReply({
      outboundMessageId: 'message-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      subject: 'Re: Bearing Series',
      bodyText: 'Please send details.',
      receivedAt: new Date('2026-06-18T11:00:00.000Z'),
      providerThreadId: 'gmail-thread-1',
      providerMessageId: 'gmail-message-1'
    });

    assert.equal(result?.isDuplicate, true);
    assert.equal(result?.message.id, 'inbox-message-1');
    assert.equal(result?.event, null);
    assert.deepEqual(prisma.crmInboxMessage.findFirstCalls[0].where, {
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      mailboxId: 'mailbox-1',
      providerMessageId: 'gmail-message-1'
    });
    assert.equal(prisma.crmInboxMessage.createCalls.length, 0);
    assert.equal(prisma.crmInboxThread.updateCalls.length, 0);
    assert.equal(prisma.crmTimelineEvent.createCalls.length, 0);
  });

  it('rereads existing inbox message when concurrent ingest hits provider message uniqueness', async () => {
    const prisma = createInboxPrisma();
    const store = new PrismaCrmInboxStore(prisma as never);
    prisma.crmInboxMessage.findFirstResults = [null, 'default'];
    prisma.crmInboxMessage.createError = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: 'test'
    });

    const result = await store.ingestCustomerReply({
      outboundMessageId: 'message-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      subject: 'Re: Bearing Series',
      bodyText: 'Please send details.',
      receivedAt: new Date('2026-06-18T11:00:00.000Z'),
      providerThreadId: 'gmail-thread-1',
      providerMessageId: 'gmail-message-1'
    });

    assert.equal(result?.isDuplicate, true);
    assert.equal(result?.message.id, 'inbox-message-1');
    assert.equal(prisma.crmInboxMessage.createCalls.length, 1);
    assert.deepEqual(prisma.crmInboxMessage.findFirstCalls.at(-1)?.where, {
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      mailboxId: 'mailbox-1',
      providerMessageId: 'gmail-message-1'
    });
    assert.equal(prisma.crmInboxThread.updateCalls.length, 0);
    assert.equal(prisma.crmTimelineEvent.createCalls.length, 0);
  });

  it('stops all active same-account sequences and skips queued follow-ups after a customer reply', async () => {
    const prisma = createInboxPrisma();
    const store = new PrismaCrmInboxStore(prisma as never);
    prisma.crmInboxMessage.findFirstResult = null;

    const result = await store.ingestCustomerReply({
      outboundMessageId: 'message-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      subject: 'Re: Bearing Series',
      bodyText: 'Please send details.',
      receivedAt: new Date('2026-06-18T11:00:00.000Z'),
      providerThreadId: 'gmail-thread-1',
      providerMessageId: 'gmail-reply-1'
    });

    assert.equal(result?.isDuplicate, false);
    assert.deepEqual(prisma.crmSequenceEnrollment.updateManyCalls.at(-1), {
      where: {
        organizationId: 'org-1',
        ownerUserId: 'user-1',
        accountId: 'account-1',
        status: { in: ['draft_review_pending', 'ready_to_send', 'sequence_running', 'paused'] }
      },
      data: {
        status: 'replied',
        runVersion: { increment: 1 }
      }
    });
    assert.deepEqual(prisma.crmMessage.updateManyCalls.at(-1), {
      where: {
        organizationId: 'org-1',
        ownerUserId: 'user-1',
        accountId: 'account-1',
        status: 'queued'
      },
      data: {
        status: 'skipped',
        bullJobId: null
      }
    });
  });

  it('marks contact unsubscribed when ingesting an unsubscribe reply', async () => {
    const prisma = createInboxPrisma();
    const store = new PrismaCrmInboxStore(prisma as never);
    prisma.crmInboxMessage.findFirstResult = null;

    const result = await store.ingestCustomerReply({
      outboundMessageId: 'message-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      subject: 'Re: Bearing Series',
      bodyText: 'Please remove me from your list.',
      receivedAt: new Date('2026-06-18T11:00:00.000Z'),
      messageType: 'unsubscribe_hint'
    });

    assert.equal(result?.message.messageType, 'unsubscribe_hint');
    assert.deepEqual(prisma.crmBlacklist.upsertCalls[0].where, {
      organizationId_emailHash: {
        organizationId: 'org-1',
        emailHash: 'contact-hash-1'
      }
    });
    assert.equal(prisma.crmBlacklist.upsertCalls[0].create.sourceMessageId, 'inbox-message-1');
    assert.deepEqual(prisma.crmContact.updateCalls[0], {
      where: { id: 'contact-1' },
      data: { emailStatus: 'unsubscribed' }
    });
    assert.deepEqual(prisma.crmAccount.updateCalls.at(-1), {
      where: { id: 'account-1' },
      data: { status: 'blocked' }
    });
    assert.equal(prisma.crmTimelineEvent.createCalls.at(-1)?.data.eventType, 'customer_unsubscribed');
  });

  it('confirms a pending unsubscribe review with blacklist and queued message updates in one transaction', async () => {
    const prisma = createInboxPrisma({
      inboxMessage: createPrismaInboxMessage({ messageType: 'unsubscribe_review_pending' })
    });
    const store = new PrismaCrmInboxStore(prisma as never);
    const confirmedAt = new Date('2026-06-18T12:00:00.000Z');

    const result = await store.confirmInboxMessageUnsubscribe({
      messageId: 'inbox-message-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      confirmedAt,
      confirmedById: 'user-1',
      confirmedByName: 'Alice'
    });

    assert.equal(result?.message.messageType, 'unsubscribe_hint');
    assert.equal(prisma.transactionCalls, 1);
    assert.deepEqual(prisma.crmInboxMessage.findFirstCalls.at(-1)?.where, {
      id: 'inbox-message-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      messageType: {
        in: ['unsubscribe_hint', 'unsubscribe_review_pending']
      }
    });
    assert.deepEqual(prisma.crmInboxMessage.updateCalls.at(-1)?.data, {
      messageType: 'unsubscribe_hint'
    });
    assert.equal(prisma.crmBlacklist.upsertCalls.at(-1)?.create.reason, 'unsubscribe');
    assert.deepEqual(prisma.crmSequenceEnrollment.updateManyCalls.at(-1), {
      where: {
        organizationId: 'org-1',
        ownerUserId: 'user-1',
        accountId: 'account-1',
        status: { in: ['draft_review_pending', 'ready_to_send', 'sequence_running', 'paused'] }
      },
      data: {
        status: 'replied',
        runVersion: { increment: 1 }
      }
    });
    assert.deepEqual(prisma.crmMessage.updateManyCalls.at(-1), {
      where: {
        organizationId: 'org-1',
        ownerUserId: 'user-1',
        accountId: 'account-1',
        status: 'queued'
      },
      data: {
        status: 'skipped',
        bullJobId: null
      }
    });
    assert.deepEqual(prisma.crmContact.updateCalls.at(-1), {
      where: { id: 'contact-1' },
      data: { emailStatus: 'unsubscribed' }
    });
    assert.deepEqual(prisma.crmAccount.updateCalls.at(-1), {
      where: { id: 'account-1' },
      data: { status: 'blocked' }
    });
    assert.equal(prisma.crmTimelineEvent.createCalls.at(-1)?.data.eventType, 'customer_unsubscribed');
  });

  it('marks contact unreachable when ingesting a bounce reply', async () => {
    const prisma = createInboxPrisma();
    const store = new PrismaCrmInboxStore(prisma as never);
    prisma.crmInboxMessage.findFirstResult = null;

    const result = await store.ingestCustomerReply({
      outboundMessageId: 'message-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      subject: 'Delivery Status Notification (Failure)',
      bodyText: 'Diagnostic-Code: smtp; 550 5.1.1 User unknown',
      receivedAt: new Date('2026-06-18T11:00:00.000Z'),
      messageType: 'bounce'
    });

    assert.equal(result?.message.messageType, 'bounce');
    assert.deepEqual(prisma.crmContact.updateCalls[0], {
      where: { id: 'contact-1' },
      data: { emailStatus: 'unreachable' }
    });
    assert.deepEqual(prisma.crmAccount.updateCalls.at(-1), {
      where: { id: 'account-1' },
      data: { status: 'manual_review_pending' }
    });
    assert.equal(prisma.crmTimelineEvent.createCalls.at(-1)?.data.eventType, 'email_bounced');
  });
});

type InboxPrismaRecord = Record<string, unknown>;

function createPrismaAccount(input: InboxPrismaRecord = {}) {
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
    archivedAt: null,
    archiveReason: null,
    archiveSlimmedAt: null,
    createdAt: new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: new Date('2026-06-18T09:00:00.000Z'),
    ...input
  };
}

function createPrismaContact(input: InboxPrismaRecord = {}) {
  return {
    id: 'contact-1',
    organizationId: 'org-1',
    accountId: 'account-1',
    ownerUserId: 'user-1',
    fullName: 'Ali Hassan',
    title: 'Buyer',
    email: 'ali@example.com',
    emailHash: 'contact-hash-1',
    maskedEmail: 'a***@example.com',
    isPublicEmail: false,
    emailStatus: 'valid',
    sourceTaskId: null,
    createdAt: new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: new Date('2026-06-18T09:00:00.000Z'),
    ...input
  };
}

function createPrismaMailbox(input: InboxPrismaRecord = {}) {
  return {
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

function createPrismaEnrollment(input: InboxPrismaRecord = {}) {
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

function createPrismaMessage(input: InboxPrismaRecord = {}) {
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
    status: 'sent',
    scheduledAt: null,
    sentAt: new Date('2026-06-18T10:00:00.000Z'),
    bullJobId: null,
    providerMessageId: 'gmail-outbound-1',
    providerThreadId: 'gmail-thread-1',
    metadata: null,
    createdAt: new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: new Date('2026-06-18T10:00:00.000Z'),
    ...input
  };
}

function createPrismaInboxMessage(input: InboxPrismaRecord = {}) {
  return {
    id: 'inbox-message-1',
    threadId: 'inbox-thread-1',
    organizationId: 'org-1',
    ownerUserId: 'user-1',
    accountId: 'account-1',
    contactId: 'contact-1',
    enrollmentId: 'enrollment-1',
    mailboxId: 'mailbox-1',
    provider: 'gmail',
    providerMessageId: 'gmail-message-1',
    replyToMessageId: 'message-1',
    fromEmail: 'ali@example.com',
    fromEmailHash: 'contact-hash-1',
    maskedFromEmail: 'a***@example.com',
    subject: 'Re: Bearing Series for ABC Trading',
    snippet: 'Please send details.',
    bodyText: 'Please send details.',
    receivedAt: new Date('2026-06-18T11:00:00.000Z'),
    messageType: 'customer_reply',
    createdAt: new Date('2026-06-18T11:00:00.000Z'),
    ...input
  };
}

function createPrismaInboxThread(input: InboxPrismaRecord = {}) {
  return {
    id: 'inbox-thread-1',
    organizationId: 'org-1',
    ownerUserId: 'user-1',
    accountId: 'account-1',
    contactId: 'contact-1',
    enrollmentId: 'enrollment-1',
    mailboxId: 'mailbox-1',
    provider: 'gmail',
    providerThreadId: 'enrollment-1',
    subject: 'Re: Bearing Series for ABC Trading',
    status: 'pending',
    lastInboundAt: new Date('2026-06-18T11:00:00.000Z'),
    unreadCount: 1,
    messageCount: 1,
    replyDraftBodyText: null,
    replyDraftTopic: null,
    replyDraftMetadata: null,
    replyDraftUpdatedAt: null,
    replyDraftUpdatedById: null,
    replyDraftUpdatedByName: null,
    createdAt: new Date('2026-06-18T11:00:00.000Z'),
    updatedAt: new Date('2026-06-18T11:00:00.000Z'),
    ...input
  };
}

/** Builds the smallest Prisma fake needed by the focused inbox repository tests. */
function createInboxPrisma(
  options: {
    inboxMessage?: ReturnType<typeof createPrismaInboxMessage>;
  } = {}
) {
  const account = createPrismaAccount();
  const contact = createPrismaContact();
  const mailbox = createPrismaMailbox();
  const enrollment = createPrismaEnrollment();
  const outboundMessage = {
    ...createPrismaMessage(),
    account,
    contact,
    mailbox,
    enrollment
  };
  const inboxMessage = options.inboxMessage ?? createPrismaInboxMessage();
  const inboxThread = {
    ...createPrismaInboxThread(),
    account,
    contact,
    mailbox,
    enrollment,
    messages: [inboxMessage]
  };

  const prisma = {
    transactionCalls: 0,
    async $transaction<T>(operation: (tx: unknown) => Promise<T>) {
      this.transactionCalls += 1;
      return operation(this);
    },
    crmAccount: {
      findUniqueCalls: [] as Array<{ where: InboxPrismaRecord }>,
      updateCalls: [] as Array<{ where: InboxPrismaRecord; data: InboxPrismaRecord }>,
      async findUnique(args: { where: InboxPrismaRecord }) {
        this.findUniqueCalls.push(args);
        return account;
      },
      async update(args: { where: InboxPrismaRecord; data: InboxPrismaRecord }) {
        this.updateCalls.push(args);
        Object.assign(account, args.data, { updatedAt: new Date('2026-06-18T12:00:00.000Z') });
        return account;
      }
    },
    crmContact: {
      updateCalls: [] as Array<{ where: InboxPrismaRecord; data: InboxPrismaRecord }>,
      async update(args: { where: InboxPrismaRecord; data: InboxPrismaRecord }) {
        this.updateCalls.push(args);
        Object.assign(contact, args.data, { updatedAt: new Date('2026-06-18T12:00:00.000Z') });
        return contact;
      }
    },
    crmSequenceEnrollment: {
      findUniqueCalls: [] as Array<{ where: InboxPrismaRecord }>,
      updateManyCalls: [] as Array<{ where: InboxPrismaRecord; data: InboxPrismaRecord }>,
      async findUnique(args: { where: InboxPrismaRecord }) {
        this.findUniqueCalls.push(args);
        return enrollment;
      },
      async updateMany(args: { where: InboxPrismaRecord; data: InboxPrismaRecord }) {
        this.updateManyCalls.push(args);
        Object.assign(enrollment, args.data, { updatedAt: new Date('2026-06-18T12:00:00.000Z') });
        return { count: 1 };
      }
    },
    crmMessage: {
      findFirstCalls: [] as Array<{
        where: InboxPrismaRecord;
        include?: InboxPrismaRecord;
        select?: InboxPrismaRecord;
      }>,
      updateManyCalls: [] as Array<{ where: InboxPrismaRecord; data: InboxPrismaRecord }>,
      async findFirst(args: { where: InboxPrismaRecord; include?: InboxPrismaRecord; select?: InboxPrismaRecord }) {
        this.findFirstCalls.push(args);
        return args.select ? { mailboxId: outboundMessage.mailboxId } : outboundMessage;
      },
      async updateMany(args: { where: InboxPrismaRecord; data: InboxPrismaRecord }) {
        this.updateManyCalls.push(args);
        return { count: 1 };
      }
    },
    crmInboxThread: {
      createCalls: [] as Array<{ data: InboxPrismaRecord }>,
      countCalls: [] as Array<{ where: InboxPrismaRecord }>,
      findFirstCalls: [] as Array<{ where: InboxPrismaRecord; include?: InboxPrismaRecord }>,
      findManyCalls: [] as Array<{
        where: InboxPrismaRecord;
        skip: number;
        take: number;
        orderBy: InboxPrismaRecord;
        include: InboxPrismaRecord;
      }>,
      updateCalls: [] as Array<{ where: InboxPrismaRecord; data: InboxPrismaRecord }>,
      updateManyAndReturnCalls: [] as Array<{
        where: InboxPrismaRecord;
        data: InboxPrismaRecord;
        limit: number;
      }>,
      async create(args: { data: InboxPrismaRecord }) {
        this.createCalls.push(args);
        Object.assign(inboxThread, args.data);
        return inboxThread;
      },
      async findFirst(args: { where: InboxPrismaRecord; include?: InboxPrismaRecord }) {
        this.findFirstCalls.push(args);
        return args.include
          ? inboxThread
          : {
              ...inboxThread,
              account: undefined,
              contact: undefined,
              mailbox: undefined,
              enrollment: undefined,
              messages: undefined
            };
      },
      async findMany(args: {
        where: InboxPrismaRecord;
        skip: number;
        take: number;
        orderBy: InboxPrismaRecord;
        include: InboxPrismaRecord;
      }) {
        this.findManyCalls.push(args);
        return [inboxThread];
      },
      async count(args: { where: InboxPrismaRecord }) {
        this.countCalls.push(args);
        return 1;
      },
      async update(args: { where: InboxPrismaRecord; data: InboxPrismaRecord }) {
        this.updateCalls.push(args);
        Object.assign(inboxThread, args.data, { updatedAt: new Date('2026-06-18T12:00:00.000Z') });
        return inboxThread;
      },
      async updateManyAndReturn(args: { where: InboxPrismaRecord; data: InboxPrismaRecord; limit: number }) {
        this.updateManyAndReturnCalls.push(args);
        Object.assign(inboxThread, args.data, { updatedAt: new Date('2026-06-18T12:00:00.000Z') });
        return [inboxThread];
      }
    },
    crmInboxMessage: {
      findFirstCalls: [] as Array<{ where: InboxPrismaRecord; include?: InboxPrismaRecord }>,
      createCalls: [] as Array<{ data: InboxPrismaRecord }>,
      updateCalls: [] as Array<{ where: InboxPrismaRecord; data: InboxPrismaRecord; include?: InboxPrismaRecord }>,
      createError: null as Error | null,
      findFirstResult: 'default' as 'default' | null,
      findFirstResults: [] as Array<'default' | null>,
      async findFirst(args: { where: InboxPrismaRecord; include?: InboxPrismaRecord }) {
        this.findFirstCalls.push(args);
        const result = this.findFirstResults.length > 0 ? this.findFirstResults.shift() : this.findFirstResult;
        if (result === null) return null;

        return args.include
          ? { ...inboxMessage, thread: inboxThread, account, contact, mailbox, enrollment }
          : { ...inboxMessage, thread: inboxThread };
      },
      async create(args: { data: InboxPrismaRecord }) {
        this.createCalls.push(args);
        if (this.createError) throw this.createError;
        Object.assign(inboxMessage, args.data, { createdAt: new Date('2026-06-18T11:00:00.000Z') });
        return inboxMessage;
      },
      async update(args: { where: InboxPrismaRecord; data: InboxPrismaRecord; include?: InboxPrismaRecord }) {
        this.updateCalls.push(args);
        Object.assign(inboxMessage, args.data);
        return args.include
          ? { ...inboxMessage, thread: inboxThread, account, contact, mailbox, enrollment }
          : inboxMessage;
      }
    },
    crmBlacklist: {
      upsertCalls: [] as Array<{
        where: InboxPrismaRecord;
        create: InboxPrismaRecord;
        update: InboxPrismaRecord;
      }>,
      async upsert(args: { where: InboxPrismaRecord; create: InboxPrismaRecord; update: InboxPrismaRecord }) {
        this.upsertCalls.push(args);
        return {
          id: 'blacklist-1',
          ...args.create,
          ...args.update,
          createdAt: new Date('2026-06-18T12:00:00.000Z'),
          updatedAt: new Date('2026-06-18T12:00:00.000Z')
        };
      }
    },
    crmTimelineEvent: {
      findManyCalls: [] as Array<{ where: InboxPrismaRecord; orderBy: InboxPrismaRecord }>,
      createCalls: [] as Array<{ data: InboxPrismaRecord }>,
      async findMany(args: { where: InboxPrismaRecord; orderBy: InboxPrismaRecord }) {
        this.findManyCalls.push(args);
        return [
          {
            id: 'event-history-1',
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
      },
      async create(args: { data: InboxPrismaRecord }) {
        this.createCalls.push(args);
        return {
          id: `event-${this.createCalls.length}`,
          organizationId: args.data.organizationId,
          accountId: args.data.accountId,
          contactId: args.data.contactId ?? null,
          ownerUserId: args.data.ownerUserId,
          eventType: args.data.eventType,
          title: args.data.title,
          content: args.data.content ?? null,
          metadata: args.data.metadata ?? null,
          createdAt: new Date('2026-06-18T12:00:00.000Z')
        };
      }
    }
  };

  return prisma;
}
