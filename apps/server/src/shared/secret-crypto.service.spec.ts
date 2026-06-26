import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AppConfigService } from '../modules/app-config/app-config.service';
import { SecretCryptoService } from './secret-crypto.service';

const secretKey = '0123456789abcdef0123456789abcdef';

describe('SecretCryptoService', () => {
  it('creates encrypted storage fields and clears the legacy plaintext copy', () => {
    const service = new SecretCryptoService(createAppConfigService());

    const persisted = service.encryptForStorage('provider-key-1', {
      keyLabel: 'Provider secret encryption key',
      valueLabel: 'Provider secret'
    });

    assert.equal(persisted.secret, '');
    assert.match(persisted.encryptedSecret, /^v1:/);
    assert.equal(persisted.encryptedSecret.includes('provider-key-1'), false);
    assert.equal(
      service.resolveStoredSecret(persisted, {
        keyLabel: 'Provider secret encryption key',
        valueLabel: 'Provider secret'
      }),
      'provider-key-1'
    );
  });

  it('resolves legacy plaintext storage records while migrations are rolling out', () => {
    const service = new SecretCryptoService(createAppConfigService());

    const secret = service.resolveStoredSecret({ secret: 'legacy-key', encryptedSecret: null });

    assert.equal(secret, 'legacy-key');
  });
});

function createAppConfigService(): AppConfigService {
  return {
    config: {
      aiConfigSecretEncryptionKey: secretKey
    }
  } as AppConfigService;
}
