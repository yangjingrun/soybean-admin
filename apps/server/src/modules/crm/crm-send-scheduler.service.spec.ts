import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { CrmSendAvailabilityService } from './crm-send-availability.service';
import { CrmSendSchedulerService } from './crm-send-scheduler.service';
import type { CrmSendSchedulerRepository } from './crm-send-scheduler.repository';
import type {
  CrmDueSendCandidateRecord,
  CrmGlobalConfigRecord,
  CrmScheduledMessageStepKind,
  CrmSendQueueJob,
  CrmSendQueuePort,
  CrmSendPreferenceRecord
} from './crm.types';

type SchedulerFakeStore = CrmSendSchedulerRepository & {
  queuedMessageIds: string[];
  ownerStateCalls: Array<{
    owners: Array<{ organizationId: string; ownerUserId: string }>;
    from: Date;
    to: Date;
  }>;
  mailboxStateCalls: Array<{
    mailboxes: Array<{ organizationId: string; mailboxId: string }>;
    day: { from: Date; to: Date };
    hour: { from: Date; to: Date };
  }>;
  getSendPreferenceCalls: unknown[];
  countOwnerQueuedMessagesCalls: unknown[];
  countDispatchedMessagesCalls: Array<{ stepKind?: CrmScheduledMessageStepKind; mailboxId?: string }>;
  updateCalls: Array<{
    id: string;
    input: { status?: string; bullJobId?: string | null; scheduledAt?: Date | null };
  }>;
};

