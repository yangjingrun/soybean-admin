import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CrmGmailHistorySyncWorkerService } from './crm-gmail-history-sync-worker.service';
import { CrmGmailAuthorizationExpiredError } from './crm-gmail-watch.gateway';
import type {
  CrmGmailHistoryGateway,
  CrmGmailHistorySyncQueueJob,
  CrmMailboxAuthorizationExpiredInput,
  CrmMailboxHistoryAdvanceInput,
  CrmMailboxRecord,
  CrmMessageRecord,
  CrmStore
} from './crm.types';

describe('CrmGmailHistorySyncWorkerService', () => {
  it('lists Gmail history and advances the mailbox checkpoint', async () => {
    const mailbox = createMailbox({ lastHistoryId: '100' });
    const advanceCalls: CrmMailboxHistoryAdvanceInput[] = [];
    const gatewayCalls: Parameters<CrmGmailHistoryGateway['listHistory']>[0][] = [];
    const service = new CrmGmailHistorySyncWorkerService(
      createStore({
        mailbox,
        async advanceMailboxHistoryId(input) {
          advanceCalls.push(input);

          return { ...mailbox, lastHistoryId: input.toHistoryId };
        }
      }),
      {
        async listHistory(input) {
          gatewayCalls.push(input);

          return { nextHistoryId: input.targetHistoryId, messages: [] };
        }
      }
    );

    const result = await service.processHistorySyncJob(createJob({ historyId: '120' }));

    assert.deepEqual(result, {
      status: 'synced',
      mailboxId: 'mailbox-1',
      fromHistoryId: '100',
      toHistoryId: '120',
      ingestedCount: 0,
      skippedMessageCount: 0
    });
    assert.equal(gatewayCalls[0].startHistoryId, '100');
    assert.equal(gatewayCalls[0].targetHistoryId, '120');
    assert.deepEqual(advanceCalls, [
      {
        mailboxId: 'mailbox-1',
        organizationId: 'org-1',
        ownerUserId: 'user-1',
        fromHistoryId: '100',
        toHistoryId: '120'
      }
    ]);
  });

  it('skips stale history ids without calling Gmail', async () => {
    let gatewayCalled = false;
    const service = new CrmGmailHistorySyncWorkerService(
      createStore({ mailbox: createMailbox({ lastHistoryId: '120' }) }),
      {
        async listHistory() {
          gatewayCalled = true;

          return { nextHistoryId: '120', messages: [] };
        }
      }
    );

    const result = await service.processHistorySyncJob(createJob({ historyId: '100' }));

    assert.deepEqual(result, {
      status: 'skipped',
      reason: 'stale_history',
      mailboxId: 'mailbox-1',
      fromHistoryId: '120',
      toHistoryId: '100',
      ingestedCount: 0,
      skippedMessageCount: 0
    });
    assert.equal(gatewayCalled, false);
  });

  it('skips non-active mailboxes without calling Gmail', async () => {
    let gatewayCalled = false;
    const service = new CrmGmailHistorySyncWorkerService(
      createStore({ mailbox: createMailbox({ status: 'paused', lastHistoryId: '100' }) }),
      {
        async listHistory() {
          gatewayCalled = true;

          return { nextHistoryId: '120', messages: [] };
        }
      }
    );

    const result = await service.processHistorySyncJob(createJob({ historyId: '120' }));

    assert.deepEqual(result, {
      status: 'skipped',
      reason: 'mailbox_not_active',
      mailboxId: 'mailbox-1',
      fromHistoryId: '100',
      toHistoryId: '120',
      ingestedCount: 0,
      skippedMessageCount: 0
    });
    assert.equal(gatewayCalled, false);
  });

  it('marks mailbox auth expired and skips retries when Gmail history rejects authorization', async () => {
    const mailbox = createMailbox({ lastHistoryId: '100' });
    const expiredCalls: CrmMailboxAuthorizationExpiredInput[] = [];
    const service = new CrmGmailHistorySyncWorkerService(
      createStore({
        mailbox,
        async markMailboxAuthorizationExpired(input) {
          expiredCalls.push(input);

          return {
            mailbox: { ...mailbox, status: 'auth_expired', watchExpiration: null },
            pausedEnrollmentCount: 0,
            resetMessageCount: 0
          };
        }
      }),
      {
        async listHistory() {
          throw new CrmGmailAuthorizationExpiredError('invalid_grant');
        }
      }
    );

    const result = await service.processHistorySyncJob(createJob({ historyId: '120' }));

    assert.equal(result.status, 'skipped');
    assert.equal(result.reason, 'authorization_expired');
    assert.equal(result.mailboxId, 'mailbox-1');
    assert.equal(result.fromHistoryId, '100');
    assert.equal(result.toHistoryId, '120');
    assert.equal(expiredCalls.length, 1);
    assert.equal(expiredCalls[0].mailboxId, 'mailbox-1');
    assert.equal(expiredCalls[0].organizationId, 'org-1');
    assert.equal(expiredCalls[0].ownerUserId, 'user-1');
    assert.equal(expiredCalls[0].reason, 'invalid_grant');
  });

  it('skips when another worker has advanced the checkpoint first', async () => {
    const mailbox = createMailbox({ lastHistoryId: '100' });
    const service = new CrmGmailHistorySyncWorkerService(
      createStore({
        mailbox,
        async advanceMailboxHistoryId() {
          return null;
        }
      }),
      {
        async listHistory(input) {
          return { nextHistoryId: input.targetHistoryId, messages: [] };
        }
      }
    );

    const result = await service.processHistorySyncJob(createJob({ historyId: '120' }));

    assert.deepEqual(result, {
      status: 'skipped',
      reason: 'checkpoint_conflict',
      mailboxId: 'mailbox-1',
      fromHistoryId: '100',
      toHistoryId: '120',
      ingestedCount: 0,
      skippedMessageCount: 0
    });
  });

  it('ingests Gmail messages that reply to known sent provider messages', async () => {
    const mailbox = createMailbox({ lastHistoryId: '100' });
    const ingested: Parameters<CrmStore['ingestCustomerReply']>[0][] = [];
    const service = new CrmGmailHistorySyncWorkerService(
      createStore({
        mailbox,
        sentMessage: createMessage({ providerMessageId: 'gmail-sent-1' }),
        async advanceMailboxHistoryId(input) {
          return { ...mailbox, lastHistoryId: input.toHistoryId };
        },
        async ingestCustomerReply(input) {
          ingested.push(input);

          return { isDuplicate: false } as Awaited<ReturnType<CrmStore['ingestCustomerReply']>>;
        }
      }),
      {
        async listHistory(input) {
          return {
            nextHistoryId: input.targetHistoryId,
            messages: [
              {
                providerMessageId: 'gmail-reply-1',
                providerThreadId: 'gmail-thread-1',
                replyToProviderMessageId: 'gmail-sent-1',
                subject: 'Re: Bearing Series',
                bodyText: 'Please send details.',
                receivedAt: new Date('2026-06-19T08:30:00.000Z')
              },
              {
                providerMessageId: 'gmail-unmatched-1',
                providerThreadId: 'gmail-thread-2',
                replyToProviderMessageId: 'missing-sent-message',
                subject: 'Unknown thread',
                bodyText: 'Hello',
                receivedAt: new Date('2026-06-19T08:40:00.000Z')
              }
            ]
          };
        }
      }
    );

    const result = await service.processHistorySyncJob(createJob({ historyId: '120' }));

    assert.equal(result.ingestedCount, 1);
    assert.equal(result.skippedMessageCount, 1);
    assert.deepEqual(ingested, [
      {
        outboundMessageId: 'message-1',
        organizationId: 'org-1',
        ownerUserId: 'user-1',
        subject: 'Re: Bearing Series',
        bodyText: 'Please send details.',
        receivedAt: new Date('2026-06-19T08:30:00.000Z'),
        providerThreadId: 'gmail-thread-1',
        providerMessageId: 'gmail-reply-1',
        messageType: undefined
      }
    ]);
  });

  it('falls back to provider thread id when reply-to is missing or unmatched', async () => {
    const mailbox = createMailbox({ lastHistoryId: '100' });
    const providerIdLookups: Array<{
      organizationId: string;
      ownerUserId: string;
      mailboxId: string | null;
      providerMessageId: string;
    }> = [];
    const providerThreadLookups: Array<{
      organizationId: string;
      ownerUserId: string;
      mailboxId: string | null;
      providerThreadId: string;
    }> = [];
    const ingested: Parameters<CrmStore['ingestCustomerReply']>[0][] = [];
    const service = new CrmGmailHistorySyncWorkerService(
      createStore({
        mailbox,
        sentMessages: [
          createMessage({
            id: 'message-thread-hit',
            providerMessageId: 'gmail-sent-thread-hit',
            providerThreadId: 'gmail-thread-hit'
          }),
          createMessage({
            id: 'message-other-mailbox',
            mailboxId: 'mailbox-2',
            providerMessageId: 'gmail-sent-other-mailbox',
            providerThreadId: 'gmail-thread-hit'
          })
        ],
        async findSentMessageByProviderId(input) {
          providerIdLookups.push(input);
          return null;
        },
        async findSentMessageByProviderThreadId(input) {
          providerThreadLookups.push(input);
          return null;
        },
        async advanceMailboxHistoryId(input) {
          return { ...mailbox, lastHistoryId: input.toHistoryId };
        },
        async ingestCustomerReply(input) {
          ingested.push(input);

          return { isDuplicate: false } as Awaited<ReturnType<CrmStore['ingestCustomerReply']>>;
        }
      }),
      {
        async listHistory(input) {
          return {
            nextHistoryId: input.targetHistoryId,
            messages: [
              {
                providerMessageId: 'gmail-reply-no-reply-to',
                providerThreadId: 'gmail-thread-hit',
                replyToProviderMessageId: null,
                subject: 'Re: Bearing Series',
                bodyText: 'No In-Reply-To header here.',
                receivedAt: new Date('2026-06-19T08:30:00.000Z')
              },
              {
                providerMessageId: 'gmail-reply-invalid-reply-to',
                providerThreadId: 'gmail-thread-hit',
                replyToProviderMessageId: 'missing-sent-message',
                subject: 'Re: Bearing Series again',
                bodyText: 'In-Reply-To does not match locally.',
                receivedAt: new Date('2026-06-19T08:40:00.000Z')
              }
            ]
          };
        }
      }
    );

    const result = await service.processHistorySyncJob(createJob({ historyId: '120' }));

    assert.equal(result.ingestedCount, 2);
    assert.equal(result.skippedMessageCount, 0);
    assert.deepEqual(providerIdLookups, [
      {
        organizationId: 'org-1',
        ownerUserId: 'user-1',
        mailboxId: 'mailbox-1',
        providerMessageId: 'missing-sent-message'
      }
    ]);
    assert.deepEqual(providerThreadLookups, [
      {
        organizationId: 'org-1',
        ownerUserId: 'user-1',
        mailboxId: 'mailbox-1',
        providerThreadId: 'gmail-thread-hit'
      },
      {
        organizationId: 'org-1',
        ownerUserId: 'user-1',
        mailboxId: 'mailbox-1',
        providerThreadId: 'gmail-thread-hit'
      }
    ]);
    assert.deepEqual(
      ingested.map(input => input.outboundMessageId),
      ['message-thread-hit', 'message-thread-hit']
    );
  });

  it('keeps the checkpoint moving when Gmail redelivers an already ingested message', async () => {
    const mailbox = createMailbox({ lastHistoryId: '120' });
    const advanceCalls: CrmMailboxHistoryAdvanceInput[] = [];
    const service = new CrmGmailHistorySyncWorkerService(
      createStore({
        mailbox,
        sentMessage: createMessage({ providerMessageId: 'gmail-sent-1' }),
        async advanceMailboxHistoryId(input) {
          advanceCalls.push(input);

          return { ...mailbox, lastHistoryId: input.toHistoryId };
        },
        async ingestCustomerReply() {
          return { isDuplicate: true } as Awaited<ReturnType<CrmStore['ingestCustomerReply']>>;
        }
      }),
      {
        async listHistory(input) {
          return {
            nextHistoryId: input.targetHistoryId,
            messages: [
              {
                providerMessageId: 'gmail-reply-1',
                providerThreadId: 'gmail-thread-1',
                replyToProviderMessageId: 'gmail-sent-1',
                subject: 'Re: Bearing Series',
                bodyText: 'Please send details.',
                receivedAt: new Date('2026-06-19T08:30:00.000Z')
              }
            ]
          };
        }
      }
    );

    const result = await service.processHistorySyncJob(createJob({ historyId: '130' }));

    assert.deepEqual(result, {
      status: 'synced',
      mailboxId: 'mailbox-1',
      fromHistoryId: '120',
      toHistoryId: '130',
      ingestedCount: 0,
      skippedMessageCount: 0
    });
    assert.deepEqual(advanceCalls, [
      {
        mailboxId: 'mailbox-1',
        organizationId: 'org-1',
        ownerUserId: 'user-1',
        fromHistoryId: '120',
        toHistoryId: '130'
      }
    ]);
  });
});

