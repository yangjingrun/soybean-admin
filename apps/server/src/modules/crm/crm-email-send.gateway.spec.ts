import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CrmGmailApiEmailSendGateway,
  CrmGmailAuthorizationExpiredError,
  type CrmGmailEmailSendApiHttpClient
} from './crm-email-send.gateway';
import type { CrmGmailAccessTokenProvider } from './crm-gmail-history.gateway';
import type {
  CrmAccountRecord,
  CrmContactRecord,
  CrmInboxThreadRecord,
  CrmMailboxRecord,
  CrmMessageRecord,
  CrmSequenceEnrollmentRecord
} from './crm.types';

describe('CrmGmailApiEmailSendGateway', () => {
  it('sends first plain-text message through Gmail messages.send', async () => {
    const httpClient = new FakeEmailSendHttpClient({
      status: 200,
      body: { id: 'gmail-message-1', threadId: 'gmail-thread-1' }
    });
    const gateway = createGateway(httpClient);

    const result = await gateway.sendPlainText({
      enrollment: createEnrollment(),
      message: createMessage({
        subject: 'Hello product',
        bodyText: 'Hi Ali,\n\nCan I send you our bearing catalog?'
      }),
      account: createAccount(),
      contact: createContact({ email: 'buyer@example.com' }),
      mailbox: createMailbox({ emailAddress: 'sales@gmail.com' })
    });

    assert.equal(result.providerMessageId, 'gmail-message-1');
    assert.equal(result.providerThreadId, 'gmail-thread-1');
    assert.equal(httpClient.calls.length, 1);
    assert.equal(httpClient.calls[0]?.url, 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send');
    assert.equal(httpClient.calls[0]?.headers.Authorization, 'Bearer access-token-1');
    assert.equal(httpClient.calls[0]?.headers['Content-Type'], 'application/json');
    assert.ok(isRecord(httpClient.calls[0]?.body));

    const requestBody = httpClient.calls[0]?.body as { raw?: unknown };
    const mime = decodeBase64Url(String(requestBody.raw));
    assert.match(mime, /^From: sales@gmail\.com\r\nTo: buyer@example\.com\r\nSubject: Hello product\r\n/m);
    assert.match(mime, /Content-Type: text\/plain; charset="UTF-8"\r\n/);
    assert.match(mime, /\r\n\r\nHi Ali,\r\n\r\nCan I send you our bearing catalog\?$/);
  });

  it('sends system reply in the existing Gmail thread', async () => {
    const httpClient = new FakeEmailSendHttpClient({
      status: 200,
      body: { id: 'gmail-reply-1', threadId: 'gmail-thread-1' }
    });
    const gateway = createGateway(httpClient);

    const result = await gateway.replyPlainText({
      thread: createInboxThread({ providerThreadId: 'gmail-thread-1' }),
      account: createAccount(),
      contact: createContact({ email: 'buyer@example.com' }),
      mailbox: createMailbox({ emailAddress: 'sales@gmail.com' }),
      subject: 'Re: Hello product',
      bodyText: 'Hi Ali,\n\nThanks for your reply.'
    });

    assert.equal(result.providerMessageId, 'gmail-reply-1');
    assert.equal(result.providerThreadId, 'gmail-thread-1');
    assert.ok(isRecord(httpClient.calls[0]?.body));

    const requestBody = httpClient.calls[0]?.body as { raw?: unknown; threadId?: unknown };
    assert.equal(requestBody.threadId, 'gmail-thread-1');
    const mime = decodeBase64Url(String(requestBody.raw));
    assert.match(mime, /^From: sales@gmail\.com\r\nTo: buyer@example\.com\r\nSubject: Re: Hello product\r\n/m);
  });

  it('encodes non-ascii subjects as RFC 2047 headers', async () => {
    const httpClient = new FakeEmailSendHttpClient({
      status: 200,
      body: { id: 'gmail-message-1', threadId: 'gmail-thread-1' }
    });
    const gateway = createGateway(httpClient);

    await gateway.sendPlainText({
      enrollment: createEnrollment(),
      message: createMessage({ subject: '轴承报价' }),
      account: createAccount(),
      contact: createContact(),
      mailbox: createMailbox()
    });

    const requestBody = httpClient.calls[0]?.body as { raw?: unknown };
    const mime = decodeBase64Url(String(requestBody.raw));
    assert.match(mime, /^Subject: =\?UTF-8\?B\?.+\?=\r\n/m);
  });

  it('throws authorization expired only for auth-like Gmail failures', async () => {
    const gateway = createGateway(
      new FakeEmailSendHttpClient({
        status: 403,
        body: { error: { errors: [{ reason: 'authError' }] } }
      })
    );

    await assert.rejects(
      () =>
        gateway.sendPlainText({
          enrollment: createEnrollment(),
          message: createMessage(),
          account: createAccount(),
          contact: createContact(),
          mailbox: createMailbox()
        }),
      CrmGmailAuthorizationExpiredError
    );
  });

  it('does not treat Gmail rate limit 403 as authorization expired', async () => {
    const gateway = createGateway(
      new FakeEmailSendHttpClient({
        status: 403,
        body: { error: { errors: [{ reason: 'rateLimitExceeded' }] } }
      })
    );

    await assert.rejects(
      () =>
        gateway.sendPlainText({
          enrollment: createEnrollment(),
          message: createMessage(),
          account: createAccount(),
          contact: createContact(),
          mailbox: createMailbox()
        }),
      /Gmail send request failed with status 403/
    );
  });

  it('rejects malformed Gmail send responses', async () => {
    const gateway = createGateway(new FakeEmailSendHttpClient({ status: 200, body: { threadId: 'thread-1' } }));

    await assert.rejects(
      () =>
        gateway.sendPlainText({
          enrollment: createEnrollment(),
          message: createMessage(),
          account: createAccount(),
          contact: createContact(),
          mailbox: createMailbox()
        }),
      /missing id/
    );
  });
});

class FakeEmailSendHttpClient implements CrmGmailEmailSendApiHttpClient {
  readonly calls: Array<{ url: string; body: unknown; headers: Record<string, string> }> = [];

  constructor(private readonly response: { status: number; body: unknown }) {}

  async postJson(url: string, body: unknown, headers: Record<string, string>) {
    this.calls.push({ url, body, headers });
    return this.response;
  }
}

function createGateway(httpClient: CrmGmailEmailSendApiHttpClient) {
  const tokenProvider: CrmGmailAccessTokenProvider = {
    async getAccessToken() {
      return 'access-token-1';
    }
  };

  return new CrmGmailApiEmailSendGateway(tokenProvider, httpClient);
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function createAccount(input: Partial<CrmAccountRecord> = {}): CrmAccountRecord {
  return {
    id: input.id || 'account-1',
    organizationId: input.organizationId || 'org-1',
    ownerUserId: input.ownerUserId || 'user-1',
    name: input.name || 'ABC Trading',
    normalizedName: input.normalizedName || 'abc trading',
    websiteUrl: input.websiteUrl ?? 'https://abc.example.com',
    domain: input.domain ?? 'abc.example.com',
    country: input.country ?? 'AE',
    city: input.city ?? null,
    address: input.address ?? null,
    timeZone: input.timeZone ?? null,
    customerType: input.customerType ?? 'distributor',
    status: input.status || 'sequence_running',
    sourceTaskId: input.sourceTaskId ?? null,
    archivedAt: input.archivedAt ?? null,
    archiveReason: input.archiveReason ?? null,
    archiveSlimmedAt: input.archiveSlimmedAt ?? null,
    createdAt: input.createdAt || new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: input.updatedAt || new Date('2026-06-18T09:00:00.000Z')
  };
}

function createContact(input: Partial<CrmContactRecord> = {}): CrmContactRecord {
  return {
    id: input.id || 'contact-1',
    organizationId: input.organizationId || 'org-1',
    accountId: input.accountId || 'account-1',
    ownerUserId: input.ownerUserId || 'user-1',
    fullName: input.fullName ?? 'Ali Hassan',
    title: input.title ?? 'Purchasing Manager',
    email: input.email || 'buyer@example.com',
    emailHash: input.emailHash || 'contact-hash',
    maskedEmail: input.maskedEmail || 'b***@example.com',
    isPublicEmail: input.isPublicEmail ?? false,
    emailStatus: input.emailStatus || 'valid',
    sourceTaskId: input.sourceTaskId ?? null,
    createdAt: input.createdAt || new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: input.updatedAt || new Date('2026-06-18T09:00:00.000Z')
  };
}

function createMailbox(input: Partial<CrmMailboxRecord> = {}): CrmMailboxRecord {
  return {
    id: input.id || 'mailbox-1',
    organizationId: input.organizationId || 'org-1',
    ownerUserId: input.ownerUserId || 'user-1',
    ownerUserName: input.ownerUserName ?? 'Alice',
    provider: 'gmail',
    emailAddress: input.emailAddress || 'sales@gmail.com',
    emailHash: input.emailHash || 'mailbox-hash',
    maskedEmail: input.maskedEmail || 's***@gmail.com',
    status: input.status || 'active',
    dailyLimit: input.dailyLimit ?? 50,
    hourlyLimit: input.hourlyLimit ?? 10,
    warmupStage: input.warmupStage || 'new',
    encryptedRefreshToken: input.encryptedRefreshToken ?? 'encrypted-refresh-token',
    watchExpiration: input.watchExpiration ?? null,
    lastHistoryId: input.lastHistoryId ?? null,
    authorizedAt: input.authorizedAt || new Date('2026-06-18T09:00:00.000Z'),
    pausedAt: input.pausedAt ?? null,
    createdAt: input.createdAt || new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: input.updatedAt || new Date('2026-06-18T09:00:00.000Z')
  };
}

function createEnrollment(input: Partial<CrmSequenceEnrollmentRecord> = {}): CrmSequenceEnrollmentRecord {
  return {
    id: input.id || 'enrollment-1',
    organizationId: input.organizationId || 'org-1',
    ownerUserId: input.ownerUserId || 'user-1',
    accountId: input.accountId || 'account-1',
    contactId: input.contactId || 'contact-1',
    productLineId: input.productLineId ?? null,
    mailboxId: input.mailboxId ?? 'mailbox-1',
    policyId: input.policyId ?? null,
    name: input.name || 'ABC Trading - Ali Hassan',
    status: input.status || 'sequence_running',
    currentStep: input.currentStep ?? 1,
    totalSteps: input.totalSteps ?? 5,
    runVersion: input.runVersion ?? 1,
    createdById: input.createdById || 'user-1',
    createdByName: input.createdByName ?? 'Alice',
    createdAt: input.createdAt || new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: input.updatedAt || new Date('2026-06-18T09:00:00.000Z')
  };
}

function createMessage(input: Partial<CrmMessageRecord> = {}): CrmMessageRecord {
  return {
    id: input.id || 'message-1',
    organizationId: input.organizationId || 'org-1',
    ownerUserId: input.ownerUserId || 'user-1',
    accountId: input.accountId || 'account-1',
    contactId: input.contactId || 'contact-1',
    enrollmentId: input.enrollmentId || 'enrollment-1',
    mailboxId: input.mailboxId ?? 'mailbox-1',
    stepIndex: input.stepIndex ?? 1,
    threadMode: input.threadMode || 'new_subject',
    subject: input.subject || 'Hello product',
    bodyText: input.bodyText || 'Hi Ali,\n\nCan I send you our bearing catalog?',
    status: input.status || 'queued',
    scheduledAt: input.scheduledAt ?? new Date('2026-06-18T10:00:00.000Z'),
    sentAt: input.sentAt ?? null,
    bullJobId: input.bullJobId ?? 'send-job-1',
    providerMessageId: input.providerMessageId ?? null,
    providerThreadId: input.providerThreadId ?? null,
    recipientTimeZone: input.recipientTimeZone ?? null,
    createdAt: input.createdAt || new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: input.updatedAt || new Date('2026-06-18T09:00:00.000Z')
  };
}

function createInboxThread(input: Partial<CrmInboxThreadRecord> = {}): CrmInboxThreadRecord {
  return {
    id: input.id || 'thread-1',
    organizationId: input.organizationId || 'org-1',
    ownerUserId: input.ownerUserId || 'user-1',
    accountId: input.accountId || 'account-1',
    contactId: input.contactId || 'contact-1',
    enrollmentId: input.enrollmentId ?? 'enrollment-1',
    mailboxId: input.mailboxId ?? 'mailbox-1',
    provider: 'gmail',
    providerThreadId: input.providerThreadId ?? 'gmail-thread-1',
    subject: input.subject || 'Hello product',
    status: input.status || 'pending',
    lastInboundAt: input.lastInboundAt || new Date('2026-06-18T11:00:00.000Z'),
    unreadCount: input.unreadCount ?? 1,
    messageCount: input.messageCount ?? 1,
    createdAt: input.createdAt || new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: input.updatedAt || new Date('2026-06-18T11:00:00.000Z')
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