describe('CrmSendSchedulerService', () => {
  it('dispatches due first-touch and follow-up messages by owner share preference', async () => {
    const now = new Date('2026-06-20T02:11:00.000Z');
    const store = createSchedulerStore({
      preference: createSendPreference({ dailySendLimit: 2, followUpSharePercent: 50 }),
      candidates: [
        createCandidate({
          messageId: 'follow-up-1',
          stepIndex: 2,
          scheduledAt: '2026-06-20T01:00:00.000Z',
          mailboxId: 'mailbox-1'
        }),
        createCandidate({
          messageId: 'follow-up-2',
          stepIndex: 3,
          scheduledAt: '2026-06-20T01:05:00.000Z',
          mailboxId: 'mailbox-2'
        }),
        createCandidate({
          messageId: 'first-1',
          stepIndex: 1,
          scheduledAt: '2026-06-20T01:10:00.000Z',
          mailboxId: 'mailbox-3'
        }),
        createCandidate({
          messageId: 'first-2',
          stepIndex: 1,
          scheduledAt: '2026-06-20T01:15:00.000Z',
          mailboxId: 'mailbox-4'
        })
      ]
    });
    const queue = createQueue();
    const scheduler = new CrmSendSchedulerService(store, queue, createAllowingAvailability());

    const result = await scheduler.dispatchDueMessages({ now, take: 20 });

    assert.equal(result.dispatchedCount, 2);
    assert.deepEqual(
      queue.jobs.map(job => job.messageId),
      ['follow-up-1', 'first-1']
    );
    assert.deepEqual(store.queuedMessageIds, ['follow-up-1', 'first-1']);
  });

  it('skips due messages when the owner has reached queued concurrency', async () => {
    const now = new Date('2026-06-20T02:11:00.000Z');
    const store = createSchedulerStore({
      globalConfig: createGlobalConfig({ ownerConcurrentSendLimit: 1 }),
      queuedCount: 1,
      candidates: [createCandidate({ messageId: 'first-1', stepIndex: 1 })]
    });
    const queue = createQueue();
    const scheduler = new CrmSendSchedulerService(store, queue, createAllowingAvailability());

    const result = await scheduler.dispatchDueMessages({ now, take: 20 });

    assert.equal(result.dispatchedCount, 0);
    assert.equal(queue.jobs.length, 0);
    assert.equal(store.queuedMessageIds.length, 0);
  });

  it('batch loads owner dispatch state for all due owners', async () => {
    const now = new Date('2026-06-20T02:11:00.000Z');
    const store = createSchedulerStore({
      candidates: [
        createCandidate({ messageId: 'owner-1-message', stepIndex: 1, ownerUserId: 'user-1', mailboxId: 'mailbox-1' }),
        createCandidate({ messageId: 'owner-2-message', stepIndex: 1, ownerUserId: 'user-2', mailboxId: 'mailbox-2' })
      ],
      ownerStates: [
        createOwnerSendState({ ownerUserId: 'user-1', preference: createSendPreference({ ownerUserId: 'user-1' }) }),
        createOwnerSendState({ ownerUserId: 'user-2', preference: createSendPreference({ ownerUserId: 'user-2' }) })
      ]
    });
    const queue = createQueue();
    const scheduler = new CrmSendSchedulerService(store, queue, createAllowingAvailability());

    const result = await scheduler.dispatchDueMessages({ now, take: 20 });

    assert.equal(result.dispatchedCount, 2);
    assert.deepEqual(store.ownerStateCalls[0].owners, [
      { organizationId: 'org-1', ownerUserId: 'user-1' },
      { organizationId: 'org-1', ownerUserId: 'user-2' }
    ]);
    assert.equal(store.ownerStateCalls.length, 1);
    assert.equal(store.getSendPreferenceCalls.length, 0);
    assert.equal(store.countOwnerQueuedMessagesCalls.length, 0);
    assert.equal(store.countDispatchedMessagesCalls.filter(call => !call.mailboxId).length, 0);
  });

  it('batch loads mailbox dispatch state for all due mailboxes', async () => {
    const now = new Date('2026-06-20T02:11:00.000Z');
    const store = createSchedulerStore({
      candidates: [
        createCandidate({ messageId: 'mailbox-1-message', stepIndex: 1, mailboxId: 'mailbox-1' }),
        createCandidate({ messageId: 'mailbox-2-message', stepIndex: 1, mailboxId: 'mailbox-2' })
      ],
      mailboxStates: [
        createMailboxSendState({ mailboxId: 'mailbox-1' }),
        createMailboxSendState({ mailboxId: 'mailbox-2' })
      ]
    });
    const queue = createQueue();
    const scheduler = new CrmSendSchedulerService(store, queue, createAllowingAvailability());

    const result = await scheduler.dispatchDueMessages({ now, take: 20 });

    assert.equal(result.dispatchedCount, 2);
    assert.deepEqual(store.mailboxStateCalls[0].mailboxes, [
      { organizationId: 'org-1', mailboxId: 'mailbox-1' },
      { organizationId: 'org-1', mailboxId: 'mailbox-2' }
    ]);
    assert.equal(store.mailboxStateCalls.length, 1);
    assert.equal(store.countDispatchedMessagesCalls.filter(call => call.mailboxId).length, 0);
  });

  it('reserves mailbox capacity in memory after each queued candidate', async () => {
    const now = new Date('2026-06-20T02:11:00.000Z');
    const store = createSchedulerStore({
      candidates: [
        createCandidate({ messageId: 'first-1', stepIndex: 1, dailyLimit: 1, hourlyLimit: 1 }),
        createCandidate({ messageId: 'first-2', stepIndex: 1, dailyLimit: 1, hourlyLimit: 1 })
      ],
      mailboxStates: [createMailboxSendState({ mailboxId: 'mailbox-1', dailyCount: 0, hourlyCount: 0 })]
    });
    const queue = createQueue();
    const scheduler = new CrmSendSchedulerService(store, queue, createAllowingAvailability());

    const result = await scheduler.dispatchDueMessages({ now, take: 20 });

    assert.equal(result.dispatchedCount, 1);
    assert.equal(result.skippedCount, 1);
    assert.deepEqual(
      queue.jobs.map(job => job.messageId),
      ['first-1']
    );
    assert.equal(store.countDispatchedMessagesCalls.filter(call => call.mailboxId).length, 0);
  });

  it('defers due messages that land exactly on the hour before queueing', async () => {
    const now = new Date('2026-06-20T02:00:00.000Z');
    const store = createSchedulerStore({
      candidates: [createCandidate({ messageId: 'first-1', stepIndex: 1 })]
    });
    const queue = createQueue();
    const scheduler = new CrmSendSchedulerService(store, queue, createAllowingAvailability());

    const result = await scheduler.dispatchDueMessages({ now, take: 20 });

    assert.equal(result.dispatchedCount, 0);
    assert.equal(result.skippedCount, 1);
    assert.equal(queue.jobs.length, 0);
    assert.equal(store.updateCalls[0].id, 'first-1');
    assert.equal(store.updateCalls[0].input.status, 'draft_ready');
    assert.equal(store.updateCalls[0].input.bullJobId, null);
    assert.ok(store.updateCalls[0].input.scheduledAt);
    assert.ok(store.updateCalls[0].input.scheduledAt >= new Date('2026-06-20T02:00:10.000Z'));
    assert.ok(store.updateCalls[0].input.scheduledAt <= new Date('2026-06-20T02:01:00.000Z'));
  });

  it('defers messages outside the recipient local send window before capacity checks and queueing', async () => {
    const now = new Date('2026-06-20T02:11:00.000Z');
    const nextAvailableAt = new Date('2026-06-20T13:30:00.000Z');
    const store = createSchedulerStore({
      candidates: [
        createCandidate({
          messageId: 'first-1',
          stepIndex: 1,
          country: 'US',
          city: 'New York',
          timeZone: 'America/New_York'
        })
      ]
    });
    const queue = createQueue();
    const availability = createAvailability({
      canSend: false,
      timeZone: 'America/New_York',
      reason: 'outside_window',
      nextAvailableAt
    });
    const scheduler = new CrmSendSchedulerService(store, queue, availability);

    const result = await scheduler.dispatchDueMessages({ now, take: 20 });

    assert.equal(result.dispatchedCount, 0);
    assert.equal(result.skippedCount, 1);
    assert.equal(queue.jobs.length, 0);
    assert.equal(store.queuedMessageIds.length, 0);
    assert.equal(store.ownerStateCalls.length, 0);
    assert.equal(store.mailboxStateCalls.length, 0);
    assert.deepEqual(availability.calls[0], {
      now,
      country: 'US',
      city: 'New York',
      timeZone: 'America/New_York',
      sendRule: {
        workdays: [1, 2, 3, 4, 5],
        windows: [
          { startMinute: 9 * 60, endMinute: 12 * 60 },
          { startMinute: 14 * 60, endMinute: 18 * 60 }
        ]
      }
    });
    assert.deepEqual(store.updateCalls[0], {
      id: 'first-1',
      input: {
        status: 'draft_ready',
        scheduledAt: nextAvailableAt,
        bullJobId: null
      }
    });
  });

  it('keeps due messages spaced instead of queueing the whole mailbox batch at once', async () => {
    const now = new Date('2026-06-20T02:11:00.000Z');
    const store = createSchedulerStore({
      candidates: [
        createCandidate({ messageId: 'first-1', stepIndex: 1, scheduledAt: '2026-06-20T01:00:00.000Z' }),
        createCandidate({ messageId: 'first-2', stepIndex: 1, scheduledAt: '2026-06-20T01:01:00.000Z' })
      ]
    });
    const queue = createQueue();
    const scheduler = new CrmSendSchedulerService(store, queue, createAllowingAvailability());

    const result = await scheduler.dispatchDueMessages({ now, take: 20 });
    const deferredCall = store.updateCalls.find(call => call.id === 'first-2');

    assert.equal(result.dispatchedCount, 1);
    assert.equal(result.skippedCount, 1);
    assert.deepEqual(
      queue.jobs.map(job => job.messageId),
      ['first-1']
    );
    assert.equal(deferredCall?.input.status, 'draft_ready');
    assert.equal(deferredCall?.input.bullJobId, null);
    assert.ok(deferredCall?.input.scheduledAt);
    assert.ok(deferredCall.input.scheduledAt >= new Date(now.getTime() + 5 * 60 * 1000));
    assert.ok(deferredCall.input.scheduledAt <= new Date(now.getTime() + 10 * 60 * 1000));
  });
});

