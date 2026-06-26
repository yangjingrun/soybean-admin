import { createHash } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';

export interface ParsedGmailPubSubPushPayload {
  emailAddress: string;
  emailHash: string;
  historyId: string;
  pubsubMessageId: string | null;
  publishTime: Date | null;
}

interface PubSubPushEnvelope {
  message: {
    data: string;
    messageId?: unknown;
    publishTime?: unknown;
    attributes?: unknown;
  };
  subscription?: unknown;
}

interface GmailWatchNotification {
  emailAddress?: unknown;
  historyId?: unknown;
}

const GMAIL_DOMAINS = new Set(['gmail.com', 'googlemail.com']);

/**
 * Parses a Google Pub/Sub push envelope carrying a Gmail watch notification.
 */
export function parseGmailPubSubPushPayload(payload: unknown): ParsedGmailPubSubPushPayload {
  const envelope = parseEnvelope(payload);
  const notification = parseNotification(envelope.message.data);
  const emailAddress = normalizeGmailAddress(notification.emailAddress);
  const historyId = normalizeHistoryId(notification.historyId);

  return {
    emailAddress,
    emailHash: hashEmail(emailAddress),
    historyId,
    pubsubMessageId: normalizeOptionalString(envelope.message.messageId),
    publishTime: normalizePublishTime(envelope.message.publishTime)
  };
}

function parseEnvelope(payload: unknown): PubSubPushEnvelope {
  if (!isRecord(payload) || !isRecord(payload.message) || typeof payload.message.data !== 'string') {
    throw new BadRequestException('Gmail Pub/Sub 推送格式不正确');
  }

  return {
    message: {
      data: payload.message.data,
      messageId: payload.message.messageId,
      publishTime: payload.message.publishTime,
      attributes: payload.message.attributes
    },
    subscription: payload.subscription
  };
}

function parseNotification(data: string): GmailWatchNotification {
  const rawJson = decodeBase64(data);

  try {
    const notification = JSON.parse(rawJson) as unknown;

    if (!isRecord(notification)) {
      throw new BadRequestException('Gmail Pub/Sub 数据格式不正确');
    }

    return notification;
  } catch (error) {
    if (error instanceof BadRequestException) {
      throw error;
    }

    throw new BadRequestException('Gmail Pub/Sub 数据不是合法 JSON');
  }
}

function decodeBase64(data: string): string {
  if (!isStrictBase64(data)) {
    throw new BadRequestException('Gmail Pub/Sub 数据不是合法 base64');
  }

  return Buffer.from(data, 'base64').toString('utf8');
}

function normalizeGmailAddress(value: unknown): string {
  if (typeof value !== 'string') {
    throw new BadRequestException('Gmail 通知缺少 emailAddress');
  }

  const emailAddress = value.trim().toLowerCase();
  const parts = emailAddress.split('@');

  // 第一版只接受 Gmail 主域名，不处理 alias/send-as 地址。
  if (parts.length !== 2 || !parts[0] || !GMAIL_DOMAINS.has(parts[1])) {
    throw new BadRequestException('Gmail 通知 emailAddress 不是支持的 Gmail 地址');
  }

  return emailAddress;
}

function normalizeHistoryId(value: unknown): string {
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'bigint') {
    throw new BadRequestException('Gmail 通知缺少 historyId');
  }

  const historyId = String(value).trim();

  if (!historyId) {
    throw new BadRequestException('Gmail 通知缺少 historyId');
  }

  return historyId;
}

function normalizeOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}

function normalizePublishTime(value: unknown): Date | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  if (typeof value !== 'string') {
    throw new BadRequestException('Gmail Pub/Sub publishTime 格式不正确');
  }

  const publishTime = new Date(value);

  if (Number.isNaN(publishTime.getTime())) {
    throw new BadRequestException('Gmail Pub/Sub publishTime 格式不正确');
  }

  return publishTime;
}

function hashEmail(emailAddress: string): string {
  return createHash('sha256').update(emailAddress).digest('hex');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStrictBase64(value: string): boolean {
  const normalized = value.trim();

  return normalized.length > 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(normalized) && normalized.length % 4 === 0;
}
