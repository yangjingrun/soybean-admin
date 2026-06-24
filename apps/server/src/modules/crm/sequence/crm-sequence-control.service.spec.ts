import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import type {
  CrmAccountRecord,
  CrmContactRecord,
  CrmGlobalConfigRecord,
  CrmMailboxRecord,
  CrmMessageRecord,
  CrmSequenceEnrollmentRecord,
  CrmSequenceReviewRecord,
  CrmTimelineEventRecord,
  CrmUserContext
} from '../crm.types';
import type { CrmSendAvailabilityService } from '../crm-send-availability.service';
import type { CrmSettingsRepository } from '../settings/crm-settings.repository';
import type { CrmSequenceControlRepository } from './crm-sequence-control.repository';
import { CrmSequenceControlService } from './crm-sequence-control.service';

describe('CrmSequenceControlService recovery actions', () => {
  it('returns one unsent first message to editable review state', async () => {
    const calls: string[] = [];
    const service = createService({
      item: createReviewItem({
        enrollment: createEnrollment({ status: 'ready_to_send' }),
        firstMessage: createMessage({ status: 'draft_ready' })
      }),
      repository: {
        async returnFirstMessageToEdit(input) {
          calls.push(`${input.enrollmentId}:${input.fromMessageStatuses.join(',')}`);

          return {
            enrollment: createEnrollment({ status: 'draft_review_pending', runVersion: 2 }),
            message: createMessage({ status: 'draft_pending_review', bullJobId: null, scheduledAt: null }),
            account: createAccount({ status: 'ready' }),
            event: createTimelineEvent({ eventType: 'message_returned_to_edit' })
          };
        }
      }
    });

    const result = await service.returnFirstMessageToEdit('enrollment-1', createContext());

    assert.equal(result.enrollment.status, 'draft_review_pending');
    assert.equal(result.message.status, 'draft_pending_review');
    assert.deepEqual(calls, ['enrollment-1:draft_ready,queued,failed,skipped']);
  });

  it('rejects editing a first message that has already been sent', async () => {
    const service = createService({
      item: createReviewItem({
        firstMessage: createMessage({
          status: 'sent',
          sentAt: new Date('2026-06-18T10:00:00.000Z'),
          providerMessageId: 'gmail-message-1'
        })
      })
    });

    await assert.rejects(() => service.returnFirstMessageToEdit('enrollment-1', createContext()), {
      name: BadRequestException.name,
      message: /已经发出/
    });
  });

  it('resumes a stopped unsent first message without sending it immediately', async () => {
    const service = createService({
      item: createReviewItem({
        enrollment: createEnrollment({ status: 'stopped' }),
        firstMessage: createMessage({ status: 'skipped' })
      }),
      repository: {
        async resumeSequenceEnrollment() {
          return {
            enrollment: createEnrollment({ status: 'ready_to_send', runVersion: 3 }),
            message: createMessage({ status: 'draft_ready', bullJobId: null }),
            account: createAccount({ status: 'ready' }),
            event: createTimelineEvent({ eventType: 'sequence_resumed' })
          };
        }
      }
    });

    const result = await service.resumeSequenceEnrollment('enrollment-1', createContext());

    assert.equal(result.enrollment.status, 'ready_to_send');
    assert.equal(result.message?.status, 'draft_ready');
  });

  it('retries an unsent first message by placing it back in the send schedule', async () => {
    const nextAvailableAt = new Date('2026-06-24T13:00:00.000Z');
    const service = createService({
      availabilityService: {
        evaluate() {
          return {
            canSend: false,
            timeZone: 'America/New_York',
            reason: 'outside_window',
            nextAvailableAt
          };
        }
      } as unknown as CrmSendAvailabilityService,
      item: createReviewItem({
        enrollment: createEnrollment({ status: 'stopped' }),
        firstMessage: createMessage({ status: 'skipped' }),
        account: createAccount({
          country: 'US',
          city: 'New York',
          timeZone: 'America/New_York'
        })
      }),
      repository: {
        async retryFirstMessageSend(input) {
          assert.equal(input.fromEnrollmentStatuses.includes('stopped'), true);
          assert.equal(input.scheduledAt.toISOString(), nextAvailableAt.toISOString());

          return {
            enrollment: createEnrollment({ status: 'sequence_running', runVersion: 3 }),
            message: createMessage({ status: 'draft_ready', scheduledAt: input.scheduledAt }),
            account: createAccount({ status: 'sequence_running' }),
            contact: createContact(),
            mailbox: createMailbox(),
            event: createTimelineEvent({ eventType: 'message_send_scheduled' })
          };
        }
      }
    });

    const result = await service.retryFirstMessageSend('enrollment-1', createContext());

    assert.equal(result.enrollment.status, 'sequence_running');
    assert.equal(result.message.status, 'draft_ready');
    assert.equal(result.message.scheduledAt, nextAvailableAt.toISOString());
  });
});

