import { Injectable } from '@nestjs/common';
import { parseGmailApiMessage } from './crm-gmail-message';
import { CrmGmailAuthorizationExpiredError } from './crm-gmail-watch.gateway';
import type { CrmGmailHistoryGateway } from './crm.types';
import type { CrmMailboxRecord } from './crm.types';

export interface CrmGmailAccessTokenProvider {
  getAccessToken(mailbox: CrmMailboxRecord): Promise<string>;
}

export interface CrmGmailApiHttpResponse {
  status: number;
  body: unknown;
}

export interface CrmGmailApiHttpClient {
  getJson(url: string, headers: Record<string, string>): Promise<CrmGmailApiHttpResponse>;
}

interface GmailHistoryListResponse {
  history?: unknown;
  nextPageToken?: unknown;
  historyId?: unknown;
}

interface GmailHistoryRecord {
  messagesAdded?: unknown;
}

interface GmailMessageAddedRecord {
  message?: unknown;
}

interface GmailHistoryMessageRef {
  id?: unknown;
}

interface GmailMessageWithLabels {
  labelIds?: unknown;
}

interface GmailApiErrorResponse {
  error?: {
    errors?: Array<{
      reason?: unknown;
    }>;
  };
}

const gmailApiBase = 'https://gmail.googleapis.com';
const gmailHistoryMaxResults = '100';
const authorizationErrorReasons = new Set(['authError', 'forbidden', 'insufficientPermissions', 'domainPolicy']);

export class CrmGmailHistoryExpiredError extends Error {
  constructor(message = 'Gmail history checkpoint expired') {
    super(message);
    this.name = 'CrmGmailHistoryExpiredError';
  }
}

export class FetchCrmGmailApiHttpClient implements CrmGmailApiHttpClient {
  async getJson(url: string, headers: Record<string, string>): Promise<CrmGmailApiHttpResponse> {
    const response = await fetch(url, { headers });
    const body = await response.json();

    return {
      status: response.status,
      body
    };
  }
}

export class CrmGmailApiHistoryGateway implements CrmGmailHistoryGateway {
  constructor(
    private readonly tokenProvider: CrmGmailAccessTokenProvider,
    private readonly httpClient: CrmGmailApiHttpClient = new FetchCrmGmailApiHttpClient(),
    private readonly apiBase = gmailApiBase
  ) {}

  /** Lists Gmail History incrementally and resolves added message ids to full message payloads. */
  async listHistory(input: Parameters<CrmGmailHistoryGateway['listHistory']>[0]) {
    if (!input.startHistoryId) {
      return { nextHistoryId: input.targetHistoryId, messages: [] };
    }

    const accessToken = await this.tokenProvider.getAccessToken(input.mailbox);
    const headers = { Authorization: `Bearer ${accessToken}` };
    const messageIds = new Set<string>();
    let nextPageToken: string | null = null;
    let nextHistoryId = input.targetHistoryId;

    do {
      const response = await this.httpClient.getJson(
        this.buildHistoryUrl(input.startHistoryId, nextPageToken),
        headers
      );
      const body = this.parseGmailResponse<GmailHistoryListResponse>(response);
      nextHistoryId = normalizeOptionalString(body.historyId) ?? nextHistoryId;
      nextPageToken = normalizeOptionalString(body.nextPageToken);

      for (const messageId of collectAddedMessageIds(body.history)) {
        messageIds.add(messageId);
      }
    } while (nextPageToken);

    const messages = [];

    for (const messageId of messageIds) {
      const response = await this.httpClient.getJson(this.buildMessageUrl(messageId), headers);
      const body = this.parseGmailResponse<unknown>(response);

      if (isSentOnlyMessage(body)) {
        continue;
      }

      messages.push(parseGmailApiMessage(body));
    }

    return { nextHistoryId, messages };
  }

  private buildHistoryUrl(startHistoryId: string, pageToken: string | null) {
    const url = new URL('/gmail/v1/users/me/history', this.apiBase);
    url.searchParams.set('startHistoryId', startHistoryId);
    url.searchParams.set('historyTypes', 'messageAdded');
    url.searchParams.set('maxResults', gmailHistoryMaxResults);

    if (pageToken) {
      url.searchParams.set('pageToken', pageToken);
    }

    return url.toString();
  }

  private buildMessageUrl(messageId: string) {
    const url = new URL(`/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}`, this.apiBase);
    url.searchParams.set('format', 'full');

    return url.toString();
  }

  private parseGmailResponse<T>(response: CrmGmailApiHttpResponse): T {
    if (response.status === 401 || isAuthorizationErrorResponse(response)) {
      throw new CrmGmailAuthorizationExpiredError();
    }

    if (response.status === 404) {
      throw new CrmGmailHistoryExpiredError();
    }

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Gmail API request failed with status ${response.status}`);
    }

    return response.body as T;
  }
}

@Injectable()
export class MockCrmGmailHistoryGateway implements CrmGmailHistoryGateway {
  async listHistory(input: Parameters<CrmGmailHistoryGateway['listHistory']>[0]) {
    return { nextHistoryId: input.targetHistoryId, messages: [] };
  }
}

function collectAddedMessageIds(history: unknown): string[] {
  if (!Array.isArray(history)) return [];

  return history.flatMap(record => {
    if (!isRecord(record)) return [];
    const historyRecord = record as GmailHistoryRecord;
    if (!Array.isArray(historyRecord.messagesAdded)) return [];

    return historyRecord.messagesAdded.flatMap(item => {
      if (!isRecord(item)) return [];
      const messageAdded = item as GmailMessageAddedRecord;
      if (!isRecord(messageAdded.message)) return [];

      const message = messageAdded.message as GmailHistoryMessageRef;
      return typeof message.id === 'string' && message.id ? [message.id] : [];
    });
  });
}

function isSentOnlyMessage(message: unknown) {
  if (!isRecord(message)) return false;

  const value = (message as GmailMessageWithLabels).labelIds;
  if (!Array.isArray(value)) return false;

  const labelIds = value.filter((item): item is string => typeof item === 'string');
  return labelIds.includes('SENT') && !labelIds.includes('INBOX');
}

function normalizeOptionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function isAuthorizationErrorResponse(response: CrmGmailApiHttpResponse) {
  if (response.status !== 403) {
    return false;
  }

  const body = response.body as GmailApiErrorResponse;
  const reasons = body.error?.errors
    ?.map(item => item.reason)
    .filter((reason): reason is string => typeof reason === 'string');

  return reasons?.some(reason => authorizationErrorReasons.has(reason)) ?? false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
