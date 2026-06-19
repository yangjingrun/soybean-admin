import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CrmGmailWebhookController } from './crm-gmail-webhook.controller';
import type { CrmGmailWebhookService } from './crm-gmail-webhook.service';

describe('CrmGmailWebhookController', () => {
  it('passes Pub/Sub push payloads to the webhook service', async () => {
    const calls: unknown[] = [];
    const controller = new CrmGmailWebhookController({
      async handlePubSubPush(payload: unknown) {
        calls.push(payload);

        return {
          queued: true,
          mailboxId: 'mailbox-1',
          historyId: '12345',
          pubsubMessageId: 'pubsub-1',
          jobId: 'mailbox-1:12345:pubsub-1'
        };
      }
    } as Pick<CrmGmailWebhookService, 'handlePubSubPush'> as CrmGmailWebhookService);

    const payload = {
      message: {
        data: 'eyJlbWFpbEFkZHJlc3MiOiJhbGljZUBnbWFpbC5jb20iLCJoaXN0b3J5SWQiOiIxMjM0NSJ9'
      }
    };
    const result = await controller.handlePubSubPush(payload);

    assert.equal(result.code, '0000');
    assert.deepEqual(calls, [payload]);
    assert.deepEqual(result.data, {
      queued: true,
      mailboxId: 'mailbox-1',
      historyId: '12345',
      pubsubMessageId: 'pubsub-1',
      jobId: 'mailbox-1:12345:pubsub-1'
    });
  });
});
