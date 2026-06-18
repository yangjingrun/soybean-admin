import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { generateTemporaryPassword, hashPassword, verifyPassword } from './password';

describe('auth password helpers', () => {
  it('hashes and verifies passwords with a random salt', async () => {
    const first = await hashPassword('123456');
    const second = await hashPassword('123456');

    assert.notEqual(first.salt, second.salt);
    assert.notEqual(first.hash, second.hash);
    assert.equal(await verifyPassword('123456', first.salt, first.hash), true);
    assert.equal(await verifyPassword('bad-password', first.salt, first.hash), false);
  });

  it('generates a readable temporary password', () => {
    const password = generateTemporaryPassword();

    assert.equal(password.length, 14);
    assert.match(password, /^[A-HJ-NP-Za-km-z2-9]+$/);
  });
});
