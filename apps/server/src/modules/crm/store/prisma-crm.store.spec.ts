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

  it('creates and lists product lines with organization scope only', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmStore(prisma as never);

    await store.createProductLine({
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
      status: 'active',
      createdById: 'user-1',
      createdByName: 'Alice'
    });
    const result = await store.listProductLines({
      organizationId: 'org-1',
      keyword: 'bearing',
      status: 'active',
      skip: 0,
      take: 20
    });

    assert.equal(prisma.crmProductLine.createCalls[0].data.organizationId, 'org-1');
    assert.deepEqual(prisma.crmProductLine.findManyCalls[0].where, {
      organizationId: 'org-1',
      status: 'active',
      OR: [
        { name: { contains: 'bearing', mode: 'insensitive' } },
        { targetCustomerType: { contains: 'bearing', mode: 'insensitive' } },
        { coreSellingPoints: { contains: 'bearing', mode: 'insensitive' } },
        { moq: { contains: 'bearing', mode: 'insensitive' } },
        { leadTime: { contains: 'bearing', mode: 'insensitive' } },
        { paymentTerms: { contains: 'bearing', mode: 'insensitive' } },
        { certifications: { contains: 'bearing', mode: 'insensitive' } },
        { commonModelsText: { contains: 'bearing', mode: 'insensitive' } }
      ]
    });
    assert.deepEqual(prisma.crmProductLine.findManyCalls[0].orderBy, { updatedAt: 'desc' });
    assert.equal(result.records[0].id, 'product-line-1');
    assert.equal(result.total, 1);
  });

  it('finds product line by organization name for duplicate checks', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmStore(prisma as never);

    const productLine = await store.findProductLineByName('org-1', 'Bearing Series');

    assert.equal(productLine?.id, 'product-line-1');
    assert.deepEqual(prisma.crmProductLine.findUniqueCalls[0].where, {
      organizationId_name: {
        organizationId: 'org-1',
        name: 'Bearing Series'
      }
    });
  });

  it('finds and updates product lines through organization scoped identity', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmStore(prisma as never);

    const found = await store.findProductLineById({
      id: 'product-line-1',
      organizationId: 'org-1'
    });
    const updated = await store.updateProductLine('product-line-1', 'org-1', {
      name: 'Premium Bearing Series',
      status: 'archived'
    });

    assert.equal(found?.id, 'product-line-1');
    assert.equal(updated?.status, 'archived');
    assert.deepEqual(prisma.crmProductLine.findFirstCalls[0].where, {
      id: 'product-line-1',
      organizationId: 'org-1'
    });
    assert.deepEqual(prisma.crmProductLine.updateManyAndReturnCalls[0], {
      where: {
        id: 'product-line-1',
        organizationId: 'org-1'
      },
      data: {
        name: 'Premium Bearing Series',
        status: 'archived'
      },
      limit: 1
    });
  });

  it('creates and lists sequence review items with scoped include data', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmStore(prisma as never);

    await store.createSequenceEnrollment({
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      accountId: 'account-1',
      contactId: 'contact-1',
      productLineId: 'product-line-1',
      mailboxId: 'mailbox-1',
      name: 'ABC Trading - Ali Hassan',
      status: 'draft_review_pending',
      currentStep: 1,
      totalSteps: 5,
      runVersion: 1,
      createdById: 'user-1',
      createdByName: 'Alice'
    });
    const result = await store.listSequenceReviewItems({
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      keyword: 'abc',
      status: 'draft_review_pending',
      skip: 0,
      take: 20
    });

    assert.equal(prisma.crmSequenceEnrollment.createCalls[0].data.organizationId, 'org-1');
    assert.deepEqual(prisma.crmSequenceEnrollment.findManyCalls[0].where, {
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      status: 'draft_review_pending',
      OR: [
        { name: { contains: 'abc', mode: 'insensitive' } },
        { account: { name: { contains: 'abc', mode: 'insensitive' } } },
        { account: { domain: { contains: 'abc', mode: 'insensitive' } } },
        { contact: { fullName: { contains: 'abc', mode: 'insensitive' } } },
        { contact: { title: { contains: 'abc', mode: 'insensitive' } } },
        { contact: { maskedEmail: { contains: 'abc', mode: 'insensitive' } } }
      ]
    });
    assert.equal(result.records[0].firstMessage?.id, 'message-1');
    assert.equal(result.total, 1);
  });

  it('finds active enrollments and updates draft messages through scoped identities', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmStore(prisma as never);

    const enrollment = await store.findActiveEnrollmentByContact({
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      contactId: 'contact-1',
      statuses: ['draft_review_pending', 'ready_to_send']
    });
    const message = await store.findMessageById({
      id: 'message-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1'
    });
    const updated = await store.updateMessage('message-1', 'org-1', {
      subject: 'Updated',
      status: 'draft_ready'
    });

    assert.equal(enrollment?.id, 'enrollment-1');
    assert.equal(message?.id, 'message-1');
    assert.equal(updated?.status, 'draft_ready');
    assert.deepEqual(prisma.crmSequenceEnrollment.findFirstCalls[0].where, {
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      contactId: 'contact-1',
      status: { in: ['draft_review_pending', 'ready_to_send'] }
    });
    assert.deepEqual(prisma.crmMessage.findFirstCalls[0].where, {
      id: 'message-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1'
    });
  });

  it('starts first message sending with enrollment and message status guards', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmStore(prisma as never);

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
    assert.equal(prisma.crmTimelineEvent.createCalls.at(-1)?.data.eventType, 'message_queued');
  });

  it('does not mutate sending state when active mailbox guard fails inside transaction', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmStore(prisma as never);
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
    const prisma = createPrisma();
    const store = new PrismaCrmStore(prisma as never);

    const result = await store.claimFirstMessageSendDelivery({
      enrollmentId: 'enrollment-1',
      messageId: 'message-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      runVersion: 1,
      claimedAt: new Date('2026-06-18T10:30:00.000Z')
    });

    assert.equal(result?.firstMessage?.id, 'message-1');
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

  it('does not claim queued first message delivery when mailbox quota is exhausted', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmStore(prisma as never);
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

  it('stops one sequence and skips queued first message with status guard', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmStore(prisma as never);

    const result = await store.stopSequenceEnrollment({
      enrollmentId: 'enrollment-1',
      organizationId: 'org-1',
      fromStatuses: ['ready_to_send', 'sequence_running', 'paused'],
      accountStatus: 'paused',
      actorUserId: 'admin-1'
    });

    assert.equal(result?.enrollment.status, 'stopped');
    assert.deepEqual(prisma.crmSequenceEnrollment.updateManyAndReturnCalls[0].where, {
      id: 'enrollment-1',
      organizationId: 'org-1',
      status: { in: ['ready_to_send', 'sequence_running', 'paused'] }
    });
    assert.deepEqual(prisma.crmSequenceEnrollment.updateManyAndReturnCalls[0].data, {
      status: 'stopped',
      runVersion: { increment: 1 }
    });
    assert.deepEqual(prisma.crmMessage.updateManyAndReturnCalls[0].where, {
      enrollmentId: 'enrollment-1',
      organizationId: 'org-1',
      stepIndex: 1,
      status: 'queued'
    });
    assert.deepEqual(prisma.crmMessage.updateManyAndReturnCalls[0].data, {
      status: 'skipped',
      bullJobId: null
    });
    assert.equal(prisma.crmTimelineEvent.createCalls.at(-1)?.data.eventType, 'sequence_stopped');
  });

  it('lists inbox threads with scoped filters and include data', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmStore(prisma as never);

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
    const prisma = createPrisma();
    const store = new PrismaCrmStore(prisma as never);

    const result = await store.updateInboxThreadStatus({
      id: 'inbox-thread-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      fromStatus: 'pending',
      toStatus: 'handled',
      accountStatus: 'followed_up'
    });

    assert.equal(result?.thread.status, 'handled');
    assert.deepEqual(prisma.crmInboxThread.updateManyAndReturnCalls[0].where, {
      id: 'inbox-thread-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      status: 'pending'
    });
    assert.deepEqual(prisma.crmInboxThread.updateManyAndReturnCalls[0].data, {
      status: 'handled',
      unreadCount: 0
    });
    assert.equal(prisma.crmTimelineEvent.createCalls.at(-1)?.data.eventType, 'inbox_status_changed');
  });

  it('replies to inbox thread with mailbox sender and marks it handled', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmStore(prisma as never);
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
    assert.deepEqual(prisma.crmInboxThread.findFirstCalls.at(-1)?.where, {
      id: 'inbox-thread-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1'
    });
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
      fromEmailHash: 'hash-1',
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
    assert.deepEqual(prisma.crmAccount.updateCalls.at(-1), {
      where: { id: 'account-1' },
      data: { status: 'followed_up' }
    });
    assert.equal(prisma.crmTimelineEvent.createCalls.at(-1)?.data.eventType, 'inbox_replied');
  });

  it('marks contact unsubscribed when ingesting an unsubscribe reply', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmStore(prisma as never);

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
    assert.deepEqual(prisma.crmContact.updateCalls[0], {
      where: { id: 'contact-1' },
      data: { emailStatus: 'unsubscribed' }
    });
    assert.deepEqual(prisma.crmAccount.updateCalls.at(-1), {
      where: { id: 'account-1' },
      data: { status: 'blocked' }
    });
    assert.equal(prisma.crmTimelineEvent.createCalls.at(-1)?.data.eventType, 'customer_unsubscribed');
    const metadata = prisma.crmTimelineEvent.createCalls.at(-1)?.data.metadata as { messageType?: string } | undefined;
    assert.equal(metadata?.messageType, 'unsubscribe_hint');
  });

  it('marks contact unreachable when ingesting a bounce reply', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmStore(prisma as never);

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
    const metadata = prisma.crmTimelineEvent.createCalls.at(-1)?.data.metadata as { messageType?: string } | undefined;
    assert.equal(metadata?.messageType, 'bounce');
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
    createdAt: new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: new Date('2026-06-18T09:00:00.000Z'),
    ...input
  };
}

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
    status: 'active',
    createdById: 'user-1',
    createdByName: 'Alice',
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
  const message = createPrismaMessage();
  const enrollment = {
    id: 'enrollment-1',
    organizationId: 'org-1',
    ownerUserId: 'user-1',
    accountId: 'account-1',
    contactId: 'contact-1',
    productLineId: 'product-line-1',
    mailboxId: 'mailbox-1',
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
    messages: [message]
  };
  const inboxMessage = {
    id: 'inbox-message-1',
    threadId: 'inbox-thread-1',
    organizationId: 'org-1',
    ownerUserId: 'user-1',
    accountId: 'account-1',
    contactId: 'contact-1',
    enrollmentId: 'enrollment-1',
    mailboxId: 'mailbox-1',
    provider: 'gmail',
    providerMessageId: null,
    replyToMessageId: 'message-1',
    fromEmail: 'ali@example.com',
    fromEmailHash: 'hash-1',
    maskedFromEmail: 'a***@example.com',
    subject: 'Re: Bearing Series for ABC Trading',
    snippet: 'Please send details.',
    bodyText: 'Please send details.',
    receivedAt: new Date('2026-06-18T11:00:00.000Z'),
    messageType: 'customer_reply',
    createdAt: new Date('2026-06-18T11:00:00.000Z')
  };
  const inboxThread = {
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
    createdAt: new Date('2026-06-18T11:00:00.000Z'),
    updatedAt: new Date('2026-06-18T11:00:00.000Z'),
    account,
    contact,
    mailbox,
    enrollment,
    messages: [inboxMessage]
  };

  return {
    async $transaction<T>(operation: (tx: unknown) => Promise<T>) {
      return operation(this);
    },
    crmAccount: {
      createCalls: [] as Array<{ data: Record<string, unknown> }>,
      findUniqueCalls: [] as Array<{ where: Record<string, unknown> }>,
      findFirstCalls: [] as Array<{ where: Record<string, unknown> }>,
      findManyCalls: [] as Array<{ where: Record<string, unknown> }>,
      updateCalls: [] as Array<{ where: Record<string, unknown>; data: Record<string, unknown> }>,
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
      },
      async update(args: { where: Record<string, unknown>; data: Record<string, unknown> }) {
        this.updateCalls.push(args);
        return { ...account, ...args.data, updatedAt: new Date('2026-06-18T10:00:00.000Z') };
      }
    },
    crmContact: {
      findManyCalls: [] as Array<{ where: Record<string, unknown>; orderBy: Record<string, unknown> }>,
      findUniqueCalls: [] as Array<{ where: Record<string, unknown> }>,
      findFirstCalls: [] as Array<{ where: Record<string, unknown> }>,
      updateCalls: [] as Array<{ where: Record<string, unknown>; data: Record<string, unknown> }>,
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
      async findUnique(args: { where: Record<string, unknown> }) {
        this.findUniqueCalls.push(args);
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
      async update(args: { where: Record<string, unknown>; data: Record<string, unknown> }) {
        this.updateCalls.push(args);
        return { ...contact, ...args.data, updatedAt: new Date('2026-06-18T10:00:00.000Z') };
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
      createCalls: [] as Array<{ data: Record<string, unknown> }>,
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
      },
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
      findUniqueResult: null as Partial<typeof mailbox> | null,
      async create(args: { data: Record<string, unknown> }) {
        this.createCalls.push(args);
        if (this.createError) throw this.createError;
        return mailbox;
      },
      async findUnique(args: { where: Record<string, unknown> }) {
        this.findUniqueCalls.push(args);
        return this.findUniqueResult ? { ...mailbox, ...this.findUniqueResult } : mailbox;
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
    crmProductLine: {
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
        return productLine;
      },
      async findUnique(args: { where: Record<string, unknown> }) {
        this.findUniqueCalls.push(args);
        return productLine;
      },
      async findFirst(args: { where: Record<string, unknown> }) {
        this.findFirstCalls.push(args);
        return productLine;
      },
      async findMany(args: {
        where: Record<string, unknown>;
        skip: number;
        take: number;
        orderBy: Record<string, unknown>;
      }) {
        this.findManyCalls.push(args);
        return [productLine];
      },
      async count() {
        return 1;
      },
      async updateManyAndReturn(args: { where: Record<string, unknown>; data: Record<string, unknown>; limit: number }) {
        this.updateManyAndReturnCalls.push(args);
        return [{ ...productLine, ...args.data, updatedAt: new Date('2026-06-18T10:00:00.000Z') }];
      }
    },
    crmSequenceEnrollment: {
      createCalls: [] as Array<{ data: Record<string, unknown> }>,
      findFirstCalls: [] as Array<{ where: Record<string, unknown>; include?: Record<string, unknown> }>,
      findManyCalls: [] as Array<{
        where: Record<string, unknown>;
        skip: number;
        take: number;
        orderBy: Record<string, unknown>;
        include: Record<string, unknown>;
      }>,
      updateManyAndReturnCalls: [] as Array<{
        where: Record<string, unknown>;
        data: Record<string, unknown>;
        limit: number;
      }>,
      updateManyCalls: [] as Array<{
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      }>,
      async create(args: { data: Record<string, unknown> }) {
        this.createCalls.push(args);
        return enrollment;
      },
      async findFirst(args: { where: Record<string, unknown>; include?: Record<string, unknown> }) {
        this.findFirstCalls.push(args);
        if (args.include && args.where.status === 'sequence_running') {
          return {
            ...enrollment,
            status: 'sequence_running',
            messages: [{ ...message, status: 'queued' }]
          };
        }
        return args.include ? enrollment : { ...enrollment, account: undefined, contact: undefined, productLine: undefined, mailbox: undefined, messages: undefined };
      },
      async findMany(args: {
        where: Record<string, unknown>;
        skip: number;
        take: number;
        orderBy: Record<string, unknown>;
        include: Record<string, unknown>;
      }) {
        this.findManyCalls.push(args);
        return [enrollment];
      },
      async count() {
        return 1;
      },
      async updateManyAndReturn(args: { where: Record<string, unknown>; data: Record<string, unknown>; limit: number }) {
        this.updateManyAndReturnCalls.push(args);
        return [{ ...enrollment, ...args.data, updatedAt: new Date('2026-06-18T10:00:00.000Z') }];
      },
      async updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }) {
        this.updateManyCalls.push(args);
        return { count: 1 };
      }
    },
    crmMessage: {
      createCalls: [] as Array<{ data: Record<string, unknown> }>,
      findFirstCalls: [] as Array<{ where: Record<string, unknown> }>,
      updateManyAndReturnCalls: [] as Array<{
        where: Record<string, unknown>;
        data: Record<string, unknown>;
        limit: number;
      }>,
      async create(args: { data: Record<string, unknown> }) {
        this.createCalls.push(args);
        return message;
      },
      async findFirst(args: { where: Record<string, unknown>; include?: Record<string, unknown> }) {
        this.findFirstCalls.push(args);
        if (args.include && args.where.status === 'sent') {
          return {
            ...message,
            status: 'sent',
            account,
            contact,
            enrollment,
            mailbox
          };
        }
        return message;
      },
      async updateManyAndReturn(args: { where: Record<string, unknown>; data: Record<string, unknown>; limit: number }) {
        this.updateManyAndReturnCalls.push(args);
        return [{ ...message, ...args.data, updatedAt: new Date('2026-06-18T10:00:00.000Z') }];
      }
    },
    crmInboxThread: {
      createCalls: [] as Array<{ data: Record<string, unknown> }>,
      findFirstCalls: [] as Array<{ where: Record<string, unknown>; include?: Record<string, unknown> }>,
      findManyCalls: [] as Array<{
        where: Record<string, unknown>;
        skip: number;
        take: number;
        orderBy: Record<string, unknown>;
        include: Record<string, unknown>;
      }>,
      updateCalls: [] as Array<{ where: Record<string, unknown>; data: Record<string, unknown> }>,
      updateManyAndReturnCalls: [] as Array<{
        where: Record<string, unknown>;
        data: Record<string, unknown>;
        limit: number;
      }>,
      async create(args: { data: Record<string, unknown> }) {
        this.createCalls.push(args);
        return inboxThread;
      },
      async findFirst(args: { where: Record<string, unknown>; include?: Record<string, unknown> }) {
        this.findFirstCalls.push(args);
        return args.include ? inboxThread : { ...inboxThread, account: undefined, contact: undefined, mailbox: undefined, enrollment: undefined, messages: undefined };
      },
      async findMany(args: {
        where: Record<string, unknown>;
        skip: number;
        take: number;
        orderBy: Record<string, unknown>;
        include: Record<string, unknown>;
      }) {
        this.findManyCalls.push(args);
        return [inboxThread];
      },
      async count() {
        return 1;
      },
      async update(args: { where: Record<string, unknown>; data: Record<string, unknown> }) {
        this.updateCalls.push(args);
        return { ...inboxThread, ...args.data, updatedAt: new Date('2026-06-18T12:00:00.000Z') };
      },
      async updateManyAndReturn(args: { where: Record<string, unknown>; data: Record<string, unknown>; limit: number }) {
        this.updateManyAndReturnCalls.push(args);
        return [{ ...inboxThread, ...args.data, updatedAt: new Date('2026-06-18T12:00:00.000Z') }];
      }
    },
    crmInboxMessage: {
      createCalls: [] as Array<{ data: Record<string, unknown> }>,
      async create(args: { data: Record<string, unknown> }) {
        this.createCalls.push(args);
        return { ...inboxMessage, ...args.data };
      }
    }
  };
}
