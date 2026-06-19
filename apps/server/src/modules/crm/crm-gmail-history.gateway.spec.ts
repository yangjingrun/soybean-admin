import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CrmGmailApiHistoryGateway,
  CrmGmailHistoryExpiredError,
  type CrmGmailApiHttpClient,
  type CrmGmailAccessTokenProvider
} from './crm-gmail-history.gateway';
import { CrmGmailAuthorizationExpiredError } from './crm-gmail-watch.gateway';
import type { CrmMailboxRecord } from './crm.types';

describe('CrmGmailApiHistoryGateway', () => {
  it('lists messageAdded history pages and fetches unique messages with full format', async () => {
    const httpClient = createHttpClient([
      {
        status: 200,
        body: {
          history: [
            {
              messagesAdded: [
                { message: { id: 'message-1', threadId: 'thread-1' } },
                { message: { id: 'message-2', threadId: 'thread-2' } }
              ]
            }
          ],
          nextPageToken: 'page-2',
          historyId: '101'
        }
      },
      {
        status: 200,
        body: {
          history: [
            {
              messagesAdded: [{ message: { id: 'message-1', threadId: 'thread-1' } }]
            }
          ],
          historyId: '102'
        }
      },
      {
        status: 200,
        body: createGmailMessage({
          id: 'message-1',
          threadId: 'thread-1',
          subject: 'Re: Product',
          bodyText: 'Please send the catalog.',
          labelIds: ['INBOX']
        })
      },
      {
        status: 200,
        body: createGmailMessage({
          id: 'message-2',
          threadId: 'thread-2',
          subject: 'Sent copy',
          bodyText: 'External sent copy',
          labelIds: ['SENT']
        })
      }
    ]);
    const gateway = new CrmGmailApiHistoryGateway(createTokenProvider('access-token-1'), httpClient);

    const result = await gateway.listHistory({
      mailbox: createMailbox(),
      startHistoryId: '100',
      targetHistoryId: '102'
    });

    assert.equal(result.nextHistoryId, '102');
    assert.equal(result.messages.length, 2);
    assert.equal(result.messages[0].providerMessageId, 'message-1');
    assert.equal(result.messages[0].providerThreadId, 'thread-1');
    assert.equal(result.messages[0].bodyText, 'Please send the catalog.');
    assert.equal(result.messages[0].direction, 'inbound');
    assert.equal(result.messages[1].providerMessageId, 'message-2');
    assert.equal(result.messages[1].providerThreadId, 'thread-2');
    assert.equal(result.messages[1].bodyText, 'External sent copy');
    assert.equal(result.messages[1].direction, 'outbound');
    assert.equal(httpClient.calls.length, 4);
    assert.equal(httpClient.calls[0].headers.Authorization, 'Bearer access-token-1');
    assert.match(httpClient.calls[0].url, /\/gmail\/v1\/users\/me\/history\?/);
    assert.match(httpClient.calls[0].url, /startHistoryId=100/);
    assert.match(httpClient.calls[0].url, /historyTypes=messageAdded/);
    assert.match(httpClient.calls[1].url, /pageToken=page-2/);
    assert.match(httpClient.calls[2].url, /\/gmail\/v1\/users\/me\/messages\/message-1\?/);
    assert.match(httpClient.calls[2].url, /format=full/);
    assert.match(httpClient.calls[3].url, /\/gmail\/v1\/users\/me\/messages\/message-2\?/);
  });

  it('does not call Gmail history when there is no checkpoint yet', async () => {
    const httpClient = createHttpClient([]);
    const gateway = new CrmGmailApiHistoryGateway(createTokenProvider('access-token-1'), httpClient);

    const result = await gateway.listHistory({
      mailbox: createMailbox(),
      startHistoryId: null,
      targetHistoryId: '102'
    });

    assert.equal(result.nextHistoryId, '102');
    assert.deepEqual(result.messages, []);
    assert.equal(httpClient.calls.length, 0);
  });

  it('maps Gmail authorization errors to the shared authorization-expired error', async () => {
    const gateway = new CrmGmailApiHistoryGateway(
      createTokenProvider('access-token-1'),
      createHttpClient([{ status: 401, body: { error: { message: 'Invalid Credentials' } } }])
    );

    await assert.rejects(
      () =>
        gateway.listHistory({
          mailbox: createMailbox(),
          startHistoryId: '100',
          targetHistoryId: '102'
        }),
      CrmGmailAuthorizationExpiredError
    );
  });

  it('maps Gmail auth-like 403 responses to the shared authorization-expired error', async () => {
    const gateway = new CrmGmailApiHistoryGateway(
      createTokenProvider('access-token-1'),
      createHttpClient([
        {
          status: 403,
          body: {
            error: {
              errors: [{ reason: 'authError' }]
            }
          }
        }
      ])
    );

    await assert.rejects(
      () =>
        gateway.listHistory({
          mailbox: createMailbox(),
          startHistoryId: '100',
          targetHistoryId: '102'
        }),
      CrmGmailAuthorizationExpiredError
    );
  });

  it('does not mark Gmail history rate limits as authorization expired', async () => {
    const gateway = new CrmGmailApiHistoryGateway(
      createTokenProvider('access-token-1'),
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
      () =>
        gateway.listHistory({
          mailbox: createMailbox(),
          startHistoryId: '100',
          targetHistoryId: '102'
        }),
      error =>
        error instanceof Error &&
        !(error instanceof CrmGmailAuthorizationExpiredError) &&
        /Gmail API request failed with status 403/.test(error.message)
    );
  });

  it('maps expired Gmail history checkpoints to a dedicated history error', async () => {
    const gateway = new CrmGmailApiHistoryGateway(
      createTokenProvider('access-token-1'),
      createHttpClient([{ status: 404, body: { error: { message: 'History expired' } } }])
    );

    await assert.rejects(
      () =>
        gateway.listHistory({
          mailbox: createMailbox(),
          startHistoryId: '100',
          targetHistoryId: '102'
        }),
      CrmGmailHistoryExpiredError
    );
  });
});

function createHttpClient(responses: Array<{ status: number; body: unknown }>) {
  const calls: Array<{ url: string; headers: Record<string, string> }> = [];
  const client: CrmGmailApiHttpClient & { calls: typeof calls } = {
    calls,
    async getJson(url, headers) {
      calls.push({ url, headers });
      const response = responses.shift();
      assert.ok(response, `Unexpected Gmail API call: ${url}`);
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

function createGmailMessage(input: {
  id: string;
  threadId: string;
  subject: string;
  bodyText: string;
  labelIds: string[];
}) {
  return {
    id: input.id,
    threadId: input.threadId,
    internalDate: String(Date.parse('2026-06-19T08:00:00.000Z')),
    labelIds: input.labelIds,
    payload: {
      mimeType: 'text/plain',
      headers: [
        { name: 'Subject', value: input.subject },
        { name: 'From', value: 'Buyer <buyer@example.com>' }
      ],
      body: {
        data: Buffer.from(input.bodyText, 'utf8').toString('base64url')
      }
    }
  };
}
