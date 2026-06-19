import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CrmGmailApiWatchGateway,
  type CrmGmailWatchApiHttpClient,
  type CrmGmailAccessTokenProvider
} from './crm-gmail-watch.gateway';
import { CrmGmailAuthorizationExpiredError } from './crm-gmail-watch.gateway';
import type { CrmMailboxRecord } from './crm.types';

describe('CrmGmailApiWatchGateway', () => {
  it('renews Gmail watch through the Gmail API with the configured Pub/Sub topic', async () => {
    const httpClient = createHttpClient([
      {
        status: 200,
        body: {
          historyId: '123456',
          expiration: String(Date.parse('2026-06-26T08:00:00.000Z'))
        }
      }
    ]);
    const gateway = new CrmGmailApiWatchGateway(
      createTokenProvider('access-token-1'),
      {
        topicName: 'projects/example-project/topics/gmail-push'
      },
      httpClient
    );

    const result = await gateway.renewWatch({ mailbox: createMailbox() });

    assert.equal(result.historyId, '123456');
    assert.equal(result.watchExpiration.toISOString(), '2026-06-26T08:00:00.000Z');
    assert.equal(httpClient.calls.length, 1);
    assert.equal(httpClient.calls[0].url, 'https://gmail.googleapis.com/gmail/v1/users/me/watch');
    assert.deepEqual(httpClient.calls[0].body, {
      topicName: 'projects/example-project/topics/gmail-push'
    });
    assert.deepEqual(httpClient.calls[0].headers, {
      Authorization: 'Bearer access-token-1',
      'Content-Type': 'application/json'
    });
  });

  it('maps Gmail authorization failures to the shared authorization-expired error', async () => {
    const gateway = new CrmGmailApiWatchGateway(
      createTokenProvider('access-token-1'),
      {
        topicName: 'projects/example-project/topics/gmail-push'
      },
      createHttpClient([{ status: 401, body: { error: { message: 'Invalid Credentials' } } }])
    );

    await assert.rejects(() => gateway.renewWatch({ mailbox: createMailbox() }), CrmGmailAuthorizationExpiredError);
  });

  it('does not mark Gmail rate limit responses as authorization expired', async () => {
    const gateway = new CrmGmailApiWatchGateway(
      createTokenProvider('access-token-1'),
      {
        topicName: 'projects/example-project/topics/gmail-push'
      },
      createHttpClient([
        {
          status: 403,
          body: {
            error: {
              errors: [{ reason: 'rateLimitExceeded' }]
            }
          }
        }
      ])
    );

    await assert.rejects(
      () => gateway.renewWatch({ mailbox: createMailbox() }),
      error => error instanceof Error && !(error instanceof CrmGmailAuthorizationExpiredError)
    );
  });

  it('rejects malformed Gmail watch responses', async () => {
    const gateway = new CrmGmailApiWatchGateway(
      createTokenProvider('access-token-1'),
      {
        topicName: 'projects/example-project/topics/gmail-push'
      },
      createHttpClient([{ status: 200, body: { historyId: '123456' } }])
    );

    await assert.rejects(() => gateway.renewWatch({ mailbox: createMailbox() }), /missing expiration/);
  });
});

function createHttpClient(responses: Array<{ status: number; body: unknown }>) {
  const calls: Array<{ url: string; body: unknown; headers: Record<string, string> }> = [];
  const client: CrmGmailWatchApiHttpClient & { calls: typeof calls } = {
    calls,
    async postJson(url, body, headers) {
      calls.push({ url, body, headers });
      const response = responses.shift();
      assert.ok(response, `Unexpected Gmail watch request: ${url}`);
      return response;
    }
  };

  return client;
}

function createTokenProvider(accessToken: string): CrmGmailAccessTokenProvider {
  return {
    async getAccessToken() {
      return accessToken;
    }
  };
}

function createMailbox(): CrmMailboxRecord {
  return {
    id: 'mailbox-1',
    organizationId: 'org-1',
    ownerUserId: 'user-1',
    ownerUserName: 'User',
    provider: 'gmail',
    emailAddress: 'user@gmail.com',
    emailHash: 'email-hash',
    maskedEmail: 'u***@gmail.com',
    status: 'active',
    dailyLimit: 50,
    hourlyLimit: 10,
    warmupStage: 'ready',
    encryptedRefreshToken: 'encrypted-refresh-token-1',
    watchExpiration: null,
    lastHistoryId: '100',
    authorizedAt: new Date('2026-06-19T08:00:00.000Z'),
    pausedAt: null,
    createdAt: new Date('2026-06-19T08:00:00.000Z'),
    updatedAt: new Date('2026-06-19T08:00:00.000Z')
  };
}
