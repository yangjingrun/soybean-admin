import type { SystemLogRecordInput } from './system-log.types';

const secretKeys = new Set([
  'apikey',
  'authorization',
  'captcha',
  'clientsecret',
  'cookie',
  'emailbody',
  'encryptedapikey',
  'encryptedrefreshtoken',
  'messagebody',
  'password',
  'passwordhash',
  'passwordsalt',
  'refreshtoken',
  'setcookie',
  'token',
  'verificationcode',
  'accesskey',
  'accesstoken',
  'apisecret',
  'bearertoken',
  'bodyhtml',
  'bodytext',
  'credential',
  'credentials',
  'csrftoken',
  'idtoken',
  'privatekey',
  'rawbody',
  'secret',
  'secretkey',
  'sessiontoken'
]);

/** Sanitizes one system log payload before it is persisted. */
export function sanitizeSystemLogInput(input: SystemLogRecordInput): SystemLogRecordInput {
  return {
    ...input,
    module: sanitizeLogText(input.module),
    action: sanitizeLogText(input.action),
    message: sanitizeLogText(input.message),
    userId: input.userId ? sanitizeLogText(input.userId) : input.userId,
    userName: input.userName ? sanitizeLogText(input.userName) : input.userName,
    errorCode: input.errorCode ? sanitizeLogText(input.errorCode) : input.errorCode,
    errorMessage: input.errorMessage ? sanitizeLogText(input.errorMessage) : input.errorMessage,
    metadata: sanitizeSystemLogMetadata(input.metadata)
  };
}

/** Removes sensitive metadata fields and normalizes text values for log safety. */
export function sanitizeSystemLogMetadata(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(item => sanitizeSystemLogMetadata(item));
  }

  if (typeof value === 'string') {
    return sanitizeLogText(value);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !secretKeys.has(normalizeMetadataKey(key)))
      .map(([key, item]) => [sanitizeLogText(key), sanitizeSystemLogMetadata(item)])
  );
}

function sanitizeLogText(value: string) {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

function normalizeMetadataKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}
