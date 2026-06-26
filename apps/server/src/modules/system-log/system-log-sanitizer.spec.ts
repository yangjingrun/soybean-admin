import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { sanitizeSystemLogInput, sanitizeSystemLogMetadata } from './system-log-sanitizer';

describe('system-log-sanitizer', () => {
  it('removes sensitive metadata keys with common naming variants', () => {
    const sanitized = sanitizeSystemLogMetadata({
      api_key: 'sk-test',
      clientSecret: 'secret',
      Authorization: 'Bearer token',
      Cookie: 'sid=1',
      apiSecret: 'api-secret',
      csrfToken: 'csrf-token',
      emailBody: 'private email',
      bodyText: 'private body',
      privateKey: 'private-key',
      nested: {
        accessToken: 'access-token',
        sessionToken: 'session-token',
        model: 'gpt-4o-mini'
      }
    });

    assert.deepEqual(sanitized, {
      nested: {
        model: 'gpt-4o-mini'
      }
    });
  });

  it('normalizes line breaks in text fields and metadata values', () => {
    const sanitized = sanitizeSystemLogInput({
      level: 'error',
      status: 'failed',
      module: 'ai\r\ngateway',
      action: 'generate\ntext',
      message: 'failed\r\nmessage',
      errorMessage: 'upstream\nfailed',
      metadata: {
        requestId: 'req\n1',
        nested: [{ reason: 'bad\r\ninput' }]
      }
    });

    assert.equal(sanitized.module, 'ai gateway');
    assert.equal(sanitized.action, 'generate text');
    assert.equal(sanitized.message, 'failed message');
    assert.equal(sanitized.errorMessage, 'upstream failed');
    assert.deepEqual(sanitized.metadata, {
      requestId: 'req 1',
      nested: [{ reason: 'bad input' }]
    });
  });
});
