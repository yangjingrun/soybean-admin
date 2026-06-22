import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CrmGmailAuthorizationExpiredError } from './crm-email-send.gateway';
import type { CrmSendWorkerRepository } from './crm-send-worker.repository';
import { CrmSendWorkerService } from './crm-send-worker.service';
import type {
  CrmAccountRecord,
  CrmContactRecord,
  CrmEmailSendGateway,
  CrmEmailTemplateGroupRecord,
  CrmGlobalConfigRecord,
  CrmMailboxRecord,
  CrmMessageRecord,
  CrmSendDeliveryClaimRecord,
  CrmSendQueueJob,
  CrmSequenceEnrollmentRecord,
  CrmSequencePolicyRecord,
  CrmSequenceReviewRecord
} from './crm.types';

describe('CrmSendWorkerService', () => {
  it('skips stale runVersion jobs without sending or writing status', async () => {
    const store = createWorkerStore({
      enrollment: createEnrollment({ runVersion: 2 }),
      message: createMessage({ status: 'queued' })
    });
    const gateway = createGateway();
    const worker = new CrmSendWorkerService(store, gateway);

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
    const worker = new CrmSendWorkerService(store, gateway);

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
      providerThreadId: 'mock-thread:enrollment-1',
      nextMessage: {
        organizationId: 'org-1',
        ownerUserId: 'user-1',
        accountId: 'account-1',
        contactId: 'contact-1',
        mailboxId: 'mailbox-1',
        stepIndex: 2,
        threadMode: 'same_thread',
        subject: 'Bearing Series for ABC Trading',
        bodyText:
          'Hi Ali Hassan,\n\nJust following up in case this is relevant for your current sourcing plan.\n\nBest regards,\nAlice',
        status: 'draft_pending_review',
        scheduledAt: new Date(store.completed[0].sentAt.getTime() + 3 * 24 * 60 * 60 * 1000),
        providerThreadId: 'mock-thread:enrollment-1'
      }
    });
  });

  it('sends queued follow-up messages and creates the next step draft', async () => {
    const store = createWorkerStore({
      enrollment: createEnrollment({ status: 'sequence_running', runVersion: 2, currentStep: 1 }),
      message: createMessage({
        id: 'message-2',
        status: 'queued',
        stepIndex: 2,
        threadMode: 'same_thread',
        providerThreadId: 'mock-thread:enrollment-1'
      }),
      mailbox: createMailbox({ status: 'active' })
    });
    const gateway = createGateway();
    const worker = new CrmSendWorkerService(store, gateway);

    await worker.processSendJob(createJob({ messageId: 'message-2', runVersion: 2 }));

    assert.equal(gateway.calls[0].message.id, 'message-2');
    assert.equal(store.completed[0].messageId, 'message-2');
    assert.deepEqual(store.completed[0].nextMessage, {
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      accountId: 'account-1',
      contactId: 'contact-1',
      mailboxId: 'mailbox-1',
      stepIndex: 3,
      threadMode: 'same_thread',
      subject: 'Bearing Series for ABC Trading',
      bodyText:
        'Hi Ali Hassan,\n\nJust following up in case this is relevant for your current sourcing plan.\n\nBest regards,\nAlice',
      status: 'draft_pending_review',
      scheduledAt: new Date(store.completed[0].sentAt.getTime() + 7 * 24 * 60 * 60 * 1000),
      providerThreadId: 'mock-thread:enrollment-1'
    });
  });

  it('uses the global follow-up delay policy when scheduling the next draft', async () => {
    const store = createWorkerStore(
      {
        enrollment: createEnrollment({ status: 'sequence_running', runVersion: 2, currentStep: 1 }),
        message: createMessage({
          id: 'message-2',
          status: 'queued',
          stepIndex: 2,
          threadMode: 'same_thread',
          providerThreadId: 'mock-thread:enrollment-1'
        }),
        mailbox: createMailbox({ status: 'active' })
      },
      {
        globalConfig: createGlobalConfig({
          followUpDelayDays: {
            step2Days: 2,
            step3Days: 4,
            step4Days: 8,
            step5Days: 16
          }
        })
      }
    );
    const gateway = createGateway();
    const worker = new CrmSendWorkerService(store, gateway);

    await worker.processSendJob(createJob({ messageId: 'message-2', runVersion: 2 }));

    assert.equal(
      store.completed[0].nextMessage?.scheduledAt?.getTime(),
      store.completed[0].sentAt.getTime() + 4 * 24 * 60 * 60 * 1000
    );
  });

  it('uses the bound sequence policy when scheduling the next draft', async () => {
    const store = createWorkerStore({
      enrollment: createEnrollment({ status: 'sequence_running', runVersion: 2, currentStep: 1, policyId: 'policy-1' }),
      message: createMessage({
        id: 'message-2',
        status: 'queued',
        stepIndex: 2,
        threadMode: 'same_thread',
        providerThreadId: 'mock-thread:enrollment-1'
      }),
      mailbox: createMailbox({ status: 'active' }),
      policy: createSequencePolicy({
        id: 'policy-1',
        steps: [
          { stepIndex: 1, delayDays: 0, threadMode: 'new_subject' },
          { stepIndex: 2, delayDays: 2, threadMode: 'same_thread' },
          { stepIndex: 3, delayDays: 6, threadMode: 'new_subject' },
          { stepIndex: 4, delayDays: 12, threadMode: 'new_subject' },
          { stepIndex: 5, delayDays: 18, threadMode: 'new_subject' }
        ]
      })
    });
    const gateway = createGateway();
    const worker = new CrmSendWorkerService(store, gateway);

    await worker.processSendJob(createJob({ messageId: 'message-2', runVersion: 2 }));

    assert.equal(store.completed[0].nextMessage?.threadMode, 'new_subject');
    assert.equal(
      store.completed[0].nextMessage?.scheduledAt?.getTime(),
      store.completed[0].sentAt.getTime() + 6 * 24 * 60 * 60 * 1000
    );
  });

  it('uses the organization default email template when creating the next follow-up draft', async () => {
    const store = createWorkerStore(
      {
        enrollment: createEnrollment({ status: 'sequence_running', runVersion: 2, currentStep: 1 }),
        message: createMessage({
          id: 'message-2',
          status: 'queued',
          stepIndex: 2,
          threadMode: 'same_thread',
          providerThreadId: 'mock-thread:enrollment-1'
        }),
        mailbox: createMailbox({ status: 'active' })
      },
      {
        defaultTemplateGroup: createEmailTemplateGroup()
      }
    );
    const gateway = createGateway();
    const worker = new CrmSendWorkerService(store, gateway);

    await worker.processSendJob(createJob({ messageId: 'message-2', runVersion: 2 }));

    assert.deepEqual(store.completed[0].nextMessage, {
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      accountId: 'account-1',
      contactId: 'contact-1',
      mailboxId: 'mailbox-1',
      stepIndex: 3,
      threadMode: 'new_subject',
      subject: 'New sourcing idea for ABC Trading',
      bodyText:
        'Hi Ali Hassan,\n\nCould another angle around our product line help with price, MOQ, lead time, and payment terms?\n\nBest regards,\nAlice',
      status: 'draft_pending_review',
      scheduledAt: new Date(store.completed[0].sentAt.getTime() + 5 * 24 * 60 * 60 * 1000),
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
    const worker = new CrmSendWorkerService(store, gateway);

    await worker.processSendJob(createJob({ runVersion: 2 }));

    assert.equal(gateway.calls.length, 0);
    assert.equal(store.completed.length, 0);
    assert.equal(store.failed.length, 0);
  });

  it('loads next draft context before sending so local config failures do not send email', async () => {
    const store = createWorkerStore(
      {
        enrollment: createEnrollment({ status: 'sequence_running' }),
        message: createMessage({ status: 'queued' }),
        mailbox: createMailbox({ status: 'active' })
      },
      {
        globalConfigError: new Error('global config unavailable')
      }
    );
    const gateway = createGateway();
    const worker = new CrmSendWorkerService(store, gateway);

    await assert.rejects(() => worker.processSendJob(createJob()), /global config unavailable/);

    assert.equal(gateway.calls.length, 0);
    assert.equal(store.failed[0].reason, 'global config unavailable');
  });

  it('marks queued messages failed when the send gateway throws', async () => {
    const store = createWorkerStore({
      enrollment: createEnrollment({ status: 'sequence_running' }),
      message: createMessage({ status: 'queued' }),
      mailbox: createMailbox({ status: 'active' })
    });
    const worker = new CrmSendWorkerService(store, createGateway(new Error('gmail unavailable')));

    await assert.rejects(() => worker.processSendJob(createJob()), /gmail unavailable/);
    assert.equal(store.failed[0].reason, 'gmail unavailable');
  });

  it('marks mailbox auth expired and notifies owner when Gmail send rejects authorization', async () => {
    const store = createWorkerStore({
      enrollment: createEnrollment({ status: 'sequence_running' }),
      message: createMessage({ status: 'queued' }),
      mailbox: createMailbox({ status: 'active', ownerUserName: 'Alice' })
    });
    const notifications = createNotificationRecorder();
    const worker = new CrmSendWorkerService(
      store,
      createGateway(new CrmGmailAuthorizationExpiredError('invalid_grant')),
      notifications.service as never
    );

    await assert.rejects(() => worker.processSendJob(createJob()), CrmGmailAuthorizationExpiredError);

    assert.equal(store.failed.length, 0);
    assert.deepEqual(store.authExpired[0], {
      mailboxId: 'mailbox-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      reason: 'invalid_grant',
      expiredAt: store.authExpired[0].expiredAt
    });
    assert.deepEqual(notifications.records[0], {
      userId: 'user-1',
      userName: 'Alice',
      module: 'crm',
      type: 'crm_mailbox_auth_expired',
      title: 'Gmail 授权已失效',
      content: 'a***@gmail.com 授权已失效，已暂停该邮箱待发送邮件，请重新授权后再继续发送。',
      targetType: 'crmMailbox',
      targetId: 'mailbox-1',
      routePath: '/crm/settings',
      metadata: {
        organizationId: 'org-1',
        mailboxId: 'mailbox-1',
        provider: 'gmail',
        maskedEmail: 'a***@gmail.com'
      }
    });
  });
});

