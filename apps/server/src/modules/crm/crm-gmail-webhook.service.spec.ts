import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, it } from 'node:test';
import { CrmGmailWebhookService } from './crm-gmail-webhook.service';
import type { CrmGmailHistorySyncQueueJob, CrmStore } from './crm.types';

describe('CrmGmailWebhookService', () => {
  it('enqueues a history sync job for a known Gmail mailbox', async () => {
    const queued: CrmGmailHistorySyncQueueJob[] = [];
    const service = new CrmGmailWebhookService(createStore(), {
      async enqueueHistorySync(input) {
        queued.push(input);

        return { jobId: 'mailbox-1:12345:pubsub-1' };
      }
    });

    const result = await service.handlePubSubPush(
      createEnvelope({
        emailAddress: ' Alice@Gmail.COM ',
        historyId: '12345'
      })
    );

    assert.deepEqual(result, {
      queued: true,
      mailboxId: 'mailbox-1',
      historyId: '12345',
      pubsubMessageId: 'pubsub-1',
      jobId: 'mailbox-1:12345:pubsub-1'
    });
    assert.deepEqual(queued, [
      {
        mailboxId: 'mailbox-1',
        organizationId: 'org-1',
        ownerUserId: 'user-1',
        emailAddress: 'alice@gmail.com',
        emailHash: sha256('alice@gmail.com'),
        historyId: '12345',
        pubsubMessageId: 'pubsub-1',
        publishTime: '2026-06-19T08:00:00.000Z'
      }
    ]);
  });

  it('acks unmatched mailbox notifications without enqueueing sync jobs', async () => {
    const queued: CrmGmailHistorySyncQueueJob[] = [];
    const service = new CrmGmailWebhookService(createStore({ mailbox: null }), {
      async enqueueHistorySync(input) {
        queued.push(input);

        return { jobId: 'unused' };
      }
    });

    const result = await service.handlePubSubPush(
      createEnvelope({
        emailAddress: 'missing@gmail.com',
        historyId: '12345'
      })
    );

    assert.deepEqual(result, {
      queued: false,
      reason: 'mailbox_not_found',
      historyId: '12345',
      pubsubMessageId: 'pubsub-1'
    });
    assert.equal(queued.length, 0);
  });
});

function createStore(options: { mailbox?: Awaited<ReturnType<CrmStore['findMailboxByProviderAndEmailHash']>> } = {}) {
  const mailbox =
    options.mailbox === undefined
      ? {
          id: 'mailbox-1',
          organizationId: 'org-1',
          ownerUserId: 'user-1',
          ownerUserName: 'Alice',
          provider: 'gmail' as const,
          emailAddress: 'alice@gmail.com',
          emailHash: sha256('alice@gmail.com'),
          maskedEmail: 'a***@gmail.com',
          status: 'active' as const,
          dailyLimit: 50,
          hourlyLimit: 10,
          warmupStage: 'new' as const,
          watchExpiration: null,
          lastHistoryId: null,
          authorizedAt: new Date('2026-06-18T09:00:00.000Z'),
          pausedAt: null,
          createdAt: new Date('2026-06-18T09:00:00.000Z'),
          updatedAt: new Date('2026-06-18T09:00:00.000Z')
        }
      : options.mailbox;

  return {
    async findMailboxByProviderAndEmailHash(provider, emailHash) {
      if (!mailbox || provider !== 'gmail' || emailHash !== mailbox.emailHash) return null;

      return mailbox;
    }
  } as Pick<CrmStore, 'findMailboxByProviderAndEmailHash'> as CrmStore;
}

function createEnvelope(data: Record<string, unknown>) {
  return {
    message: {
      data: Buffer.from(JSON.stringify(data)).toString('base64'),
      messageId: 'pubsub-1',
      publishTime: '2026-06-19T08:00:00.000Z'
    }
  };
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
