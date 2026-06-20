import { HttpException, HttpStatus } from '@nestjs/common';
import type { SystemLogErrorCategory } from './system-log.types';

export interface SystemLogErrorTaxonomyOptions {
  defaultCategory?: SystemLogErrorCategory;
  retryable?: boolean;
}

export interface SystemLogErrorTaxonomyMetadata {
  errorCategory: SystemLogErrorCategory;
  errorName?: string;
  errorCode?: string;
  httpStatus?: number;
  retryable?: boolean;
}

/**
 * Builds a small, queryable error taxonomy without logging stack traces or raw payloads.
 */
export function createSystemLogErrorMetadata(
  error: unknown,
  metadata: Record<string, unknown> = {},
  options: SystemLogErrorTaxonomyOptions = {}
) {
  return {
    ...metadata,
    ...classifySystemLogError(error, options)
  };
}

/**
 * Classifies thrown errors into operational categories used by business logs.
 */
export function classifySystemLogError(
  error: unknown,
  options: SystemLogErrorTaxonomyOptions = {}
): SystemLogErrorTaxonomyMetadata {
  const httpStatus = resolveHttpStatus(error);
  const errorCode = resolveErrorCode(error);
  const errorName = error instanceof Error ? error.name : undefined;
  const metadata: SystemLogErrorTaxonomyMetadata = {
    errorCategory: resolveErrorCategory(httpStatus, options.defaultCategory)
  };

  if (errorName) metadata.errorName = errorName;
  if (errorCode) metadata.errorCode = errorCode;
  if (httpStatus) metadata.httpStatus = httpStatus;
  if (options.retryable !== undefined) metadata.retryable = options.retryable;

  return metadata;
}

function resolveErrorCategory(
  httpStatus: number | undefined,
  defaultCategory: SystemLogErrorCategory | undefined
): SystemLogErrorCategory {
  if (httpStatus === HttpStatus.UNAUTHORIZED || httpStatus === HttpStatus.FORBIDDEN) {
    return 'permission';
  }

  if (httpStatus === HttpStatus.BAD_REQUEST || httpStatus === HttpStatus.UNPROCESSABLE_ENTITY) {
    return 'validation';
  }

  if (
    httpStatus === HttpStatus.NOT_FOUND ||
    httpStatus === HttpStatus.CONFLICT ||
    httpStatus === HttpStatus.GONE ||
    httpStatus === HttpStatus.PRECONDITION_FAILED
  ) {
    return 'business';
  }

  if (httpStatus && httpStatus >= 500) {
    return defaultCategory === 'external_service' ? 'external_service' : 'unexpected';
  }

  if (httpStatus === HttpStatus.REQUEST_TIMEOUT || httpStatus === HttpStatus.TOO_MANY_REQUESTS) {
    return 'external_service';
  }

  return defaultCategory ?? 'unexpected';
}

function resolveHttpStatus(error: unknown) {
  if (error instanceof HttpException) {
    return error.getStatus();
  }

  if (!error || typeof error !== 'object') {
    return undefined;
  }

  const record = error as { status?: unknown; statusCode?: unknown };
  const status = typeof record.status === 'number' ? record.status : record.statusCode;

  return typeof status === 'number' ? status : undefined;
}

function resolveErrorCode(error: unknown) {
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  const code = (error as { code?: unknown }).code;

  return typeof code === 'string' || typeof code === 'number' ? String(code) : undefined;
}
