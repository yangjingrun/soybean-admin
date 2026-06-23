import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CrmGmailOAuthFlow, CrmGmailOAuthStateError, type CrmGmailOAuthFlowHttpClient } from './crm-gmail-oauth-flow';
import { decryptGmailSecret, encryptGmailSecret } from './crm-gmail-oauth-token.provider';

describe('CrmGmailOAuthFlow', () => {
  it('builds a Gmail OAuth authorization URL with a signed state', () => {
    const flow = createFlow();

    const result = flow.createAuthorizationUrl(createContext());
    const url = new URL(result.authorizationUrl);

    assert.equal(url.origin + url.pathname, 'https://accounts.google.com/o/oauth2/v2/auth');
    assert.equal(url.searchParams.get('client_id'), 'client-id-1');
    assert.equal(url.searchParams.get('redirect_uri'), 'https://app.example.com/crm/gmail/oauth-callback');
    assert.equal(url.searchParams.get('response_type'), 'code');
    assert.equal(url.searchParams.get('access_type'), 'offline');
    assert.equal(url.searchParams.get('prompt'), 'consent');
    assert.equal(url.searchParams.get('include_granted_scopes'), 'true');
    assert.equal(
      url.searchParams.get('scope'),
      'https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.send'
    );
    assert.equal(url.searchParams.get('state'), result.state);

    const state = flow.verifyState(result.state, createContext());
    assert.equal(state.organizationId, 'org-1');
    assert.equal(state.userId, 'user-1');
  });

  it('builds a send-only Gmail OAuth authorization URL from configured scopes', () => {
    const flow = createFlow({
      scopes: ['https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/userinfo.email']
    });

    const result = flow.createAuthorizationUrl(createContext());
    const url = new URL(result.authorizationUrl);

    assert.equal(
      url.searchParams.get('scope'),
      'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email'
    );
  });

  it('rejects tampered or mismatched OAuth state values', () => {
    const flow = createFlow();
    const { state } = flow.createAuthorizationUrl(createContext());

    assert.throws(() => flow.verifyState(`${state.slice(0, -1)}x`, createContext()), CrmGmailOAuthStateError);
    assert.throws(() => flow.verifyState(state, createContext({ userId: 'user-2' })), CrmGmailOAuthStateError);
  });

  it('rejects expired OAuth state values', () => {
    const flow = createFlow({ now: () => new Date('2026-06-19T08:00:00.000Z') });
    const { state } = flow.createAuthorizationUrl(createContext());
    const verifier = createFlow({ now: () => new Date('2026-06-19T08:16:01.000Z') });

    assert.throws(() => verifier.verifyState(state, createContext()), CrmGmailOAuthStateError);
  });

  it('exchanges an OAuth code and returns encrypted refresh token plus Gmail profile', async () => {
    const httpClient = createHttpClient({
      tokenResponse: {
        status: 200,
        body: {
          access_token: 'access-token-1',
          refresh_token: 'refresh-token-1',
          expires_in: 3600,
          token_type: 'Bearer'
        }
      },
      profileResponse: {
        status: 200,
        body: {
          emailAddress: 'Alice@Gmail.COM',
          historyId: '98765'
        }
      }
    });
    const flow = createFlow({ httpClient });

    const result = await flow.exchangeCodeForMailbox('code-1');

    assert.equal(result.emailAddress, 'alice@gmail.com');
    assert.equal(result.historyId, '98765');
    assert.equal(decryptGmailSecret(result.encryptedRefreshToken, secretKey), 'refresh-token-1');
    assert.equal(httpClient.postFormCalls[0].url, 'https://oauth2.googleapis.com/token');
    assert.equal(httpClient.postFormCalls[0].body.get('grant_type'), 'authorization_code');
    assert.equal(httpClient.postFormCalls[0].body.get('code'), 'code-1');
    assert.equal(httpClient.getJsonCalls[0].url, 'https://gmail.googleapis.com/gmail/v1/users/me/profile');
    assert.equal(httpClient.getJsonCalls[0].headers.Authorization, 'Bearer access-token-1');
  });

  it('uses Google userinfo email for send-only OAuth scopes', async () => {
    const httpClient = createHttpClient({
      tokenResponse: {
        status: 200,
        body: {
          access_token: 'access-token-1',
          refresh_token: 'refresh-token-1'
        }
      },
      userinfoResponse: {
        status: 200,
        body: {
          email: 'Sender@Gmail.COM'
        }
      }
    });
    const flow = createFlow({
      httpClient,
      scopes: ['https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/userinfo.email']
    });

    const result = await flow.exchangeCodeForMailbox('code-1');

    assert.equal(result.emailAddress, 'sender@gmail.com');
    assert.equal(result.historyId, null);
    assert.equal(decryptGmailSecret(result.encryptedRefreshToken, secretKey), 'refresh-token-1');
    assert.equal(httpClient.getJsonCalls[0].url, 'https://www.googleapis.com/oauth2/v3/userinfo');
    assert.equal(httpClient.getJsonCalls[0].headers.Authorization, 'Bearer access-token-1');
  });

  it('rejects OAuth code exchange responses without a refresh token', async () => {
    const flow = createFlow({
      httpClient: createHttpClient({
        tokenResponse: {
          status: 200,
          body: {
            access_token: 'access-token-1'
          }
        }
      })
    });

    await assert.rejects(() => flow.exchangeCodeForMailbox('code-1'), /missing refresh_token/);
  });

  it('revokes an encrypted Gmail refresh token through Google OAuth revocation endpoint', async () => {
    const httpClient = createHttpClient({
      revokeResponse: {
        status: 200,
        body: null
      }
    });
    const flow = createFlow({ httpClient });

    await flow.revokeEncryptedRefreshToken(encryptGmailSecret('refresh-token-1', secretKey));

    assert.equal(httpClient.postFormCalls[0].url, 'https://oauth2.googleapis.com/revoke');
    assert.equal(httpClient.postFormCalls[0].body.get('token'), 'refresh-token-1');
    assert.equal(httpClient.postFormCalls[0].headers['Content-Type'], 'application/x-www-form-urlencoded');
  });
});

