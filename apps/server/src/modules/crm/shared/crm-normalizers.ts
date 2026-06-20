import { BadRequestException } from '@nestjs/common';

const defaultMaxContentLength = 2000;

/** Trim optional text and normalize blank values to null. */
export function normalizeNullableString(value?: string | null) {
  const normalized = value?.trim();
  return normalized || null;
}

/** Normalize pagination-like integer inputs with bounded fallback semantics. */
export function normalizePositiveInteger(
  value: number | string | undefined,
  fallback: number,
  min = 1,
  max = Number.MAX_SAFE_INTEGER
) {
  if (value === undefined || value === '') {
    return fallback;
  }

  const numberValue = Number(value);
  if (!Number.isInteger(numberValue) || numberValue < min) return fallback;

  return Math.min(numberValue, max);
}

/** Normalize required content and enforce the CRM text length contract. */
export function normalizeLimitedContent(value: string, emptyMessage: string, maxLength = defaultMaxContentLength) {
  const normalized = value.trim();

  if (!normalized) {
    throw new BadRequestException(emptyMessage);
  }

  if (normalized.length > maxLength) {
    throw new BadRequestException(`内容不能超过 ${maxLength} 个字符`);
  }

  return normalized;
}