interface WorkerStoreInput extends Partial<CrmSequenceReviewRecord> {
  message?: CrmMessageRecord;
}

function createWorkerStore(
  input: WorkerStoreInput,
  options: {
    claimResult?: CrmSendDeliveryClaimRecord | null;
    defaultTemplateGroup?: CrmEmailTemplateGroupRecord | null;
    globalConfig?: CrmGlobalConfigRecord;
    globalConfigError?: Error;
  } = {}
) {
  const item: CrmSequenceReviewRecord = {
    enrollment: input.enrollment ?? createEnrollment(),
    account: input.account ?? createAccount(),
    contact: input.contact ?? createContact(),
    productLine: null,
    mailbox: input.mailbox ?? createMailbox(),
    policy: input.policy ?? null,
    firstMessage: input.firstMessage ?? input.message ?? createMessage(),
    messages: input.messages ?? [input.firstMessage ?? input.message ?? createMessage()]
  } as CrmSequenceReviewRecord & { message?: CrmMessageRecord };
  const completed: Parameters<CrmSendWorkerRepository['completeFirstMessageSend']>[0][] = [];
  const failed: Parameters<CrmSendWorkerRepository['failFirstMessageSend']>[0][] = [];
  const claims: Parameters<CrmSendWorkerRepository['claimFirstMessageSendDelivery']>[0][] = [];
  const authExpired: Array<{
    mailboxId: string;
    organizationId: string;
    ownerUserId: string;
    reason: string;
    expiredAt: Date;
  }> = [];

  return {
    completed,
    failed,
    claims,
    authExpired,
    async getGlobalConfig() {
      if (options.globalConfigError) {
        throw options.globalConfigError;
      }

      return options.globalConfig ?? createGlobalConfig();
    },
    async findDefaultEmailTemplateGroup() {
      return options.defaultTemplateGroup ?? null;
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
    },
    async markMailboxAuthorizationExpired(args) {
      authExpired.push(args);
      return {
        mailbox: createMailbox({
          id: args.mailboxId,
          organizationId: args.organizationId,
          ownerUserId: args.ownerUserId,
          status: 'auth_expired',
          pausedAt: args.expiredAt,
          watchExpiration: null
        }),
        pausedEnrollmentCount: 1,
        resetMessageCount: 1
      };
    }
  } satisfies CrmSendWorkerRepository & {
    completed: Parameters<CrmSendWorkerRepository['completeFirstMessageSend']>[0][];
    failed: Parameters<CrmSendWorkerRepository['failFirstMessageSend']>[0][];
    claims: Parameters<CrmSendWorkerRepository['claimFirstMessageSendDelivery']>[0][];
    authExpired: typeof authExpired;
  };
}