function createSchedulerStore(input: {
  globalConfig?: CrmGlobalConfigRecord;
  preference?: CrmSendPreferenceRecord;
  candidates?: CrmDueSendCandidateRecord[];
  queuedCount?: number;
  ownerStates?: Array<{
    organizationId: string;
    ownerUserId: string;
    preference: CrmSendPreferenceRecord | null;
    queuedCount: number;
    dailyCount: number;
    firstTouchCount: number;
    followUpCount: number;
  }>;
  mailboxStates?: Array<{
    organizationId: string;
    mailboxId: string;
    dailyCount: number;
    hourlyCount: number;
  }>;
}) {
  const globalConfig = input.globalConfig ?? createGlobalConfig();
  const preference = input.preference ?? createSendPreference();
  const candidates = input.candidates ?? [];
  const queuedMessageIds: string[] = [];
  const ownerStateCalls: Array<{
    owners: Array<{ organizationId: string; ownerUserId: string }>;
    from: Date;
    to: Date;
  }> = [];
  const getSendPreferenceCalls: unknown[] = [];
  const countOwnerQueuedMessagesCalls: unknown[] = [];
  const countDispatchedMessagesCalls: Array<{ stepKind?: CrmScheduledMessageStepKind; mailboxId?: string }> = [];
  const updateCalls: Array<{
    id: string;
    input: { status?: string; bullJobId?: string | null; scheduledAt?: Date | null };
  }> = [];
  const mailboxStateCalls: Array<{
    mailboxes: Array<{ organizationId: string; mailboxId: string }>;
    day: { from: Date; to: Date };
    hour: { from: Date; to: Date };
  }> = [];

  return {
    queuedMessageIds,
    ownerStateCalls,
    mailboxStateCalls,
    updateCalls,
    getSendPreferenceCalls,
    countOwnerQueuedMessagesCalls,
    countDispatchedMessagesCalls,
    async getGlobalConfig() {
      return globalConfig;
    },
    async getSendPreference(args: unknown) {
      getSendPreferenceCalls.push(args);
      return preference;
    },
    async countOwnerQueuedMessages(args: unknown) {
      countOwnerQueuedMessagesCalls.push(args);
      return input.queuedCount ?? queuedMessageIds.length;
    },
    async countDispatchedMessages(args: { stepKind?: CrmScheduledMessageStepKind; mailboxId?: string }) {
      countDispatchedMessagesCalls.push(args);
      if (args.mailboxId) {
        return 0;
      }

      return queuedMessageIds.filter(messageId => {
        const candidate = candidates.find(item => item.message.id === messageId);

        return !args.stepKind || candidate?.stepKind === args.stepKind;
      }).length;
    },
    async listOwnerSendStates(args: {
      owners: Array<{ organizationId: string; ownerUserId: string }>;
      from: Date;
      to: Date;
    }) {
      ownerStateCalls.push(args);

      return args.owners.map(owner => {
        const configured = input.ownerStates?.find(
          item => item.organizationId === owner.organizationId && item.ownerUserId === owner.ownerUserId
        );

        return (
          configured ??
          createOwnerSendState({
            ...owner,
            preference,
            queuedCount: input.queuedCount ?? queuedMessageIds.length
          })
        );
      });
    },
    async listMailboxSendStates(args: {
      mailboxes: Array<{ organizationId: string; mailboxId: string }>;
      day: { from: Date; to: Date };
      hour: { from: Date; to: Date };
    }) {
      mailboxStateCalls.push(args);

      return args.mailboxes.map(mailbox => {
        const configured = input.mailboxStates?.find(
          item => item.organizationId === mailbox.organizationId && item.mailboxId === mailbox.mailboxId
        );

        return configured ?? createMailboxSendState(mailbox);
      });
    },
    async listDueSendCandidates() {
      return candidates;
    },
    async updateMessage(
      id: string,
      _organizationId: string,
      update: { status?: string; bullJobId?: string | null; scheduledAt?: Date | null }
    ) {
      updateCalls.push({ id, input: update });
      const candidate = candidates.find(item => item.message.id === id);

      if (!candidate) {
        return null;
      }

      if (update.status) {
        candidate.message.status = update.status as typeof candidate.message.status;
      }
      if ('scheduledAt' in update) {
        candidate.message.scheduledAt = update.scheduledAt ?? null;
      }
      if ('bullJobId' in update) {
        candidate.message.bullJobId = update.bullJobId ?? null;
      }
      if (update.status === 'queued') {
        queuedMessageIds.push(id);
      }

      return candidate.message;
    }
  } as unknown as SchedulerFakeStore;
}

