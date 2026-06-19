import type { CrmMailboxRecord } from './crm.types';
import type { CrmGmailAccessTokenProvider } from './crm-gmail-history.gateway';

export type { CrmGmailAccessTokenProvider } from './crm-gmail-history.gateway';

export interface CrmGmailWatchRenewInput {
  mailbox: CrmMailboxRecord;
}

export interface CrmGmailWatchRenewResult {
  historyId: string;
  watchExpiration: Date;
}

export interface CrmGmailWatchGateway {
  renewWatch(input: CrmGmailWatchRenewInput): Promise<CrmGmailWatchRenewResult>;
}

export interface CrmGmailWatchGatewayConfig {
  topicName: string;
  apiBase?: string;
}

export interface CrmGmailWatchApiHttpResponse {
  status: number;
  body: unknown;
}

export interface CrmGmailWatchApiHttpClient {
  postJson(
    url: string,
    body: unknown,
    headers: Record<string, string>
  ): Promise<CrmGmailWatchApiHttpResponse>;
}

interface GmailWatchResponse {
  historyId?: unknown;
  expiration?: unknown;
}

interface GmailApiErrorResponse {
  error?: {
    errors?: Array<{
      reason?: unknown;
    }>;
  };
}

const gmailApiBase = 'https://gmail.googleapis.com';
const authorizationErrorReasons = new Set(['authError', 'forbidden', 'insufficientPermissions', 'domainPolicy']);

export class CrmGmailAuthorizationExpiredError extends Error {
  constructor(message = 'Gmail authorization expired') {
    super(message);
    this.name = 'CrmGmailAuthorizationExpiredError';
  }
}

export class FetchCrmGmailWatchApiHttpClient implements CrmGmailWatchApiHttpClient {
  async postJson(
    url: string,
    body: unknown,
    headers: Record<string, string>
  ): Promise<CrmGmailWatchApiHttpResponse> {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    return {
      status: response.status,
      body: await response.json()
    };
  }
}

export class CrmGmailApiWatchGateway implements CrmGmailWatchGateway {
  constructor(
    private readonly tokenProvider: CrmGmailAccessTokenProvider,
    private readonly config: CrmGmailWatchGatewayConfig,
    private readonly httpClient: CrmGmailWatchApiHttpClient = new FetchCrmGmailWatchApiHttpClient()
  ) {}

  /** Registers Gmail push notifications for all mailbox changes through the configured Pub/Sub topic. */
  async renewWatch(input: CrmGmailWatchRenewInput): Promise<CrmGmailWatchRenewResult> {
    const accessToken = await this.tokenProvider.getAccessToken(input.mailbox);
    const response = await this.httpClient.postJson(
      this.buildWatchUrl(),
      { topicName: this.config.topicName },
      {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    );
    const body = this.parseGmailResponse<GmailWatchResponse>(response);
    const historyId = normalizeRequiredString(body.historyId, 'Gmail watch response missing historyId');
    const expiration = normalizeExpiration(body.expiration);

    return {
      historyId,
      watchExpiration: expiration
    };
  }

  private buildWatchUrl() {
    return new URL('/gmail/v1/users/me/watch', this.config.apiBase ?? gmailApiBase).toString();
  }

  private parseGmailResponse<T>(response: CrmGmailWatchApiHttpResponse): T {
    if (response.status === 401 || isAuthorizationErrorResponse(response)) {
      throw new CrmGmailAuthorizationExpiredError();
    }

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Gmail watch request failed with status ${response.status}`);
    }

    return response.body as T;
  }
}

export class MockCrmGmailWatchGateway implements CrmGmailWatchGateway {
  /** Returns a deterministic-shaped mock watch renewal until the real Gmail API gateway is wired. */
  async renewWatch(input: CrmGmailWatchRenewInput): Promise<CrmGmailWatchRenewResult> {
    return {
      historyId: input.mailbox.lastHistoryId ?? '1',
      watchExpiration: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    };
  }
}

function normalizeRequiredString(value: unknown, errorMessage: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(errorMessage);
  }

  return value.trim();
}

function normalizeExpiration(value: unknown) {
  const rawValue = normalizeRequiredString(value, 'Gmail watch response missing expiration');
  const date = new Date(Number(rawValue));

  if (Number.isNaN(date.getTime())) {
    throw new Error('Gmail watch response expiration is invalid');
  }

  return date;
}

function isAuthorizationErrorResponse(response: CrmGmailWatchApiHttpResponse) {
  if (response.status !== 403) {
    return false;
  }

  const body = response.body as GmailApiErrorResponse;
  const reasons = body.error?.errors
    ?.map(item => item.reason)
    .filter((reason): reason is string => typeof reason === 'string');

  return reasons?.some(reason => authorizationErrorReasons.has(reason)) ?? false;
}