function createGateway(
  error?: Error
): CrmEmailSendGateway & { calls: Parameters<CrmEmailSendGateway['sendPlainText']>[0][] } {
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

function createNotificationRecorder() {
  const records: unknown[] = [];

  return {
    records,
    service: {
      async create(input: unknown) {
        records.push(input);
        return input;
      }
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
    archivedAt: input.archivedAt ?? null,
    archiveReason: input.archiveReason ?? null,
    archiveSlimmedAt: input.archiveSlimmedAt ?? null,
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

function createGlobalConfig(input: Partial<CrmGlobalConfigRecord> = {}): CrmGlobalConfigRecord {
  return {
    configKey: input.configKey || 'default',
    emailVerificationCooldownDays: input.emailVerificationCooldownDays ?? 30,
    ownerConcurrentSendLimit: input.ownerConcurrentSendLimit ?? 5,
    ownerDailySendLimitMax: input.ownerDailySendLimitMax ?? 200,
    followUpDelayDays: input.followUpDelayDays ?? {
      step2Days: 3,
      step3Days: 7,
      step4Days: 14,
      step5Days: 21
    },
    updatedAt: input.updatedAt || new Date(0)
  };
}

function createEmailTemplateGroup(input: Partial<CrmEmailTemplateGroupRecord> = {}): CrmEmailTemplateGroupRecord {
  const createdAt = input.createdAt || new Date('2026-06-18T09:00:00.000Z');

  return {
    id: input.id || 'template-group-1',
    organizationId: input.organizationId || 'org-1',
    name: input.name || 'Default outreach',
    language: input.language || 'en',
    description: input.description ?? null,
    status: input.status || 'active',
    isDefault: input.isDefault ?? true,
    steps:
      input.steps ??
      [1, 2, 3, 4, 5].map(stepIndex => ({
        id: `template-step-${stepIndex}`,
        organizationId: input.organizationId || 'org-1',
        templateGroupId: input.id || 'template-group-1',
        stepIndex,
        name: `Step ${stepIndex}`,
        threadMode: stepIndex === 3 ? 'new_subject' : 'same_thread',
        delayDays: stepIndex === 3 ? 5 : stepIndex,
        subjectTemplate: stepIndex === 3 ? 'New sourcing idea for {{account.name}}' : '',
        bodyTemplate:
          stepIndex === 3
            ? 'Hi {{contact.name}},\n\nCould another angle around {{product.name}} help with {{persona.focus}}?\n\nBest regards,\n{{sender.name}}'
            : 'Hi {{contact.name}},\n\nFollowing up on {{product.name}}.\n\nBest regards,\n{{sender.name}}',
        createdAt,
        updatedAt: input.updatedAt || createdAt
      })),
    createdById: input.createdById || 'user-1',
    createdByName: input.createdByName ?? 'Alice',
    createdAt,
    updatedAt: input.updatedAt || createdAt
  };
}

function createSequencePolicy(input: Partial<CrmSequencePolicyRecord> = {}): CrmSequencePolicyRecord {
  const createdAt = input.createdAt || new Date('2026-06-18T09:00:00.000Z');

  return {
    id: input.id || 'policy-1',
    organizationId: input.organizationId || 'org-1',
    name: input.name || 'Default sequence policy',
    description: input.description ?? null,
    status: input.status || 'active',
    isDefault: input.isDefault ?? false,
    steps: input.steps ?? [
      { stepIndex: 1, delayDays: 0, threadMode: 'new_subject' },
      { stepIndex: 2, delayDays: 3, threadMode: 'same_thread' },
      { stepIndex: 3, delayDays: 7, threadMode: 'new_subject' },
      { stepIndex: 4, delayDays: 14, threadMode: 'new_subject' },
      { stepIndex: 5, delayDays: 21, threadMode: 'new_subject' }
    ],
    linkPolicy: input.linkPolicy || 'preserve_template_links',
    allowLowRiskAutoSend: input.allowLowRiskAutoSend ?? false,
    sameCompanyContactStrategy: input.sameCompanyContactStrategy || 'single_active_per_company',
    createdById: input.createdById || 'user-1',
    createdByName: input.createdByName ?? 'Alice',
    createdAt,
    updatedAt: input.updatedAt || createdAt
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
    policyId: input.policyId ?? null,
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