function createService(input: {
  item?: CrmSequenceReviewRecord | null;
  repository?: Partial<CrmSequenceControlRepository>;
  settingsRepository?: CrmSettingsRepository;
  availabilityService?: CrmSendAvailabilityService;
}) {
  const repository: CrmSequenceControlRepository = {
    async getSequenceReviewItem() {
      return input.item === undefined ? createReviewItem() : input.item;
    },
    async findBlacklistEntry() {
      return null;
    },
    async listMailboxSendScheduleTimes() {
      return [];
    },
    async startFirstMessageSend() {
      throw new Error('startFirstMessageSend should not be called');
    },
    async stopSequenceEnrollment() {
      throw new Error('stopSequenceEnrollment should not be called');
    },
    async returnFirstMessageToEdit() {
      throw new Error('returnFirstMessageToEdit should not be called');
    },
    async resumeSequenceEnrollment() {
      throw new Error('resumeSequenceEnrollment should not be called');
    },
    async retryFirstMessageSend() {
      throw new Error('retryFirstMessageSend should not be called');
    },
    ...input.repository
  };

  return new CrmSequenceControlService(
    repository,
    input.settingsRepository ?? createSettingsRepository(),
    input.availabilityService ?? createAvailabilityService(),
    undefined
  );
}

function createContext(): CrmUserContext {
  return {
    userId: 'user-1',
    userName: 'Alice',
    roles: ['R_USER'],
    organizationId: 'org-1',
    organizationRole: 'member'
  };
}

function createReviewItem(
  overrides: Partial<CrmSequenceReviewRecord> & {
    enrollment?: CrmSequenceEnrollmentRecord;
    firstMessage?: CrmMessageRecord | null;
  } = {}
): CrmSequenceReviewRecord {
  const enrollment = overrides.enrollment ?? createEnrollment();
  const firstMessage = overrides.firstMessage === undefined ? createMessage() : overrides.firstMessage;
  const messages = firstMessage ? [firstMessage] : [];

  return {
    enrollment,
    account: createAccount(),
    contact: createContact(),
    productLine: null,
    policy: null,
    mailbox: createMailbox(),
    firstMessage,
    messages,
    ...overrides
  };
}

function createEnrollment(overrides: Partial<CrmSequenceEnrollmentRecord> = {}): CrmSequenceEnrollmentRecord {
  return {
    id: 'enrollment-1',
    organizationId: 'org-1',
    ownerUserId: 'user-1',
    accountId: 'account-1',
    contactId: 'contact-1',
    productLineId: 'product-line-1',
    mailboxId: 'mailbox-1',
    policyId: null,
    name: 'ABC Trading - Ali',
    status: 'ready_to_send',
    currentStep: 1,
    totalSteps: 5,
    runVersion: 1,
    createdById: 'user-1',
    createdByName: 'Alice',
    createdAt: new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: new Date('2026-06-18T09:00:00.000Z'),
    ...overrides
  };
}

function createMessage(overrides: Partial<CrmMessageRecord> = {}): CrmMessageRecord {
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
    status: 'draft_ready',
    scheduledAt: null,
    sentAt: null,
    bullJobId: null,
    providerMessageId: null,
    providerThreadId: null,
    recipientTimeZone: null,
    metadata: null,
    createdAt: new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: new Date('2026-06-18T09:00:00.000Z'),
    ...overrides
  };
}

