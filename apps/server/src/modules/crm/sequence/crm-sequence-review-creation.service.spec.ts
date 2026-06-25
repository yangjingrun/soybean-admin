import assert from 'node:assert/strict';
import { BadRequestException } from '@nestjs/common';
import { describe, it } from 'node:test';
import { CrmSequenceReviewCreationService } from './crm-sequence-review-creation.service';
import type { CrmAccountRepository } from '../accounts/crm-account.repository';
import type { CrmMailboxRepository } from '../mailbox/crm-mailbox.repository';
import type { CrmSettingsRepository } from '../settings/crm-settings.repository';
import type { CrmSequenceRepository } from './crm-sequence.repository';
import type {
  CrmAccountRecord,
  CrmContactRecord,
  CrmGlobalConfigRecord,
  CrmMailboxRecord,
  CrmSequenceDraftBundleCreateInput,
  CrmSequencePolicyRecord,
  CrmTimelineEventRecord,
  CrmUserContext
} from '../crm.types';
import type { CrmSendAvailabilityService } from '../crm-send-availability.service';
import { CrmSendAvailabilityService as DefaultCrmSendAvailabilityService } from '../crm-send-availability.service';
import { resolveCrmSequenceScheduledAt } from './crm-sequence-send-schedule-time';

describe('CrmSequenceReviewCreationService', () => {
  it('creates the first message directly in the send schedule without a draft confirmation step', async () => {
    const createdBundles: CrmSequenceDraftBundleCreateInput[] = [];
    const service = createService({
      sequenceRepository: createSequenceRepository({
        async createSequenceDraftBundle(input) {
          createdBundles.push(input);

          return {
            enrollment: createEnrollmentFromInput(input),
            message: createMessageFromInput(input),
            account: createAccount({ status: input.accountStatus }),
            event: createTimelineEvent(input)
          };
        }
      })
    });

    const result = await service.createSequenceReviewItem(
      {
        accountId: 'account-1',
        contactId: 'contact-1',
        mailboxId: 'mailbox-1'
      },
      createContext()
    );

    const created = createdBundles[0];
    const timelineMetadata = created.timelineEvent.metadata as {
      fitScore?: { recommendedColdSteps: number };
    };

    assert.equal(created.enrollment.status, 'sequence_running');
    assert.equal(created.enrollment.totalSteps, 2);
    assert.equal(created.message.status, 'draft_ready');
    assert.ok(created.message.scheduledAt instanceof Date);
    assert.equal(created.accountStatus, 'sequence_running');
    assert.equal(created.timelineEvent.eventType, 'message_send_scheduled');
    assert.equal(timelineMetadata.fitScore?.recommendedColdSteps, 2);
    assert.equal(result.item.enrollment.status, 'sequence_running');
    assert.equal(result.item.firstMessage?.status, 'draft_ready');
  });

  it('requires a sender mailbox because creation now schedules sending immediately', async () => {
    const service = createService();

    await assert.rejects(
      () =>
        service.createSequenceReviewItem(
          {
            accountId: 'account-1',
            contactId: 'contact-1'
          },
          createContext()
        ),
      BadRequestException
    );
  });

  it('uses the recipient next send window when creation happens outside allowed local time', async () => {
    const nextAvailableAt = new Date('2026-06-24T13:00:00.000Z');
    const createdBundles: CrmSequenceDraftBundleCreateInput[] = [];
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
      sequenceRepository: createSequenceRepository({
        async createSequenceDraftBundle(input) {
          createdBundles.push(input);

          return {
            enrollment: createEnrollmentFromInput(input),
            message: createMessageFromInput(input),
            account: createAccount({ status: input.accountStatus }),
            event: createTimelineEvent(input)
          };
        }
      })
    });

    await service.createSequenceReviewItem(
      {
        accountId: 'account-1',
        contactId: 'contact-1',
        mailboxId: 'mailbox-1'
      },
      createContext()
    );

    assert.equal(createdBundles[0].message.scheduledAt?.toISOString(), nextAvailableAt.toISOString());
  });

  it('uses an earlier available gap before a later mailbox send plan', () => {
    const now = new Date('2026-06-24T06:00:00.000Z');
    const latestScheduledAt = new Date('2026-06-24T06:30:00.000Z');
    const scheduledAt = resolveCrmSequenceScheduledAt({
      availabilityService: createAvailabilityService(),
      account: createAccount(),
      globalConfig: createGlobalConfig(),
      now,
      latestScheduledAt,
      random: () => 0
    });

    assert.equal(scheduledAt.toISOString(), '2026-06-24T06:00:10.000Z');
    assert.ok(latestScheduledAt.getTime() - scheduledAt.getTime() >= 5 * 60 * 1000);
  });

  it('moves exact-hour schedule times to a seconds offset', () => {
    const now = new Date('2026-06-24T06:00:00.000Z');
    const scheduledAt = resolveCrmSequenceScheduledAt({
      availabilityService: createAvailabilityService(),
      account: createAccount(),
      globalConfig: createGlobalConfig(),
      now,
      random: () => 0
    });

    assert.equal(scheduledAt.toISOString(), '2026-06-24T06:00:10.000Z');
  });

  it('keeps exact-hour avoidance inside the recipient send window', () => {
    const now = new Date('2026-06-24T19:00:00.000Z');
    const scheduledAt = resolveCrmSequenceScheduledAt({
      availabilityService: createRealAvailabilityService(),
      account: createAccount(),
      globalConfig: createGlobalConfig({
        sendWindows: [{ startMinute: 12 * 60, endMinute: 12 * 60 + 10 }]
      }),
      now,
      random: () => 0
    });

    assert.equal(scheduledAt.toISOString(), '2026-06-24T19:00:10.000Z');
  });

  it('places a new schedule after a nearby previous mailbox send plan', () => {
    const now = new Date('2026-06-24T06:00:00.000Z');
    const scheduledAt = resolveCrmSequenceScheduledAt({
      availabilityService: createAvailabilityService(),
      account: createAccount(),
      globalConfig: createGlobalConfig(),
      now,
      mailboxScheduleTimes: [new Date('2026-06-24T05:58:00.000Z')],
      random: () => 0
    });

    assert.equal(scheduledAt.toISOString(), '2026-06-24T06:03:00.000Z');
    assert.ok(scheduledAt > now);
  });

  it('does not let a later mailbox schedule push an earlier available recipient to a future workday', () => {
    const now = new Date('2026-06-24T07:06:57.000Z');
    const scheduledAt = resolveCrmSequenceScheduledAt({
      availabilityService: createAvailabilityService(),
      account: createAccount({ country: '中国', city: '深圳', timeZone: 'Asia/Shanghai' }),
      globalConfig: createGlobalConfig(),
      now,
      mailboxScheduleTimes: [new Date('2026-06-27T02:26:14.000Z')],
      random: () => 0
    });

    assert.equal(scheduledAt.toISOString(), now.toISOString());
  });

  it('creates a new first message in the earliest mailbox gap', async () => {
    const mailboxScheduleTimes = [new Date('2026-06-24T06:30:00.000Z')];
    const createdBundles: CrmSequenceDraftBundleCreateInput[] = [];
    const service = createService({
      sequenceRepository: createSequenceRepository({
        async listMailboxSendScheduleTimes() {
          return mailboxScheduleTimes;
        },
        async createSequenceDraftBundle(input) {
          createdBundles.push(input);

          return {
            enrollment: createEnrollmentFromInput(input),
            message: createMessageFromInput(input),
            account: createAccount({ status: input.accountStatus }),
            event: createTimelineEvent(input)
          };
        }
      }),
      availabilityService: {
        evaluate() {
          return {
            canSend: false,
            timeZone: 'America/Los_Angeles',
            reason: 'outside_window',
            nextAvailableAt: new Date('2026-06-24T06:00:00.000Z')
          };
        }
      } as unknown as CrmSendAvailabilityService
    });

    await service.createSequenceReviewItem(
      {
        accountId: 'account-1',
        contactId: 'contact-1',
        mailboxId: 'mailbox-1'
      },
      createContext()
    );

    const scheduledAt = createdBundles[0].message.scheduledAt;

    assert.ok(scheduledAt);
    assert.ok(scheduledAt < mailboxScheduleTimes[0]);
  });
});

