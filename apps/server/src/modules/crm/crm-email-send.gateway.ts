import { Injectable } from '@nestjs/common';
import { CrmGmailAuthorizationExpiredError } from './crm-gmail-watch.gateway';
import type { CrmGmailAccessTokenProvider } from './crm-gmail-history.gateway';
import type {
  CrmEmailSendGateway,
  CrmEmailSendGatewayInput,
  CrmEmailSendGatewayResult,
  CrmInboxReplySendGatewayInput
} from './crm.types';

export { CrmGmailAuthorizationExpiredError } from './crm-gmail-watch.gateway';

export interface CrmGmailEmailSendApiHttpResponse {
  status: number;
  body: unknown;
}

export interface CrmGmailEmailSendApiHttpClient {
  postJson(
    url: string,
    body: unknown,
    headers: Record<string, string>
  ): Promise<CrmGmailEmailSendApiHttpResponse>;
}

interface GmailSendResponse {
  id?: unknown;
  threadId?: unknown;
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

export class FetchCrmGmailEmailSendApiHttpClient implements CrmGmailEmailSendApiHttpClient {
  async postJson(
    url: string,
    body: unknown,
    headers: Record<string, string>
  ): Promise<CrmGmailEmailSendApiHttpResponse> {
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

export class CrmGmailApiEmailSendGateway implements CrmEmailSendGateway {
  constructor(
    private readonly tokenProvider: CrmGmailAccessTokenProvider,
    private readonly httpClient: CrmGmailEmailSendApiHttpClient = new FetchCrmGmailEmailSendApiHttpClient(),
    private readonly apiBase = gmailApiBase
  ) {}

  /** Sends the first reviewed plain-text message through Gmail messages.send. */
  async sendPlainText(input: CrmEmailSendGatewayInput): Promise<CrmEmailSendGatewayResult> {
    return this.sendMessage({
      mailbox: input.mailbox,
      toEmail: input.contact.email,
      subject: input.message.subject,
      bodyText: input.message.bodyText
    });
  }

  /** Replies from CRM into the existing Gmail thread using the thread id captured during sync. */
  async replyPlainText(input: CrmInboxReplySendGatewayInput): Promise<CrmEmailSendGatewayResult> {
    const threadId = normalizeRequiredString(input.thread.providerThreadId, 'Gmail thread id is missing');

    return this.sendMessage({
      mailbox: input.mailbox,
      toEmail: input.contact.email,
      subject: input.subject,
      bodyText: input.bodyText,
      threadId
    });
  }

  private async sendMessage(input: {
    mailbox: CrmEmailSendGatewayInput['mailbox'];
    toEmail: string;
    subject: string;
    bodyText: string;
    threadId?: string;
  }): Promise<CrmEmailSendGatewayResult> {
    const accessToken = await this.tokenProvider.getAccessToken(input.mailbox);
    const mime = buildPlainTextMime({
      fromEmail: input.mailbox.emailAddress,
      toEmail: input.toEmail,
      subject: input.subject,
      bodyText: input.bodyText
    });
    const requestBody: Record<string, string> = {
      raw: Buffer.from(mime, 'utf8').toString('base64url')
    };

    if (input.threadId) {
      requestBody.threadId = input.threadId;
    }

    const response = await this.httpClient.postJson(this.buildSendUrl(), requestBody, {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    });
    const body = this.parseGmailResponse<GmailSendResponse>(response);
    const providerMessageId = normalizeRequiredString(body.id, 'Gmail send response missing id');
    const providerThreadId = normalizeRequiredString(body.threadId, 'Gmail send response missing threadId');

    return {
      providerMessageId,
      providerThreadId
    };
  }

  private buildSendUrl() {
    return new URL('/gmail/v1/users/me/messages/send', this.apiBase).toString();
  }

  private parseGmailResponse<T>(response: CrmGmailEmailSendApiHttpResponse): T {
    if (response.status === 401 || isAuthorizationErrorResponse(response)) {
      throw new CrmGmailAuthorizationExpiredError();
    }

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Gmail send request failed with status ${response.status}`);
    }

    return response.body as T;
  }
}

@Injectable()
export class MockCrmEmailSendGateway implements CrmEmailSendGateway {
  /** Mock plain-text sending until the real Gmail API gateway is wired. */
  async sendPlainText(input: CrmEmailSendGatewayInput) {
    return {
      providerMessageId: `mock:${input.message.id}`,
      providerThreadId: `mock-thread:${input.enrollment.id}`
    };
  }

  /** Mock plain-text inbox reply until the real Gmail thread reply API is wired. */
  async replyPlainText(input: Parameters<CrmEmailSendGateway['replyPlainText']>[0]) {
    return {
      providerMessageId: `mock:reply:${input.thread.id}:${Date.now()}`,
      providerThreadId: input.thread.providerThreadId ?? `mock-thread:${input.thread.id}`
    };
  }
}

function buildPlainTextMime(input: { fromEmail: string; toEmail: string; subject: string; bodyText: string }) {
  const lines = [
    `From: ${normalizeRequiredEmail(input.fromEmail, 'From email is missing')}`,
    `To: ${normalizeRequiredEmail(input.toEmail, 'To email is missing')}`,
    `Subject: ${encodeHeaderValue(input.subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    normalizeBodyText(input.bodyText)
  ];

  return lines.join('\r\n');
}

function normalizeRequiredEmail(value: string, errorMessage: string) {
  const normalized = stripHeaderUnsafeChars(value).trim();

  if (!normalized) {
    throw new Error(errorMessage);
  }

  return normalized;
}

function encodeHeaderValue(value: string) {
  const normalized = stripHeaderUnsafeChars(value).trim();

  if (!normalized) {
    throw new Error('Email subject is missing');
  }

  if (/^[\x20-\x7E]+$/.test(normalized)) {
    return normalized;
  }

  return `=?UTF-8?B?${Buffer.from(normalized, 'utf8').toString('base64')}?=`;
}

function normalizeBodyText(value: string) {
  return value.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n/g, '\r\n');
}

function stripHeaderUnsafeChars(value: string) {
  return value.replace(/[\r\n]+/g, ' ');
}

function normalizeRequiredString(value: unknown, errorMessage: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(errorMessage);
  }

  return value.trim();
}

function isAuthorizationErrorResponse(response: CrmGmailEmailSendApiHttpResponse) {
  if (response.status !== 403) {
    return false;
  }

  const body = response.body as GmailApiErrorResponse;
  const reasons = body.error?.errors
    ?.map(item => item.reason)
    .filter((reason): reason is string => typeof reason === 'string');

  return reasons?.some(reason => authorizationErrorReasons.has(reason)) ?? false;
}
