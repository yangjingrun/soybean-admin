import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { encryptGmailSecret, type CrmGmailOAuthHttpResponse } from './crm-gmail-oauth-token.provider';

export interface CrmGmailOAuthFlowConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  tokenEncryptionKey: string;
  stateSecret: string;
  authorizationEndpoint?: string;
  tokenEndpoint?: string;
  profileEndpoint?: string;
  userinfoEndpoint?: string;
  scopes?: string[];
  now?: () => Date;
  httpClient?: CrmGmailOAuthFlowHttpClient;
}

export interface CrmGmailOAuthFlowContext {
  organizationId: string;
  userId: string;
}

export interface CrmGmailOAuthStatePayload extends CrmGmailOAuthFlowContext {
  issuedAt: string;
  nonce: string;
}

export interface CrmGmailOAuthFlowHttpClient {
  postForm(
    url: string,
    body: URLSearchParams,
    headers: Record<string, string>
  ): Promise<CrmGmailOAuthHttpResponse>;
  getJson(url: string, headers: Record<string, string>): Promise<CrmGmailOAuthHttpResponse>;
}

export interface CrmGmailOAuthFlowPort {
  createAuthorizationUrl(context: CrmGmailOAuthFlowContext): { authorizationUrl: string; state: string };
  verifyState(state: string, context: CrmGmailOAuthFlowContext): CrmGmailOAuthStatePayload;
  exchangeCodeForMailbox(code: string): Promise<{
    emailAddress: string;
    historyId: string | null;
    encryptedRefreshToken: string;
  }>;
}

interface GmailOAuthCodeTokenResponse {
  access_token?: unknown;
  refresh_token?: unknown;
}

interface GmailProfileResponse {
  emailAddress?: unknown;
  historyId?: unknown;
}

interface GoogleUserinfoResponse {
  email?: unknown;
}

const authorizationEndpoint = 'https://accounts.google.com/o/oauth2/v2/auth';
const tokenEndpoint = 'https://oauth2.googleapis.com/token';
const profileEndpoint = 'https://gmail.googleapis.com/gmail/v1/users/me/profile';
const userinfoEndpoint = 'https://www.googleapis.com/oauth2/v3/userinfo';
const stateMaxAgeMs = 15 * 60 * 1000;
const defaultGmailScopes = ['https://www.googleapis.com/auth/gmail.modify', 'https://www.googleapis.com/auth/gmail.send'];
const gmailProfileScopes = new Set([
  'https://mail.google.com/',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.metadata'
]);

export class CrmGmailOAuthStateError extends Error {
  constructor(message = 'Gmail OAuth state is invalid') {
    super(message);
  }
}

export class FetchCrmGmailOAuthFlowHttpClient implements CrmGmailOAuthFlowHttpClient {
  async postForm(
    url: string,
    body: URLSearchParams,
    headers: Record<string, string>
  ): Promise<CrmGmailOAuthHttpResponse> {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body
    });

    return {
      status: response.status,
      body: await response.json()
    };
  }

  async getJson(url: string, headers: Record<string, string>): Promise<CrmGmailOAuthHttpResponse> {
    const response = await fetch(url, { headers });

    return {
      status: response.status,
      body: await response.json()
    };
  }
}

export class CrmGmailOAuthFlow implements CrmGmailOAuthFlowPort {
  private readonly httpClient: CrmGmailOAuthFlowHttpClient;

  constructor(private readonly config: CrmGmailOAuthFlowConfig) {
    this.httpClient = config.httpClient ?? new FetchCrmGmailOAuthFlowHttpClient();
  }