const secretKey = '0123456789abcdef0123456789abcdef';

function createFlow(input: Partial<ConstructorParameters<typeof CrmGmailOAuthFlow>[0]> = {}) {
  return new CrmGmailOAuthFlow({
    clientId: 'client-id-1',
    clientSecret: 'client-secret-1',
    redirectUri: 'https://app.example.com/crm/gmail/oauth-callback',
    tokenEncryptionKey: secretKey,
    stateSecret: 'state-secret-1',
    ...input
  });
}

function createContext(input: Partial<{ organizationId: string; userId: string }> = {}) {
  return {
    organizationId: input.organizationId ?? 'org-1',
    userId: input.userId ?? 'user-1'
  };
}

function createHttpClient(input: {
  tokenResponse?: { status: number; body: unknown };
  profileResponse?: { status: number; body: unknown };
  userinfoResponse?: { status: number; body: unknown };
  revokeResponse?: { status: number; body: unknown };
}) {
  const postFormCalls: Array<{ url: string; body: URLSearchParams; headers: Record<string, string> }> = [];
  const getJsonCalls: Array<{ url: string; headers: Record<string, string> }> = [];
  const client: CrmGmailOAuthFlowHttpClient & {
    postFormCalls: typeof postFormCalls;
    getJsonCalls: typeof getJsonCalls;
  } = {
    postFormCalls,
    getJsonCalls,
    async postForm(url, body, headers) {
      postFormCalls.push({ url, body, headers });
      if (url === 'https://oauth2.googleapis.com/revoke') {
        assert.ok(input.revokeResponse, `Unexpected OAuth revocation request: ${url}`);

        return input.revokeResponse;
      }

      assert.ok(input.tokenResponse, `Unexpected OAuth token request: ${url}`);

      return input.tokenResponse;
    },
    async getJson(url, headers) {
      getJsonCalls.push({ url, headers });
      if (url === 'https://www.googleapis.com/oauth2/v3/userinfo') {
        assert.ok(input.userinfoResponse, `Unexpected Google userinfo request: ${url}`);

        return input.userinfoResponse;
      }

      assert.ok(input.profileResponse, `Unexpected Gmail profile request: ${url}`);

      return input.profileResponse;
    }
  };

  return client;
}
