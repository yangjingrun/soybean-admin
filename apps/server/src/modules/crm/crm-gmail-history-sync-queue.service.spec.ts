import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CrmGmailHistorySyncQueueService, toCrmGmailHistorySyncJobId } from './crm-gmail-history-sync-queue.service';

describe('CrmGmailHistorySyncQueueService', () => {
  it('enqueues Gmail history sync jobs with deterministic ids and retained failures', async () => {
    let addCall:
      | {
          name: string;
          input: unknown;
          options: { jobId?: string; removeOnComplete?: boolean; removeOnFail?: unknown };
        }
      | undefined;
    const service = new CrmGmailHistorySyncQueueService({
      createBullMqConnectionOptions: () => ({})
    } as never);
    const realQueue = (service as never as { queue: { close(): Promise<void> } }).queue;
    await realQueue.close();

    (service as never as { queue: unknown }).queue = {
      async waitUntilReady() {},
      async add(
        name: string,
        input: unknown,
        options: { jobId?: string; removeOnComplete?: boolean; removeOnFail?: unknown }
      ) {
        addCall = { name, input, options };

        return { id: options.jobId };
      }
    };

    const result = await service.enqueueHistorySync({
      mailboxId: 'mailbox-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      emailAddress: 'alice@gmail.com',
      emailHash: 'email-hash-1',
      historyId: '12345',
      pubsubMessageId: 'pubsub-1',
      publishTime: '2026-06-19T09:00:00.000Z'
    });

    assert.equal(result.jobId, 'crm-gmail-history-sync__mailbox-1__12345');
    assert.equal(result.jobId.includes(':'), false);
    assert.equal(addCall?.name, 'gmail-history-sync');
    assert.deepEqual(addCall?.input, {
      mailboxId: 'mailbox-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      emailAddress: 'alice@gmail.com',
      emailHash: 'email-hash-1',
      historyId: '12345',
      pubsubMessageId: 'pubsub-1',
      publishTime: '2026-06-19T09:00:00.000Z'
    });
    assert.deepEqual(addCall?.options, {
      jobId: 'crm-gmail-history-sync__mailbox-1__12345',
      removeOnComplete: true,
      removeOnFail: { age: 604_800, count: 1000 }
    });
  });

  it('deduplicates manual and Pub/Sub sync jobs by mailbox and history id', () => {
    assert.equal(toCrmGmailHistorySyncJobId('mailbox-1', '12345'), 'crm-gmail-history-sync__mailbox-1__12345');
    assert.equal(
      toCrmGmailHistorySyncJobId('mailbox-1', '12345', 'pubsub-1'),
      'crm-gmail-history-sync__mailbox-1__12345'
    );
    assert.equal(
      toCrmGmailHistorySyncJobId('mailbox-1', '12345', 'pubsub-2'),
      'crm-gmail-history-sync__mailbox-1__12345'
    );
  });
});