function createStore(options: {
  mailbox: CrmMailboxRecord | null;
  sentMessage?: CrmMessageRecord | null;
  sentMessages?: CrmMessageRecord[];
  findSentMessageByProviderId?: (input: {
    organizationId: string;
    ownerUserId: string;
    mailboxId: string | null;
    providerMessageId: string;
  }) => Promise<CrmMessageRecord | null>;
  findSentMessageByProviderThreadId?: (input: {
    organizationId: string;
    ownerUserId: string;
    mailboxId: string | null;
    providerThreadId: string;
  }) => Promise<CrmMessageRecord | null>;
  markMailboxAuthorizationExpired?: (
    input: CrmMailboxAuthorizationExpiredInput
  ) => ReturnType<CrmStore['markMailboxAuthorizationExpired']>;
  advanceMailboxHistoryId?: (input: CrmMailboxHistoryAdvanceInput) => Promise<CrmMailboxRecord | null>;
  ingestCustomerReply?: (input: Parameters<CrmStore['ingestCustomerReply']>[0]) => ReturnType<CrmStore['ingestCustomerReply']>;
}) {
  const sentMessages = options.sentMessages ?? (options.sentMessage ? [options.sentMessage] : []);

  return {
    async findMailboxById() {
      return options.mailbox;
    },
    async findSentMessageByProviderId(args) {
      if (options.findSentMessageByProviderId) {
        return options.findSentMessageByProviderId(args);
      }

      return (
        sentMessages.find(message => {
          if (message.organizationId !== args.organizationId) return false;
          if (message.ownerUserId !== args.ownerUserId) return false;
          if (message.mailboxId !== args.mailboxId) return false;
          if (message.providerMessageId !== args.providerMessageId) return false;
          return message.status === 'sent';
        }) ?? null
      );
    },
    async findSentMessageByProviderThreadId(args) {
      const scopedMessage =
        sentMessages.find(message => {
          if (message.organizationId !== args.organizationId) return false;
          if (message.ownerUserId !== args.ownerUserId) return false;
          if (message.mailboxId !== args.mailboxId) return false;
          if (message.providerThreadId !== args.providerThreadId) return false;
          return message.status === 'sent';
        }) ?? null;

      if (options.findSentMessageByProviderThreadId) {
        return (await options.findSentMessageByProviderThreadId(args)) ?? scopedMessage;
      }

      return scopedMessage;
    },
    async advanceMailboxHistoryId(input) {
      return options.advanceMailboxHistoryId ? options.advanceMailboxHistoryId(input) : options.mailbox;
    },
    async markMailboxAuthorizationExpired(input) {
      return options.markMailboxAuthorizationExpired ? options.markMailboxAuthorizationExpired(input) : null;
    },
    async ingestCustomerReply(input) {
      return options.ingestCustomerReply ? options.ingestCustomerReply(input) : null;
    }
  } as Pick<
    CrmStore,
    | 'findMailboxById'
    | 'findSentMessageByProviderId'
    | 'findSentMessageByProviderThreadId'
    | 'markMailboxAuthorizationExpired'
    | 'advanceMailboxHistoryId'
    | 'ingestCustomerReply'
  > as CrmStore;
}