function createQueue(): CrmSendQueuePort & { jobs: CrmSendQueueJob[] } {
  const jobs: CrmSendQueueJob[] = [];

  return {
    jobs,
    async enqueueFirstMessage(input) {
      jobs.push(input);

      return { jobId: `${input.messageId}:${input.runVersion}` };
    },
    async hasJob(jobId) {
      return jobs.some(job => `${job.messageId}:${job.runVersion}` === jobId);
    }
  };
}

function createGlobalConfig(input: Partial<CrmGlobalConfigRecord> = {}): CrmGlobalConfigRecord {
  return {
    configKey: 'default',
    emailVerificationCooldownDays: 30,
    ownerConcurrentSendLimit: input.ownerConcurrentSendLimit ?? 5,
    ownerDailySendLimitMax: input.ownerDailySendLimitMax ?? 200,
    followUpDelayDays: {
      step2Days: 3,
      step3Days: 7,
      step4Days: 12,
      step5Days: 18
    },
    sendWorkdays: input.sendWorkdays ?? [1, 2, 3, 4, 5],
    sendWindows: input.sendWindows ?? [
      { startMinute: 9 * 60, endMinute: 12 * 60 },
      { startMinute: 14 * 60, endMinute: 18 * 60 }
    ],
    updatedAt: new Date(0)
  };
}

