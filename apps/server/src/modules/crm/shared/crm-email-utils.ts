import { createHash } from 'node:crypto';

const noMxErrorCodes = new Set(['ENODATA', 'ENOTFOUND']);
const publicEmailPrefixes = new Set([
  'admin',
  'contact',
  'hello',
  'info',
  'office',
  'purchasing',
  'sales',
  'service',
  'support'
]);

export interface CrmEmailDnsResolver {
  resolveMx(domain: string): Promise<unknown[]>;
}

/** Normalize a candidate email for storage and verification. */
export function normalizeEmail(value?: string | null) {
  const normalized = value?.trim().toLowerCase();
  return normalized && normalized.includes('@') ? normalized : null;
}

/** Parse a normalized email and reject domains that cannot be resolved by DNS. */
export function parseEmailAddress(email: string) {
  const normalized = email.trim().toLowerCase();
  const match = /^([^@\s]+)@([^@\s]+)$/.exec(normalized);

  if (!match || !isDnsDomain(match[2])) {
    return null;
  }

  return {
    domain: match[2]
  };
}

/** Return true when the error means the domain has no usable MX/DNS record. */
export function isNoMxDnsError(error: unknown) {
  return noMxErrorCodes.has(getErrorCode(error));
}

/** Build a stable non-reversible email fingerprint. */
export function hashEmail(email: string) {
  return createHash('sha256').update(email).digest('hex');
}

/** Mask an email address for logs and API responses. */
export function maskEmail(email: string) {
  const [local = '', domain = ''] = email.split('@');
  const prefix = local[0] || '*';
  return `${prefix}***@${domain}`;
}

/** Detect generic mailbox aliases that should stay in manual review. */
export function isPublicEmail(email: string) {
  const [local = ''] = email.split('@');
  return publicEmailPrefixes.has(local.toLowerCase());
}

function isDnsDomain(domain: string) {
  if (domain.length > 253 || domain.startsWith('.') || domain.endsWith('.')) {
    return false;
  }

  const labels = domain.split('.');

  return labels.every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label));
}

function getErrorCode(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
}
