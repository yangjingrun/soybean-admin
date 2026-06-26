import assert from 'node:assert/strict';
import test from 'node:test';
import type { SystemNotificationService } from '../../system-notification/system-notification.service';
import type {
  CrmAccountRecord,
  CrmContactRecord,
  CrmMailboxRecord,
  CrmMessageRecord,
  CrmSequenceEnrollmentRecord
} from '../crm.types';
import { CrmTrackingService } from './crm-tracking.service';
import type {
  CrmEmailOpenEventRecord,
  CrmEmailOpenRecordInput,
  CrmEmailOpenTargetRecord,
  CrmTrackingRepository
} from './crm-tracking.types';

test('CrmTrackingService records first open and creates one notification with focused route', async () => {
  const target = createTarget();
  const repository = createRepository(target);
  const notifications = createNotificationService();
  const service = new CrmTrackingService(repository, notifications);
  const openedAt = new Date('2026-06-23T01:00:00.000Z');

  const result = await service.recordEmailOpen({
    messageId: target.message.id,
    openedAt,
    userAgent: 'AppleWebKit',
    ipAddress: '127.0.0.1'
  });

  assert.equal(result?.isFirstOpen, true);
  assert.equal(repository.recordInputs[0].userAgent, 'AppleWebKit');
  assert.equal(repository.timelineEvents.length, 1);
  assert.equal(repository.timelineEvents[0].eventType, 'email_opened');
  assert.equal(notifications.created.length, 1);
  assert.equal(notifications.created[0].type, 'crm_email_opened');
  assert.deepEqual(
    (notifications.created[0].metadata as { openInsight?: Record<string, unknown> }).openInsight,
    {
      clientName: null,
      clientType: null,
      confidence: 'low',
      deviceBrand: null,
      deviceLabel: '未知设备',
      deviceModel: null,
      deviceType: null,
      ipAddress: '127.0.0.1',
      ipReliability: 'direct',
      osName: null,
      osVersion: null,
      proxyProvider: null,
      reliabilityNote: '邮件客户端提供的信息有限，设备和 IP 仅供参考。',
      userAgent: 'AppleWebKit'
    }
  );
  assert.equal(
    notifications.created[0].routePath,
    '/crm/email-sequences?focus=tracking-open&enrollmentId=enrollment-1&messageId=message-1&eventId=open-1'
  );
});

test('CrmTrackingService does not create duplicate notification for repeated opens', async () => {
  const target = createTarget();
  const repository = createRepository(target, false);
  const notifications = createNotificationService();
  const service = new CrmTrackingService(repository, notifications);

  const result = await service.recordEmailOpen({
    messageId: target.message.id,
    openedAt: new Date('2026-06-23T01:05:00.000Z')
  });

  assert.equal(result?.isFirstOpen, false);
  assert.equal(repository.timelineEvents.length, 0);
  assert.equal(notifications.created.length, 0);
});

test('CrmTrackingService ignores missing or unsent messages', async () => {
  const repository = createRepository(null);
  const notifications = createNotificationService();
  const service = new CrmTrackingService(repository, notifications);

  const result = await service.recordEmailOpen({
    messageId: 'missing',
    openedAt: new Date('2026-06-23T01:05:00.000Z')
  });

  assert.equal(result, null);
  assert.equal(repository.recordInputs.length, 0);
  assert.equal(notifications.created.length, 0);
});

function createRepository(target: CrmEmailOpenTargetRecord | null, isFirstOpen = true) {
  const event = createOpenEvent();
  const repository: CrmTrackingRepository & {
    recordInputs: CrmEmailOpenRecordInput[];
    timelineEvents: Parameters<CrmTrackingRepository['createTimelineEvent']>[0][];
  } = {
    recordInputs: [],
    timelineEvents: [],
    async findEmailOpenTargetByMessageId() {
      return target;
    },
    async recordEmailOpen(input) {
      this.recordInputs.push(input);
      return {
        event,
        isFirstOpen
      };
    },
    async createTimelineEvent(input) {
      this.timelineEvents.push(input);
      return {
        id: 'timeline-1',
        ...input,
        contactId: input.contactId ?? null,
        content: input.content ?? null,
        metadata: input.metadata ?? null,
        createdAt: new Date('2026-06-23T01:00:00.000Z')
      };
    }
  };

  return repository;
}