function createSendPreference(input: Partial<CrmSendPreferenceRecord> = {}): CrmSendPreferenceRecord {
  return {
    id: 'preference-1',
    organizationId: 'org-1',
    ownerUserId: 'user-1',
    ownerUserName: 'Alice',
    dailySendLimit: input.dailySendLimit ?? 50,
    followUpSharePercent: input.followUpSharePercent ?? 70,
    updatedById: 'user-1',
    updatedByName: 'Alice',
    createdAt: new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: new Date('2026-06-18T09:00:00.000Z')
  };
}

function createOwnerSendState(input: {
  organizationId?: string;
  ownerUserId?: string;
  preference?: CrmSendPreferenceRecord | null;
  queuedCount?: number;
  dailyCount?: number;
  firstTouchCount?: number;
  followUpCount?: number;
}) {
  return {
    organizationId: input.organizationId ?? 'org-1',
    ownerUserId: input.ownerUserId ?? 'user-1',
    preference: input.preference ?? null,
    queuedCount: input.queuedCount ?? 0,
    dailyCount: input.dailyCount ?? 0,
    firstTouchCount: input.firstTouchCount ?? 0,
    followUpCount: input.followUpCount ?? 0
  };
}

function createMailboxSendState(input: {
  organizationId?: string;
  mailboxId?: string;
  dailyCount?: number;
  hourlyCount?: number;
  latestScheduledAt?: Date | null;
}) {
  return {
    organizationId: input.organizationId ?? 'org-1',
    mailboxId: input.mailboxId ?? 'mailbox-1',
    dailyCount: input.dailyCount ?? 0,
    hourlyCount: input.hourlyCount ?? 0,
    latestScheduledAt: input.latestScheduledAt ?? null
  };
}