  /** Creates the Google consent screen URL and a signed state bound to the current user. */
  createAuthorizationUrl(context: CrmGmailOAuthFlowContext) {
    const state = this.signState({
      organizationId: context.organizationId,
      userId: context.userId,
      issuedAt: this.now().toISOString(),
      nonce: randomBytes(16).toString('base64url')
    });
    const url = new URL(this.config.authorizationEndpoint ?? authorizationEndpoint);
    url.searchParams.set('client_id', this.config.clientId);
    url.searchParams.set('redirect_uri', this.config.redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', this.getScopes().join(' '));
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');
    url.searchParams.set('include_granted_scopes', 'true');
    url.searchParams.set('state', state);

    return {
      authorizationUrl: url.toString(),
      state
    };
  }

  /** Verifies state integrity, freshness, and ownership before accepting an OAuth callback. */
  verifyState(state: string, context: CrmGmailOAuthFlowContext): CrmGmailOAuthStatePayload {
    const payload = this.parseState(state);
    const issuedAt = new Date(payload.issuedAt);

    if (Number.isNaN(issuedAt.getTime()) || this.now().getTime() - issuedAt.getTime() > stateMaxAgeMs) {
      throw new CrmGmailOAuthStateError('Gmail OAuth state is expired');
    }

    if (payload.organizationId !== context.organizationId || payload.userId !== context.userId) {
      throw new CrmGmailOAuthStateError();
    }

    return payload;
  }

  /** Exchanges the authorization code, encrypts the refresh token, then reads the Gmail profile. */
  async exchangeCodeForMailbox(code: string) {
    const tokenResponse = await this.exchangeCode(code);
    const profile = await this.getMailboxProfile(tokenResponse.accessToken);

    return {
      emailAddress: profile.emailAddress.toLowerCase(),
      historyId: profile.historyId,
      encryptedRefreshToken: encryptGmailSecret(tokenResponse.refreshToken, this.config.tokenEncryptionKey)
    };
  }

  private async exchangeCode(code: string) {
    const body = new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: this.config.redirectUri
    });
    const response = await this.httpClient.postForm(this.config.tokenEndpoint ?? tokenEndpoint, body, {
      'Content-Type': 'application/x-www-form-urlencoded'
    });

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Gmail OAuth code exchange failed with status ${response.status}`);
    }

    const token = response.body as GmailOAuthCodeTokenResponse;

    if (typeof token.access_token !== 'string' || !token.access_token) {
      throw new Error('Gmail OAuth code response missing access_token');
    }

    if (typeof token.refresh_token !== 'string' || !token.refresh_token) {
      throw new Error('Gmail OAuth code response missing refresh_token');
    }

    return {
      accessToken: token.access_token,
      refreshToken: token.refresh_token
    };
  }

  private async getProfile(accessToken: string) {
    const response = await this.httpClient.getJson(this.config.profileEndpoint ?? profileEndpoint, {
      Authorization: `Bearer ${accessToken}`
    });

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Gmail profile request failed with status ${response.status}`);
    }

    const profile = response.body as GmailProfileResponse;

    if (typeof profile.emailAddress !== 'string' || !profile.emailAddress) {
      throw new Error('Gmail profile response missing emailAddress');
    }

    return {
      emailAddress: profile.emailAddress,
      historyId: typeof profile.historyId === 'string' && profile.historyId ? profile.historyId : null
    };
  }

  private async getUserinfoProfile(accessToken: string) {
    const response = await this.httpClient.getJson(this.config.userinfoEndpoint ?? userinfoEndpoint, {
      Authorization: `Bearer ${accessToken}`
    });

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Google userinfo request failed with status ${response.status}`);
    }

    const profile = response.body as GoogleUserinfoResponse;

    if (typeof profile.email !== 'string' || !profile.email) {
      throw new Error('Google userinfo response missing email');
    }

    return {
      emailAddress: profile.email,
      historyId: null
    };
  }

  private async getMailboxProfile(accessToken: string) {
    if (this.canReadGmailProfile()) {
      return this.getProfile(accessToken);
    }

    return this.getUserinfoProfile(accessToken);
  }

  private signState(payload: CrmGmailOAuthStatePayload) {
    const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    const signature = this.createStateSignature(encodedPayload);

    return `${encodedPayload}.${signature}`;
  }

  private parseState(state: string): CrmGmailOAuthStatePayload {
    const [encodedPayload, signature] = state.split('.');

    if (!encodedPayload || !signature || !this.isValidSignature(encodedPayload, signature)) {
      throw new CrmGmailOAuthStateError();
    }

    try {
      const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as CrmGmailOAuthStatePayload;

      if (!payload.organizationId || !payload.userId || !payload.issuedAt || !payload.nonce) {
        throw new CrmGmailOAuthStateError();
      }

      return payload;
    } catch (error) {
      if (error instanceof CrmGmailOAuthStateError) throw error;
      throw new CrmGmailOAuthStateError();
    }
  }

  private isValidSignature(encodedPayload: string, signature: string) {
    const expected = this.createStateSignature(encodedPayload);
    const expectedBuffer = Buffer.from(expected, 'base64url');
    const actualBuffer = Buffer.from(signature, 'base64url');

    return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
  }

  private createStateSignature(encodedPayload: string) {
    return createHmac('sha256', this.config.stateSecret).update(encodedPayload).digest('base64url');
  }

  private now() {
    return this.config.now?.() ?? new Date();
  }

  private getScopes() {
    return this.config.scopes?.length ? this.config.scopes : defaultGmailScopes;
  }

  private canReadGmailProfile() {
    return this.getScopes().some(scope => gmailProfileScopes.has(scope));
  }
}