function createNotificationService() {
  const service = {
    created: [] as Parameters<SystemNotificationService['create']>[0][],
    async create(input: Parameters<SystemNotificationService['create']>[0]) {
      this.created.push(input);
      return {
        id: 'notification-1',
        ...input,
        userName: input.userName ?? null,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        routePath: input.routePath ?? null,
        metadata: input.metadata ?? null,
        status: 'pending',
        shownAt: null,
        readAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }
  };

  return service as unknown as SystemNotificationService & {
    created: Parameters<SystemNotificationService['create']>[0][];
  };
}

function createTarget(): CrmEmailOpenTargetRecord {
  return {
    message: createMessage(),
    account: createAccount(),
    contact: createContact(),
    enrollment: createEnrollment(),
    mailbox: createMailbox()
  };
}

function createOpenEvent(): CrmEmailOpenEventRecord {
  return {
    id: 'open-1',
    organizationId: 'org-1',
    ownerUserId: 'user-1',
    accountId: 'account-1',
    contactId: 'contact-1',
    enrollmentId: 'enrollment-1',
    messageId: 'message-1',
    openCount: 1,
    firstOpenedAt: new Date('2026-06-23T01:00:00.000Z'),
    lastOpenedAt: new Date('2026-06-23T01:00:00.000Z'),
    lastUserAgent: 'AppleWebKit',
    lastIpAddress: '127.0.0.1',
    createdAt: new Date('2026-06-23T01:00:00.000Z'),
    updatedAt: new Date('2026-06-23T01:00:00.000Z')
  };
}

function createMessage(): CrmMessageRecord {
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
    subject: 'Hello',
    bodyText: 'Body',
    status: 'sent',
    scheduledAt: null,
    sentAt: new Date('2026-06-23T00:00:00.000Z'),
    bullJobId: null,
    providerMessageId: 'gmail-message-1',
    providerThreadId: 'gmail-thread-1',
    recipientTimeZone: null,
    metadata: null,
    createdAt: new Date('2026-06-23T00:00:00.000Z'),
    updatedAt: new Date('2026-06-23T00:00:00.000Z')
  };
}

function createAccount(): CrmAccountRecord {
  return {
    id: 'account-1',
    organizationId: 'org-1',
    ownerUserId: 'user-1',
    name: 'ACME',
    normalizedName: 'acme',
    websiteUrl: null,
    domain: null,
    country: null,
    city: null,
    address: null,
    timeZone: null,
    customerType: null,
    status: 'sequence_running',
    sourceTaskId: null,
    archivedAt: null,
    archiveReason: null,
    archiveSlimmedAt: null,
    createdAt: new Date('2026-06-22T00:00:00.000Z'),
    updatedAt: new Date('2026-06-22T00:00:00.000Z')
  };
}

function createContact(): CrmContactRecord {
  return {
    id: 'contact-1',
    organizationId: 'org-1',
    accountId: 'account-1',
    ownerUserId: 'user-1',
    fullName: 'Jane',
    title: null,
    email: 'jane@example.com',
    emailHash: 'hash',
    maskedEmail: 'j***@example.com',
    isPublicEmail: false,
    emailStatus: 'valid',
    sourceTaskId: null,
    createdAt: new Date('2026-06-22T00:00:00.000Z'),
    updatedAt: new Date('2026-06-22T00:00:00.000Z')
  };
}

function createEnrollment(): CrmSequenceEnrollmentRecord {
  return {
    id: 'enrollment-1',
    organizationId: 'org-1',
    ownerUserId: 'user-1',
    accountId: 'account-1',
    contactId: 'contact-1',
    productLineId: null,
    mailboxId: 'mailbox-1',
    policyId: null,
    name: 'ACME sequence',
    status: 'sequence_running',
    currentStep: 1,
    totalSteps: 5,
    runVersion: 1,
    createdById: 'user-1',
    createdByName: 'Owner',
    createdAt: new Date('2026-06-22T00:00:00.000Z'),
    updatedAt: new Date('2026-06-22T00:00:00.000Z')
  };
}

function createMailbox(): CrmMailboxRecord {
  return {
    id: 'mailbox-1',
    organizationId: 'org-1',
    ownerUserId: 'user-1',
    ownerUserName: 'Owner',
    provider: 'gmail',
    emailAddress: 'owner@example.com',
    emailHash: 'mailbox-hash',
    maskedEmail: 'o***@example.com',
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
    authorizedAt: new Date('2026-06-22T00:00:00.000Z'),
    pausedAt: null,
    createdAt: new Date('2026-06-22T00:00:00.000Z'),
    updatedAt: new Date('2026-06-22T00:00:00.000Z')
  };
}