function createCandidate(input: {
  messageId: string;
  stepIndex: number;
  scheduledAt?: string;
  organizationId?: string;
  ownerUserId?: string;
  mailboxId?: string;
  dailyLimit?: number;
  hourlyLimit?: number;
  country?: string | null;
  city?: string | null;
  timeZone?: string | null;
}): CrmDueSendCandidateRecord {
  const stepKind: CrmScheduledMessageStepKind = input.stepIndex === 1 ? 'first_touch' : 'follow_up';
  const organizationId = input.organizationId ?? 'org-1';
  const ownerUserId = input.ownerUserId ?? 'user-1';
  const mailboxId = input.mailboxId ?? 'mailbox-1';

  return {
    stepKind,
    enrollment: {
      id: `enrollment-${input.messageId}`,
      organizationId,
      ownerUserId,
      accountId: `account-${input.messageId}`,
      contactId: `contact-${input.messageId}`,
      productLineId: null,
      mailboxId,
      policyId: null,
      name: 'Sequence',
      status: 'sequence_running',
      currentStep: input.stepIndex,
      totalSteps: 5,
      runVersion: 3,
      createdById: 'user-1',
      createdByName: 'Alice',
      createdAt: new Date('2026-06-18T09:00:00.000Z'),
      updatedAt: new Date('2026-06-18T09:00:00.000Z')
    },
    account: {
      id: `account-${input.messageId}`,
      organizationId,
      ownerUserId,
      name: 'ABC Trading',
      normalizedName: 'abc trading',
      websiteUrl: null,
      domain: null,
      country: input.country ?? null,
      city: input.city ?? null,
      address: null,
      timeZone: input.timeZone ?? null,
      customerType: null,
      status: 'sequence_running',
      sourceTaskId: null,
      archivedAt: null,
      archiveReason: null,
      archiveSlimmedAt: null,
      createdAt: new Date('2026-06-18T09:00:00.000Z'),
      updatedAt: new Date('2026-06-18T09:00:00.000Z')
    },
    contact: {
      id: `contact-${input.messageId}`,
      organizationId,
      accountId: `account-${input.messageId}`,
      ownerUserId,
      fullName: 'Ali',
      title: 'Purchasing Manager',
      email: `${input.messageId}@example.com`,
      emailHash: `hash-${input.messageId}`,
      maskedEmail: 'a***@example.com',
      isPublicEmail: false,
      emailStatus: 'valid',
      sourceTaskId: null,
      createdAt: new Date('2026-06-18T09:00:00.000Z'),
      updatedAt: new Date('2026-06-18T09:00:00.000Z')
    },
    productLine: null,
    mailbox: {
      id: mailboxId,
      organizationId,
      ownerUserId,
      ownerUserName: 'Alice',
      provider: 'gmail',
      emailAddress: 'alice@gmail.com',
      emailHash: 'mailbox-hash',
      maskedEmail: 'a***@gmail.com',
      status: 'active',
      dailyLimit: input.dailyLimit ?? 50,
      hourlyLimit: input.hourlyLimit ?? 10,
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
      updatedAt: new Date('2026-06-18T09:00:00.000Z')
    },
    firstMessage: null,
    messages: [],
    message: {
      id: input.messageId,
      organizationId,
      ownerUserId,
      accountId: `account-${input.messageId}`,
      contactId: `contact-${input.messageId}`,
      enrollmentId: `enrollment-${input.messageId}`,
      mailboxId,
      stepIndex: input.stepIndex,
      threadMode: input.stepIndex === 1 ? 'new_subject' : 'same_thread',
      subject: 'Subject',
      bodyText: 'Body',
      status: 'draft_ready',
      scheduledAt: new Date(input.scheduledAt ?? '2026-06-20T01:00:00.000Z'),
      sentAt: null,
      bullJobId: null,
      providerMessageId: null,
      providerThreadId: null,
      recipientTimeZone: null,
      metadata: null,
      createdAt: new Date('2026-06-18T09:00:00.000Z'),
      updatedAt: new Date('2026-06-18T09:00:00.000Z')
    }
  };
}

function createAllowingAvailability() {
  return createAvailability({
    canSend: true,
    timeZone: 'Asia/Dubai',
    reason: 'within_window'
  });
}

function createAvailability(result: ReturnType<CrmSendAvailabilityService['evaluate']>) {
  const calls: Parameters<CrmSendAvailabilityService['evaluate']>[0][] = [];

  return {
    calls,
    evaluate(input: Parameters<CrmSendAvailabilityService['evaluate']>[0]) {
      calls.push(input);
      return result;
    }
  } as unknown as CrmSendAvailabilityService & {
    calls: Parameters<CrmSendAvailabilityService['evaluate']>[0][];
  };
}
