import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { assertSecretEncryptionKey, decryptSecret, encryptSecret } from './secret-crypto';

describe('secret-crypto', () => {
  it('encrypts and decrypts secrets without storing plaintext', () => {
    const secretKey = '0123456789abcdef0123456789abcdef';

    const encrypted = encryptSecret('provider-api-key-1', secretKey);

    assert.notEqual(encrypted, 'provider-api-key-1');
    assert.equal(encrypted.includes('provider-api-key-1'), false);
    assert.equal(decryptSecret(encrypted, secretKey), 'provider-api-key-1');
  });

  it('rejects tampered encrypted values', () => {
    const secretKey = '0123456789abcdef0123456789abcdef';
    const encrypted = encryptSecret('provider-api-key-1', secretKey);

    assert.throws(() => decryptSecret(`${encrypted.slice(0, -2)}aa`, secretKey));
  });

  it('requires a 32-byte encryption key for AES-256', () => {
    const secretKey = '0123456789abcdef0123456789abcdef';

    assert.throws(
      () => encryptSecret('provider-api-key-1', 'short-key', { keyLabel: 'Provider secret encryption key' }),
      /Provider secret encryption key must be 32 bytes/
    );
    assert.doesNotThrow(() => assertSecretEncryptionKey(secretKey, { keyLabel: 'Provider secret encryption key' }));
  });
});