function createAccount(overrides: Partial<CrmAccountRecord> = {}): CrmAccountRecord {
  return {
    id: 'account-1',
    organizationId: 'org-1',
    ownerUserId: 'user-1',
    name: 'ABC Trading',
    normalizedName: 'abc trading',
    websiteUrl: null,
    domain: null,
    country: null,
    city: null,
    address: null,
    timeZone: null,
    customerType: null,
    status: 'ready',
    sourceTaskId: null,
    archivedAt: null,
    archiveReason: null,
    archiveSlimmedAt: null,
    createdAt: new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: new Date('2026-06-18T09:00:00.000Z'),
    ...overrides
  };
}

function createSettingsRepository(): CrmSettingsRepository {
  return {
    async getGlobalConfig() {
      return createGlobalConfig();
    }
  } as unknown as CrmSettingsRepository;
}

function createAvailabilityService(): CrmSendAvailabilityService {
  return {
    evaluate() {
      return {
        canSend: true,
        timeZone: 'Asia/Shanghai',
        reason: 'within_window'
      };
    }
  } as unknown as CrmSendAvailabilityService;
}

function createGlobalConfig(overrides: Partial<CrmGlobalConfigRecord> = {}): CrmGlobalConfigRecord {
  return {
    configKey: 'global',
    emailVerificationCooldownDays: 30,
    ownerConcurrentSendLimit: 3,
    ownerDailySendLimitMax: 100,
    followUpDelayDays: {
      step2Days: 3,
      step3Days: 7,
      step4Days: 14,
      step5Days: 21
    },
    sendWorkdays: [1, 2, 3, 4, 5],
    sendWindows: [
      { startMinute: 9 * 60, endMinute: 12 * 60 },
      { startMinute: 14 * 60, endMinute: 18 * 60 }
    ],
    updatedAt: new Date('2026-06-18T09:00:00.000Z'),
    ...overrides
  };
}

function createContact(overrides: Partial<CrmContactRecord> = {}): CrmContactRecord {
  return {
    id: 'contact-1',
    organizationId: 'org-1',
    accountId: 'account-1',
    ownerUserId: 'user-1',
    fullName: 'Ali',
    title: 'Buyer',
    email: 'ali@example.com',
    emailHash: 'hash-1',
    maskedEmail: 'a***@example.com',
    isPublicEmail: false,
    emailStatus: 'valid',
    sourceTaskId: null,
    createdAt: new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: new Date('2026-06-18T09:00:00.000Z'),
    ...overrides
  };
}

function createMailbox(overrides: Partial<CrmMailboxRecord> = {}): CrmMailboxRecord {
  return {
    id: 'mailbox-1',
    organizationId: 'org-1',
    ownerUserId: 'user-1',
    ownerUserName: 'Alice',
    provider: 'gmail',
    emailAddress: 'alice@example.com',
    emailHash: 'mailbox-hash',
    maskedEmail: 'a***@example.com',
    status: 'active',
    dailyLimit: 50,
    hourlyLimit: 10,
    warmupStage: 'ready',
    encryptedRefreshToken: 'encrypted',
    watchExpiration: null,
    lastHistoryId: null,
    authorizedAt: new Date('2026-06-18T09:00:00.000Z'),
    pausedAt: null,
    createdAt: new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: new Date('2026-06-18T09:00:00.000Z'),
    ...overrides
  };
}

function createTimelineEvent(overrides: Partial<CrmTimelineEventRecord> = {}): CrmTimelineEventRecord {
  return {
    id: 'event-1',
    organizationId: 'org-1',
    accountId: 'account-1',
    contactId: 'contact-1',
    ownerUserId: 'user-1',
    eventType: 'message_send_scheduled',
    title: '开发信状态变更',
    content: null,
    metadata: null,
    createdAt: new Date('2026-06-18T09:00:00.000Z'),
    ...overrides
  };
}