function createService(
  input: {
    sequenceRepository?: CrmSequenceRepository;
    availabilityService?: CrmSendAvailabilityService;
  } = {}
) {
  return new CrmSequenceReviewCreationService(
    createAccountRepository(),
    createSettingsRepository(),
    createMailboxRepository(),
    input.sequenceRepository ?? createSequenceRepository(),
    {
      async assertLeadCanStartSequence() {},
      async assertPolicyAllowsSequence() {}
    } as unknown as ConstructorParameters<typeof CrmSequenceReviewCreationService>[4],
    input.availabilityService ?? createAvailabilityService(),
    null,
    undefined
  );
}

function createAccountRepository(): CrmAccountRepository {
  return {
    async getAccountDetail() {
      return {
        account: createAccount(),
        contacts: [createContact()],
        timeline: [],
        enrichments: [],
        archivedFingerprints: []
      };
    }
  } as unknown as CrmAccountRepository;
}

function createSettingsRepository(): CrmSettingsRepository {
  return {
    async getGlobalConfig() {
      return createGlobalConfig();
    },
    async findDefaultSequencePolicy() {
      return createSequencePolicy();
    },
    async findDefaultEmailTemplateGroup() {
      return null;
    },
    async listActivePersonaProfiles() {
      return [];
    }
  } as unknown as CrmSettingsRepository;
}

function createAvailabilityService(): CrmSendAvailabilityService {
  return {
    evaluate() {
      return {
        canSend: true,
        timeZone: 'America/Los_Angeles',
        reason: 'within_window'
      };
    }
  } as unknown as CrmSendAvailabilityService;
}

