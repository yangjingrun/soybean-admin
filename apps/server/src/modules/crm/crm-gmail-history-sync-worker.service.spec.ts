import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CrmGmailHistorySyncWorkerService } from './crm-gmail-history-sync-worker.service';
import type {
  CrmGmailHistoryGateway,
  CrmGmailHistorySyncQueueJob,
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
  advanceMailboxHistoryId?: (input: CrmMailboxHistoryAdvanceInput) => Promise<CrmMailboxRecord | null>;
  ingestCustomerReply?: (input: Parameters<CrmStore['ingestCustomerReply']>[0]) => ReturnType<CrmStore['ingestCustomerReply']>;
}) {
  return {
    async findMailboxById() {
      return options.mailbox;
    },
    async findSentMessageByProviderId(args) {
      if (
        !options.sentMessage ||
        options.sentMessage.organizationId !== args.organizationId ||
        options.sentMessage.ownerUserId !== args.ownerUserId ||
        options.sentMessage.mailboxId !== args.mailboxId ||
        options.sentMessage.providerMessageId !== args.providerMessageId
      ) {
        return null;
      }

      return options.sentMessage;
    },
    async advanceMailboxHistoryId(input) {
      return options.advanceMailboxHistoryId ? options.advanceMailboxHistoryId(input) : options.mailbox;
    },
    async ingestCustomerReply(input) {
      return options.ingestCustomerReply ? options.ingestCustomerReply(input) : null;
    }
  } as Pick<
    CrmStore,
    'findMailboxById' | 'findSentMessageByProviderId' | 'advanceMailboxHistoryId' | 'ingestCustomerReply'
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
