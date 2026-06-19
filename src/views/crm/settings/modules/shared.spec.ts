import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createDefaultGlobalConfigForm, isValidEmailVerificationCooldownDays } from './shared';

describe('crm settings shared helpers', () => {
  it('creates the platform global config form with the documented cooldown default', () => {
    assert.deepEqual(createDefaultGlobalConfigForm(), {
      emailVerificationCooldownDays: 30
    });
  });

  it('accepts only integer email verification cooldown days in the supported range', () => {
    assert.equal(isValidEmailVerificationCooldownDays(1), true);
    assert.equal(isValidEmailVerificationCooldownDays(365), true);
    assert.equal(isValidEmailVerificationCooldownDays(0), false);
    assert.equal(isValidEmailVerificationCooldownDays(366), false);
    assert.equal(isValidEmailVerificationCooldownDays(30.5), false);
    assert.equal(isValidEmailVerificationCooldownDays(null), false);
  });
});