function createRealAvailabilityService(): CrmSendAvailabilityService {
  return new DefaultCrmSendAvailabilityService({
    isHoliday() {
      return false;
    }
  });
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
      step4Days: 12,
      step5Days: 18
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

function createMailboxRepository(): CrmMailboxRepository {
  return {
    async findMailboxById() {
      return createMailbox();
    }
  } as unknown as CrmMailboxRepository;
}

function createSequenceRepository(overrides: Partial<CrmSequenceRepository> = {}): CrmSequenceRepository {
  return {
    async findActiveEnrollmentByContact() {
      return null;
    },
    async findActiveEnrollmentByAccount() {
      return null;
    },
    async createSequenceDraftBundle(input) {
      return {
        enrollment: createEnrollmentFromInput(input),
        message: createMessageFromInput(input),
        account: createAccount({ status: input.accountStatus }),
        event: createTimelineEvent(input)
      };
    },
    async listSequenceReviewItems() {
      return { records: [], total: 0 };
    },
    async getSequenceReviewItem() {
      return null;
    },
    async listMailboxSendScheduleTimes() {
      return [];
    },
    ...overrides
  };
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

function createAccount(overrides: Partial<CrmAccountRecord> = {}): CrmAccountRecord {
  return {
    id: 'account-1',
    organizationId: 'org-1',
    ownerUserId: 'user-1',
    name: 'Acme',
    normalizedName: 'acme',
    websiteUrl: null,
    domain: 'acme.example',
    country: 'US',
    city: 'Los Angeles',
    address: null,
    timeZone: 'America/Los_Angeles',
    customerType: 'Distributor',
    sourceSnapshot: {
      website_product_fact: 'Supplies bearings and power-transmission parts'
    },
    status: 'candidate',
    sourceTaskId: null,
    archivedAt: null,
    archiveReason: null,
    archiveSlimmedAt: null,
    createdAt: new Date('2026-06-18T09:00:00.000Z'),
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
    fullName: 'Alice Buyer',
    title: 'Purchasing Manager',
    email: 'alice@example.com',
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
    emailAddress: 'sales@example.com',
    emailHash: 'mailbox-hash',
    maskedEmail: 's***@example.com',
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
    ...overrides
  };
}

function createSequencePolicy(overrides: Partial<CrmSequencePolicyRecord> = {}): CrmSequencePolicyRecord {
  return {
    id: 'policy-1',
    organizationId: 'org-1',
    name: 'Default',
    description: null,
    status: 'active',
    isDefault: true,
    steps: [
      { stepIndex: 1, delayDays: 0, threadMode: 'new_subject' },
      { stepIndex: 2, delayDays: 3, threadMode: 'same_thread' }
    ],
    linkPolicy: 'preserve_template_links',
    allowLowRiskAutoSend: false,
    sameCompanyContactStrategy: 'single_active_per_company',
    createdById: 'user-1',
    createdByName: 'Alice',
    createdAt: new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: new Date('2026-06-18T09:00:00.000Z'),
    ...overrides
  };
}

function createEnrollmentFromInput(input: CrmSequenceDraftBundleCreateInput) {
  return {
    id: 'enrollment-1',
    ...input.enrollment,
    productLineId: input.enrollment.productLineId ?? null,
    mailboxId: input.enrollment.mailboxId ?? null,
    policyId: input.enrollment.policyId ?? null,
    createdByName: input.enrollment.createdByName ?? null,
    createdAt: new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: new Date('2026-06-18T09:00:00.000Z')
  };
}

function createMessageFromInput(input: CrmSequenceDraftBundleCreateInput) {
  return {
    id: 'message-1',
    enrollmentId: 'enrollment-1',
    ...input.message,
    mailboxId: input.message.mailboxId ?? null,
    scheduledAt: input.message.scheduledAt ?? null,
    sentAt: input.message.sentAt ?? null,
    bullJobId: input.message.bullJobId ?? null,
    providerMessageId: input.message.providerMessageId ?? null,
    providerThreadId: input.message.providerThreadId ?? null,
    recipientTimeZone: input.message.recipientTimeZone ?? null,
    metadata: input.message.metadata ?? null,
    createdAt: new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: new Date('2026-06-18T09:00:00.000Z')
  };
}

function createTimelineEvent(input: CrmSequenceDraftBundleCreateInput): CrmTimelineEventRecord {
  return {
    id: 'event-1',
    organizationId: input.timelineEvent.organizationId,
    accountId: input.timelineEvent.accountId,
    contactId: input.timelineEvent.contactId ?? null,
    ownerUserId: input.timelineEvent.ownerUserId,
    eventType: input.timelineEvent.eventType,
    title: input.timelineEvent.title,
    content: input.timelineEvent.content ?? null,
    metadata: input.timelineEvent.metadata,
    createdAt: new Date('2026-06-18T09:00:00.000Z')
  };
}
