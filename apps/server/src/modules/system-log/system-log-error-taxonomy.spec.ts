import assert from 'node:assert/strict';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, it } from 'node:test';
import { classifySystemLogError, createSystemLogErrorMetadata } from './system-log-error-taxonomy';

describe('system-log-error-taxonomy', () => {
  it('classifies validation, permission, and business HttpExceptions', () => {
    assert.equal(classifySystemLogError(new BadRequestException()).errorCategory, 'validation');
    assert.equal(classifySystemLogError(new ForbiddenException()).errorCategory, 'permission');
    assert.equal(classifySystemLogError(new NotFoundException()).errorCategory, 'business');
  });

  it('uses external service category for upstream style errors', () => {
    const error = Object.assign(new Error('rate limited'), { status: 429, code: 'rateLimitExceeded' });

    assert.deepEqual(classifySystemLogError(error), {
      errorCategory: 'external_service',
      errorName: 'Error',
      errorCode: 'rateLimitExceeded',
      httpStatus: 429
    });
  });

  it('merges safe context with taxonomy fields without stack traces', () => {
    const metadata = createSystemLogErrorMetadata(
      new Error('upstream failed'),
      { requestId: 'req-1', stage: 'failed' },
      { defaultCategory: 'external_service', retryable: true }
    );

    assert.deepEqual(metadata, {
      requestId: 'req-1',
      stage: 'failed',
      errorCategory: 'external_service',
      errorName: 'Error',
      retryable: true
    });
    assert.equal('stack' in metadata, false);
  });
});