function createJob(input: Partial<CrmGmailHistorySyncQueueJob> = {}): CrmGmailHistorySyncQueueJob {
  return {
    mailboxId: 'mailbox-1',
    organizationId: 'org-1',
    ownerUserId: 'user-1',
    emailAddress: 'alice@gmail.com',
    emailHash: 'email-hash-1',
    historyId: '120',
    pubsubMessageId: 'pubsub-1',
    publishTime: '2026-06-19T08:00:00.000Z',
    ...input
  };
}

function createMailbox(input: Partial<CrmMailboxRecord> = {}): CrmMailboxRecord {
  return {
    id: 'mailbox-1',
    organizationId: 'org-1',
    ownerUserId: 'user-1',
    ownerUserName: 'Alice',
    provider: 'gmail',
    emailAddress: 'alice@gmail.com',
    emailHash: 'email-hash-1',
    maskedEmail: 'a***@gmail.com',
    status: 'active',
    dailyLimit: 50,
    hourlyLimit: 10,
    warmupStage: 'new',
    encryptedRefreshToken: input.encryptedRefreshToken ?? null,
    watchExpiration: null,
    lastHistoryId: null,
    authorizedAt: new Date('2026-06-18T09:00:00.000Z'),
    pausedAt: null,
    createdAt: new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: new Date('2026-06-18T09:00:00.000Z'),
    ...input
  };
}

function createMessage(input: Partial<CrmMessageRecord> = {}): CrmMessageRecord {
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
    subject: 'Bearing Series',
    bodyText: 'Hi Ali',
    status: 'sent',
    scheduledAt: null,
    sentAt: new Date('2026-06-18T10:00:00.000Z'),
    bullJobId: null,
    providerMessageId: null,
    providerThreadId: null,
    createdAt: new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: new Date('2026-06-18T10:00:00.000Z'),
    ...input
  };
}
