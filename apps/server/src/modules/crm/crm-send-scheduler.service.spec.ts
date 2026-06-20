import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CrmSendSchedulerService } from './crm-send-scheduler.service';
import type {
  CrmDueSendCandidateRecord,
  CrmGlobalConfigRecord,
  CrmScheduledMessageStepKind,
  CrmSendQueueJob,
  CrmSendQueuePort,
  CrmSendPreferenceRecord,
  CrmStore
} from './crm.types';

describe('CrmSendSchedulerService', () => {
  it('dispatches due first-touch and follow-up messages by owner share preference', async () => {
    const now = new Date('2026-06-20T02:00:00.000Z');
    const store = createSchedulerStore({
      preference: createSendPreference({ dailySendLimit: 2, followUpSharePercent: 50 }),
      candidates: [
        createCandidate({ messageId: 'follow-up-1', stepIndex: 2, scheduledAt: '2026-06-20T01:00:00.000Z' }),
        createCandidate({ messageId: 'follow-up-2', stepIndex: 3, scheduledAt: '2026-06-20T01:05:00.000Z' }),
        createCandidate({ messageId: 'first-1', stepIndex: 1, scheduledAt: '2026-06-20T01:10:00.000Z' }),
        createCandidate({ messageId: 'first-2', stepIndex: 1, scheduledAt: '2026-06-20T01:15:00.000Z' })
      ]
    });
    const queue = createQueue();
    const scheduler = new CrmSendSchedulerService(store, queue);

    const result = await scheduler.dispatchDueMessages({ now, take: 20 });

    assert.equal(result.dispatchedCount, 2);
    assert.deepEqual(
      queue.jobs.map(job => job.messageId),
      ['follow-up-1', 'first-1']
    );
    assert.deepEqual(store.queuedMessageIds, ['follow-up-1', 'first-1']);
  });

  it('skips due messages when the owner has reached queued concurrency', async () => {
    const now = new Date('2026-06-20T02:00:00.000Z');
    const store = createSchedulerStore({
      globalConfig: createGlobalConfig({ ownerConcurrentSendLimit: 1 }),
      queuedCount: 1,
      candidates: [createCandidate({ messageId: 'first-1', stepIndex: 1 })]
    });
    const queue = createQueue();
    const scheduler = new CrmSendSchedulerService(store, queue);

    const result = await scheduler.dispatchDueMessages({ now, take: 20 });

    assert.equal(result.dispatchedCount, 0);
    assert.equal(queue.jobs.length, 0);
    assert.equal(store.queuedMessageIds.length, 0);
  });
});

function createSchedulerStore(input: {
  globalConfig?: CrmGlobalConfigRecord;
  preference?: CrmSendPreferenceRecord;
  candidates?: CrmDueSendCandidateRecord[];
  queuedCount?: number;
}) {
  const globalConfig = input.globalConfig ?? createGlobalConfig();
  const preference = input.preference ?? createSendPreference();
  const candidates = input.candidates ?? [];
  const queuedMessageIds: string[] = [];

  return {
    queuedMessageIds,
    async getGlobalConfig() {
      return globalConfig;
    },
    async getSendPreference() {
      return preference;
    },
    async countOwnerQueuedMessages() {
      return input.queuedCount ?? queuedMessageIds.length;
    },
    async countDispatchedMessages(args: { stepKind?: CrmScheduledMessageStepKind; mailboxId?: string }) {
      if (args.mailboxId) {
        return 0;
      }

      return queuedMessageIds.filter(messageId => {
        const candidate = candidates.find(item => item.message.id === messageId);

        return !args.stepKind || candidate?.stepKind === args.stepKind;
      }).length;
    },
    async listDueSendCandidates() {
      return candidates;
    },
    async updateMessage(id: string, _organizationId: string, update: { status?: string; bullJobId?: string }) {
      const candidate = candidates.find(item => item.message.id === id);

      if (!candidate || update.status !== 'queued') {
        return null;
      }

      candidate.message.status = 'queued';
      candidate.message.bullJobId = update.bullJobId ?? null;
      queuedMessageIds.push(id);

      return candidate.message;
    }
  } as unknown as CrmStore & { queuedMessageIds: string[] };
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
      step4Days: 14,
      step5Days: 21
    },
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

function createCandidate(input: {
  messageId: string;
  stepIndex: number;
  scheduledAt?: string;
}): CrmDueSendCandidateRecord {
  const stepKind: CrmScheduledMessageStepKind = input.stepIndex === 1 ? 'first_touch' : 'follow_up';

  return {
    stepKind,
    enrollment: {
      id: `enrollment-${input.messageId}`,
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      accountId: `account-${input.messageId}`,
      contactId: `contact-${input.messageId}`,
      productLineId: null,
      mailboxId: 'mailbox-1',
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
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      name: 'ABC Trading',
      normalizedName: 'abc trading',
      websiteUrl: null,
      domain: null,
      country: null,
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
      organizationId: 'org-1',
      accountId: `account-${input.messageId}`,
      ownerUserId: 'user-1',
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
      updatedAt: new Date('2026-06-18T09:00:00.000Z')
    },
    firstMessage: null,
    messages: [],
    message: {
      id: input.messageId,
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      accountId: `account-${input.messageId}`,
      contactId: `contact-${input.messageId}`,
      enrollmentId: `enrollment-${input.messageId}`,
      mailboxId: 'mailbox-1',
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
      metadata: null,
      createdAt: new Date('2026-06-18T09:00:00.000Z'),
      updatedAt: new Date('2026-06-18T09:00:00.000Z')
    }
  };
}
