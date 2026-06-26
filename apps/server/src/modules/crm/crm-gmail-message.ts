import { BadRequestException } from '@nestjs/common';
import { classifyCustomerReplyMessage } from './crm-inbox-message-classifier';
import type { CrmGmailHistoryMessage, CrmInboxMessageType } from './crm.types';

interface GmailApiMessagePart {
  mimeType?: unknown;
  headers?: unknown;
  body?: unknown;
  parts?: unknown;
}

interface GmailApiMessageBody {
  data?: unknown;
}

interface GmailApiHeader {
  name?: unknown;
  value?: unknown;
}

interface GmailApiMessage {
  id?: unknown;
  threadId?: unknown;
  internalDate?: unknown;
  snippet?: unknown;
  labelIds?: unknown;
  payload?: unknown;
}

interface DecodedBody {
  text: string;
  source: 'plain' | 'html';
}

/** Parses a Gmail Message API response into the internal incremental-sync message shape. */
export function parseGmailApiMessage(message: unknown): CrmGmailHistoryMessage {
  const gmailMessage = parseMessageRecord(message);
  const payload = parseOptionalPart(gmailMessage.payload);
  const headers = parseHeaders(payload?.headers);
  const labelIds = parseLabelIds(gmailMessage.labelIds);
  const subject = getHeaderValue(headers, 'subject') ?? '';
  const bodyText = extractMessageBody(payload) ?? normalizeOptionalString(gmailMessage.snippet) ?? '';

  return {
    providerMessageId: normalizeRequiredString(gmailMessage.id, 'Gmail 消息缺少 id'),
    providerThreadId: normalizeOptionalString(gmailMessage.threadId),
    replyToProviderMessageId: null,
    direction: getHistoryMessageDirection(labelIds),
    subject,
    bodyText,
    receivedAt: parseInternalDate(gmailMessage.internalDate),
    messageType: classifyGmailMessage(subject, bodyText, headers, payload)
  };
}

function parseMessageRecord(message: unknown): GmailApiMessage {
  if (!isRecord(message)) {
    throw new BadRequestException('Gmail 消息格式不正确');
  }

  return message;
}

function parseOptionalPart(part: unknown): GmailApiMessagePart | null {
  if (part === undefined || part === null) return null;
  if (!isRecord(part)) {
    throw new BadRequestException('Gmail 消息 payload 格式不正确');
  }

  return part;
}

function parseHeaders(headers: unknown): GmailApiHeader[] {
  if (headers === undefined || headers === null) return [];
  if (!Array.isArray(headers)) {
    throw new BadRequestException('Gmail 消息 headers 格式不正确');
  }

  return headers.filter(isRecord);
}

function parseLabelIds(labelIds: unknown): string[] {
  if (labelIds === undefined || labelIds === null) return [];
  if (!Array.isArray(labelIds)) {
    throw new BadRequestException('Gmail 消息 labelIds 格式不正确');
  }

  return labelIds.filter((item): item is string => typeof item === 'string');
}

function getHistoryMessageDirection(labelIds: string[]) {
  return labelIds.includes('SENT') && !labelIds.includes('INBOX') ? 'outbound' : 'inbound';
}

function getHeaderValue(headers: GmailApiHeader[], name: string) {
  const targetName = name.toLowerCase();
  const header = headers.find(item => {
    return typeof item.name === 'string' && item.name.toLowerCase() === targetName && typeof item.value === 'string';
  });

  return typeof header?.value === 'string' ? header.value.trim() : null;
}

function extractMessageBody(payload: GmailApiMessagePart | null): string | null {
  if (!payload) return null;

  const body = findPreferredBody(payload);
  return body?.text.trim() || null;
}

function findPreferredBody(part: GmailApiMessagePart): DecodedBody | null {
  const directBody = decodePartBody(part);

  if (directBody?.source === 'plain') return directBody;

  const childBodies = parseChildParts(part.parts).map(findPreferredBody).filter(Boolean) as DecodedBody[];
  const plainBody = childBodies.find(body => body.source === 'plain');
  if (plainBody) return plainBody;

  return directBody ?? childBodies[0] ?? null;
}

function parseChildParts(parts: unknown): GmailApiMessagePart[] {
  if (parts === undefined || parts === null) return [];
  if (!Array.isArray(parts)) {
    throw new BadRequestException('Gmail 消息 parts 格式不正确');
  }

  return parts.map(parseOptionalPart).filter(Boolean) as GmailApiMessagePart[];
}

function decodePartBody(part: GmailApiMessagePart): DecodedBody | null {
  const mimeType = typeof part.mimeType === 'string' ? part.mimeType.toLowerCase() : '';
  const data = getBodyData(part.body);
  if (!data) return null;

  if (mimeType === 'text/plain') {
    return { text: decodeBase64Url(data), source: 'plain' };
  }

  if (mimeType === 'text/html') {
    return { text: htmlToText(decodeBase64Url(data)), source: 'html' };
  }

  return null;
}

function getBodyData(body: unknown) {
  if (body === undefined || body === null) return null;
  if (!isRecord(body)) {
    throw new BadRequestException('Gmail 消息 body 格式不正确');
  }

  const messageBody = body as GmailApiMessageBody;
  return typeof messageBody.data === 'string' ? messageBody.data : null;
}

function decodeBase64Url(data: string) {
  const value = data.trim();

  if (!/^[A-Za-z0-9_-]*={0,2}$/.test(value)) {
    throw new BadRequestException('Gmail 消息正文不是合法 base64url');
  }

  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');

  return Buffer.from(padded, 'base64').toString('utf8');
}

function htmlToText(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+\n/g, '\n')
    .replace(/\n\s+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function parseInternalDate(value: unknown): Date {
  const internalDate = normalizeRequiredString(value, 'Gmail 消息缺少 internalDate');
  const timestamp = Number(internalDate);

  if (!Number.isFinite(timestamp)) {
    throw new BadRequestException('Gmail 消息 internalDate 格式不正确');
  }

  return new Date(timestamp);
}

function classifyGmailMessage(
  subject: string,
  bodyText: string,
  headers: GmailApiHeader[],
  payload: GmailApiMessagePart | null
): CrmInboxMessageType {
  if (isDeliveryStatusMessage(headers, payload)) {
    return 'bounce';
  }

  const from = getHeaderValue(headers, 'from') ?? '';
  return classifyCustomerReplyMessage(subject, `${from}\n${bodyText}`);
}

function isDeliveryStatusMessage(headers: GmailApiHeader[], payload: GmailApiMessagePart | null) {
  const subject = getHeaderValue(headers, 'subject') ?? '';
  const from = getHeaderValue(headers, 'from') ?? '';

  return (
    /delivery status notification/i.test(subject) ||
    /mailer-daemon|postmaster/i.test(from) ||
    hasMimeType(payload, 'message/delivery-status')
  );
}

function hasMimeType(part: GmailApiMessagePart | null, mimeType: string): boolean {
  if (!part) return false;
  if (typeof part.mimeType === 'string' && part.mimeType.toLowerCase() === mimeType) return true;

  return parseChildParts(part.parts).some(child => hasMimeType(child, mimeType));
}

function normalizeRequiredString(value: unknown, message: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new BadRequestException(message);
  }

  return value.trim();
}

function normalizeOptionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
