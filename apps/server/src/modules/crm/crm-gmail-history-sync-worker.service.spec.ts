import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CrmGmailHistorySyncWorkerService } from './crm-gmail-history-sync-worker.service';
import type {
  CrmGmailHistoryGateway,
  CrmGmailHistorySyncQueueJob,
  CrmMailboxHistoryAdvanceInput,
  CrmMailboxRecord,
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

          return { nextHistoryId: input.targetHistoryId };
        }
      }
    );

    const result = await service.processHistorySyncJob(createJob({ historyId: '120' }));

    assert.deepEqual(result, {
      status: 'synced',
      mailboxId: 'mailbox-1',
      fromHistoryId: '100',
      toHistoryId: '120'
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

          return { nextHistoryId: '120' };
        }
      }
    );

    const result = await service.processHistorySyncJob(createJob({ historyId: '100' }));

    assert.deepEqual(result, {
      status: 'skipped',
      reason: 'stale_history',
      mailboxId: 'mailbox-1',
      fromHistoryId: '120',
      toHistoryId: '100'
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
          return { nextHistoryId: input.targetHistoryId };
        }
      }
    );

    const result = await service.processHistorySyncJob(createJob({ historyId: '120' }));

    assert.deepEqual(result, {
      status: 'skipped',
      reason: 'checkpoint_conflict',
      mailboxId: 'mailbox-1',
      fromHistoryId: '100',
      toHistoryId: '120'
    });
  });
});

function createStore(options: {
  mailbox: CrmMailboxRecord | null;
  advanceMailboxHistoryId?: (input: CrmMailboxHistoryAdvanceInput) => Promise<CrmMailboxRecord | null>;
}) {
  return {
    async findMailboxById() {
      return options.mailbox;
    },
    async advanceMailboxHistoryId(input) {
      return options.advanceMailboxHistoryId ? options.advanceMailboxHistoryId(input) : options.mailbox;
    }
  } as Pick<CrmStore, 'findMailboxById' | 'advanceMailboxHistoryId'> as CrmStore;
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
