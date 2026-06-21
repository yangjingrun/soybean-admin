import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ServiceUnavailableException } from '@nestjs/common';
import {
  CrmGmailOAuthTokenProvider,
  decryptGmailSecret,
  encryptGmailSecret,
  type CrmGmailOAuthHttpClient
} from './crm-gmail-oauth-token.provider';
import { CrmGmailAuthorizationExpiredError } from './crm-gmail-watch.gateway';
import type { CrmMailboxRecord } from './crm.types';

describe('Gmail OAuth token encryption', () => {
  it('encrypts refresh tokens without leaving plaintext in the stored value', () => {
    const secretKey = '0123456789abcdef0123456789abcdef';

    const encrypted = encryptGmailSecret('refresh-token-1', secretKey);

    assert.notEqual(encrypted, 'refresh-token-1');
    assert.equal(encrypted.includes('refresh-token-1'), false);
    assert.equal(decryptGmailSecret(encrypted, secretKey), 'refresh-token-1');
  });

  it('rejects tampered encrypted refresh tokens', () => {
    const secretKey = '0123456789abcdef0123456789abcdef';
    const encrypted = encryptGmailSecret('refresh-token-1', secretKey);

    assert.throws(() => decryptGmailSecret(`${encrypted.slice(0, -2)}aa`, secretKey));
  });

  it('returns a handled service error when the token encryption key length is invalid', () => {
    assert.throws(
      () => encryptGmailSecret('refresh-token-1', 'short-key'),
      (error: unknown) => error instanceof ServiceUnavailableException && /32 字节/.test(error.message)
    );
  });
});

describe('CrmGmailOAuthTokenProvider', () => {
  it('decrypts the mailbox refresh token and exchanges it for an access token', async () => {
    const secretKey = '0123456789abcdef0123456789abcdef';
    const encryptedRefreshToken = encryptGmailSecret('refresh-token-1', secretKey);
    const httpClient = createHttpClient([
      {
        status: 200,
        body: {
          access_token: 'access-token-1',
          expires_in: 3600,
          token_type: 'Bearer'
        }
      }
    ]);
    const provider = new CrmGmailOAuthTokenProvider(
      {
        clientId: 'client-id-1',
        clientSecret: 'client-secret-1',
        tokenEncryptionKey: secretKey
      },
      httpClient
    );

    const accessToken = await provider.getAccessToken(createMailbox({ encryptedRefreshToken }));

    assert.equal(accessToken, 'access-token-1');
    assert.equal(httpClient.calls.length, 1);
    assert.equal(httpClient.calls[0].url, 'https://oauth2.googleapis.com/token');
    assert.equal(httpClient.calls[0].headers['Content-Type'], 'application/x-www-form-urlencoded');
    assert.equal(httpClient.calls[0].body.get('client_id'), 'client-id-1');
    assert.equal(httpClient.calls[0].body.get('client_secret'), 'client-secret-1');
    assert.equal(httpClient.calls[0].body.get('grant_type'), 'refresh_token');
    assert.equal(httpClient.calls[0].body.get('refresh_token'), 'refresh-token-1');
  });

  it('maps OAuth invalid refresh token responses to authorization expired', async () => {
    const secretKey = '0123456789abcdef0123456789abcdef';
    const provider = new CrmGmailOAuthTokenProvider(
      {
        clientId: 'client-id-1',
        clientSecret: 'client-secret-1',
        tokenEncryptionKey: secretKey
      },
      createHttpClient([{ status: 400, body: { error: 'invalid_grant' } }])
    );

    await assert.rejects(
      () =>
        provider.getAccessToken(
          createMailbox({
            encryptedRefreshToken: encryptGmailSecret('refresh-token-1', secretKey)
          })
        ),
      CrmGmailAuthorizationExpiredError
    );
  });

  it('rejects mailboxes without an encrypted refresh token', async () => {
    const provider = new CrmGmailOAuthTokenProvider(
      {
        clientId: 'client-id-1',
        clientSecret: 'client-secret-1',
        tokenEncryptionKey: '0123456789abcdef0123456789abcdef'
      },
      createHttpClient([])
    );

    await assert.rejects(() => provider.getAccessToken(createMailbox({ encryptedRefreshToken: null })));
  });
});

function createHttpClient(responses: Array<{ status: number; body: unknown }>) {
  const calls: Array<{ url: string; body: URLSearchParams; headers: Record<string, string> }> = [];
  const client: CrmGmailOAuthHttpClient & { calls: typeof calls } = {
    calls,
    async postForm(url, body, headers) {
      calls.push({ url, body, headers });
      const response = responses.shift();
      assert.ok(response, `Unexpected OAuth token request: ${url}`);

      return response;
    }
  };

  return client;
}

function createMailbox(
  input: Partial<CrmMailboxRecord & { encryptedRefreshToken: string | null }> = {}
): CrmMailboxRecord & { encryptedRefreshToken: string | null } {
  const mailbox: CrmMailboxRecord & { encryptedRefreshToken: string | null } = {
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
    watchExpiration: null,
    lastHistoryId: '100',
    authorizedAt: new Date('2026-06-19T08:00:00.000Z'),
    pausedAt: null,
    createdAt: new Date('2026-06-19T08:00:00.000Z'),
    updatedAt: new Date('2026-06-19T08:00:00.000Z'),
    encryptedRefreshToken: input.encryptedRefreshToken ?? 'encrypted-refresh-token',
    ...input
  };

  return mailbox;
}
