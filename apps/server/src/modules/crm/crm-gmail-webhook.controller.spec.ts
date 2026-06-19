import assert from 'node:assert/strict';
import { UnauthorizedException } from '@nestjs/common';
import { afterEach, describe, it } from 'node:test';
import { CrmGmailWebhookController } from './crm-gmail-webhook.controller';
import type { CrmGmailWebhookService } from './crm-gmail-webhook.service';

describe('CrmGmailWebhookController', () => {
  const originalPushSecret = process.env.CRM_GMAIL_PUBSUB_PUSH_SECRET;
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (originalPushSecret === undefined) {
      delete process.env.CRM_GMAIL_PUBSUB_PUSH_SECRET;
    } else {
      process.env.CRM_GMAIL_PUBSUB_PUSH_SECRET = originalPushSecret;
    }

    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

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

  it('rejects Pub/Sub push requests with a wrong configured secret', async () => {
    process.env.CRM_GMAIL_PUBSUB_PUSH_SECRET = 'expected-secret';
    let called = false;
    const controller = new CrmGmailWebhookController({
      async handlePubSubPush() {
        called = true;

        return {
          queued: false,
          reason: 'mailbox_not_found',
          historyId: '12345',
          pubsubMessageId: 'pubsub-1'
        };
      }
    } as Pick<CrmGmailWebhookService, 'handlePubSubPush'> as CrmGmailWebhookService);

    await assert.rejects(
      () => controller.handlePubSubPush({ message: { data: 'unused' } }, 'wrong-secret'),
      UnauthorizedException
    );
    assert.equal(called, false);
  });

  it('rejects production Pub/Sub push requests when the secret is not configured', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.CRM_GMAIL_PUBSUB_PUSH_SECRET;
    let called = false;
    const controller = new CrmGmailWebhookController({
      async handlePubSubPush() {
        called = true;

        return {
          queued: false,
          reason: 'mailbox_not_found',
          historyId: '12345',
          pubsubMessageId: 'pubsub-1'
        };
      }
    } as Pick<CrmGmailWebhookService, 'handlePubSubPush'> as CrmGmailWebhookService);

    await assert.rejects(
      () => controller.handlePubSubPush({ message: { data: 'unused' } }),
      UnauthorizedException
    );
    assert.equal(called, false);
  });

  it('accepts Pub/Sub push requests with a matching configured secret', async () => {
    process.env.CRM_GMAIL_PUBSUB_PUSH_SECRET = 'expected-secret';
    const controller = new CrmGmailWebhookController({
      async handlePubSubPush() {
        return {
          queued: true,
          mailboxId: 'mailbox-1',
          historyId: '12345',
          pubsubMessageId: 'pubsub-1',
          jobId: 'job-1'
        };
      }
    } as Pick<CrmGmailWebhookService, 'handlePubSubPush'> as CrmGmailWebhookService);

    const result = await controller.handlePubSubPush({ message: { data: 'unused' } }, 'expected-secret');

    assert.equal(result.code, '0000');
    assert.equal(result.data.queued, true);
  });
});
