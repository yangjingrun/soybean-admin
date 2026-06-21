import { ServiceUnavailableException } from '@nestjs/common';
import { assertSecretEncryptionKey, decryptSecret, encryptSecret } from '../../shared/secret-crypto';
import { CrmGmailAuthorizationExpiredError } from './crm-gmail-watch.gateway';
import type { CrmGmailAccessTokenProvider } from './crm-gmail-history.gateway';
import type { CrmMailboxRecord } from './crm.types';

export interface CrmGmailOAuthTokenProviderConfig {
  clientId: string;
  clientSecret: string;
  tokenEncryptionKey: string;
  tokenEndpoint?: string;
}

export interface CrmGmailOAuthHttpResponse {
  status: number;
  body: unknown;
}

export interface CrmGmailOAuthHttpClient {
  postForm(
    url: string,
    body: URLSearchParams,
    headers: Record<string, string>
  ): Promise<CrmGmailOAuthHttpResponse>;
}

interface GmailOAuthTokenResponse {
  access_token?: unknown;
}

interface GmailOAuthErrorResponse {
  error?: unknown;
}

const gmailSecretCryptoOptions = {
  keyLabel: 'Gmail token encryption key',
  valueLabel: 'Encrypted Gmail secret'
};
const oauthTokenEndpoint = 'https://oauth2.googleapis.com/token';

export class FetchCrmGmailOAuthHttpClient implements CrmGmailOAuthHttpClient {
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
    const responseBody = await response.json();

    return {
      status: response.status,
      body: responseBody
    };
  }
}

export class CrmGmailOAuthTokenProvider implements CrmGmailAccessTokenProvider {
  constructor(
    private readonly config: CrmGmailOAuthTokenProviderConfig,
    private readonly httpClient: CrmGmailOAuthHttpClient = new FetchCrmGmailOAuthHttpClient()
  ) {}

  /** Exchanges the mailbox refresh token for a short-lived Gmail access token. */
  async getAccessToken(mailbox: CrmMailboxRecord): Promise<string> {
    if (!mailbox.encryptedRefreshToken) {
      throw new Error('Gmail mailbox refresh token is missing');
    }

    const refreshToken = decryptGmailSecret(mailbox.encryptedRefreshToken, this.config.tokenEncryptionKey);
    const body = new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    });
    const response = await this.httpClient.postForm(this.config.tokenEndpoint ?? oauthTokenEndpoint, body, {
      'Content-Type': 'application/x-www-form-urlencoded'
    });

    if (isAuthorizationExpiredResponse(response)) {
      throw new CrmGmailAuthorizationExpiredError();
    }

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Gmail OAuth token request failed with status ${response.status}`);
    }

    const tokenResponse = response.body as GmailOAuthTokenResponse;

    if (typeof tokenResponse.access_token !== 'string' || !tokenResponse.access_token) {
      throw new Error('Gmail OAuth token response missing access_token');
    }

    return tokenResponse.access_token;
  }
}

/** Encrypts a provider secret before persistence. */
export function encryptGmailSecret(plainText: string, secretKey: string): string {
  return encryptSecret(plainText, requireGmailSecretEncryptionKey(secretKey), gmailSecretCryptoOptions);
}

/** Decrypts a provider secret stored by encryptGmailSecret. */
export function decryptGmailSecret(encryptedValue: string, secretKey: string): string {
  return decryptSecret(encryptedValue, requireGmailSecretEncryptionKey(secretKey), gmailSecretCryptoOptions);
}

function requireGmailSecretEncryptionKey(secretKey: string) {
  try {
    assertSecretEncryptionKey(secretKey, gmailSecretCryptoOptions);
  } catch {
    throw new ServiceUnavailableException(
      'Gmail token 加密密钥必须为 32 字节，请检查 CRM_GMAIL_TOKEN_ENCRYPTION_KEY'
    );
  }

  return secretKey;
}

function isAuthorizationExpiredResponse(response: CrmGmailOAuthHttpResponse) {
  if (response.status !== 400 && response.status !== 401 && response.status !== 403) {
    return false;
  }

  const body = response.body as GmailOAuthErrorResponse;
  return body.error === 'invalid_grant' || body.error === 'invalid_client' || response.status === 401;
}
