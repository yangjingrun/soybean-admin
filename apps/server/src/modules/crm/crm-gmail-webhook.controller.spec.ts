import assert from 'node:assert/strict';
import { UnauthorizedException } from '@nestjs/common';
import { afterEach, describe, it } from 'node:test';
import { CrmGmailWebhookController } from './crm-gmail-webhook.controller';
import type { CrmGmailPubSubOidcVerifier } from './crm-gmail-pubsub-oidc.verifier';
import type { CrmGmailWebhookService } from './crm-gmail-webhook.service';

describe('CrmGmailWebhookController', () => {
  const originalAudience = process.env.CRM_GMAIL_PUBSUB_AUTH_AUDIENCE;
  const originalServiceAccount = process.env.CRM_GMAIL_PUBSUB_AUTH_SERVICE_ACCOUNT;
  const originalPushSecret = process.env.CRM_GMAIL_PUBSUB_PUSH_SECRET;
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    restoreEnv('CRM_GMAIL_PUBSUB_AUTH_AUDIENCE', originalAudience);
    restoreEnv('CRM_GMAIL_PUBSUB_AUTH_SERVICE_ACCOUNT', originalServiceAccount);

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

    await assert.rejects(() => controller.handlePubSubPush({ message: { data: 'unused' } }), UnauthorizedException);
    assert.equal(called, false);
  });

  it('treats a blank production Pub/Sub push secret as missing config', async () => {
    process.env.NODE_ENV = 'production';
    process.env.CRM_GMAIL_PUBSUB_PUSH_SECRET = '   ';
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
      () => controller.handlePubSubPush({ message: { data: 'unused' } }, 'anything'),
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

  it('normalizes configured and request Pub/Sub push secrets before comparing', async () => {
    process.env.CRM_GMAIL_PUBSUB_PUSH_SECRET = ' expected-secret ';
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

    const result = await controller.handlePubSubPush({ message: { data: 'unused' } }, ' expected-secret ');

    assert.equal(result.code, '0000');
    assert.equal(result.data.queued, true);
  });

  it('verifies Pub/Sub OIDC bearer tokens when push auth is configured', async () => {
    process.env.CRM_GMAIL_PUBSUB_AUTH_AUDIENCE = 'https://api.example.com/crm/gmail/pubsub/push';
    process.env.CRM_GMAIL_PUBSUB_AUTH_SERVICE_ACCOUNT = 'pubsub-push@example.iam.gserviceaccount.com';
    const verifierCalls: Array<{ token: string; audience: string; serviceAccountEmail: string }> = [];
    const controller = new CrmGmailWebhookController(
      {
        async handlePubSubPush() {
          return {
            queued: true,
            mailboxId: 'mailbox-1',
            historyId: '12345',
            pubsubMessageId: 'pubsub-1',
            jobId: 'job-1'
          };
        }
      } as Pick<CrmGmailWebhookService, 'handlePubSubPush'> as CrmGmailWebhookService,
      {
        async verify(input) {
          verifierCalls.push(input);
        }
      } as Pick<CrmGmailPubSubOidcVerifier, 'verify'> as CrmGmailPubSubOidcVerifier
    );

    const result = await controller.handlePubSubPush({ message: { data: 'unused' } }, '', 'Bearer oidc-token-1');

    assert.equal(result.code, '0000');
    assert.deepEqual(verifierCalls, [
      {
        token: 'oidc-token-1',
        audience: 'https://api.example.com/crm/gmail/pubsub/push',
        serviceAccountEmail: 'pubsub-push@example.iam.gserviceaccount.com'
      }
    ]);
  });

  it('rejects Pub/Sub OIDC requests without bearer tokens when push auth is configured', async () => {
    process.env.CRM_GMAIL_PUBSUB_AUTH_AUDIENCE = 'https://api.example.com/crm/gmail/pubsub/push';
    process.env.CRM_GMAIL_PUBSUB_AUTH_SERVICE_ACCOUNT = 'pubsub-push@example.iam.gserviceaccount.com';
    let called = false;
    const controller = new CrmGmailWebhookController(
      {
        async handlePubSubPush() {
          called = true;

          return {
            queued: false,
            reason: 'mailbox_not_found',
            historyId: '12345',
            pubsubMessageId: 'pubsub-1'
          };
        }
      } as Pick<CrmGmailWebhookService, 'handlePubSubPush'> as CrmGmailWebhookService,
      {
        async verify() {}
      } as Pick<CrmGmailPubSubOidcVerifier, 'verify'> as CrmGmailPubSubOidcVerifier
    );

    await assert.rejects(() => controller.handlePubSubPush({ message: { data: 'unused' } }), UnauthorizedException);
    assert.equal(called, false);
  });
});

function restoreEnv(key: string, originalValue: string | undefined) {
  if (originalValue === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = originalValue;
}
