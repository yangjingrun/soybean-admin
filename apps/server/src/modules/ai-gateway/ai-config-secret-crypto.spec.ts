import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AppConfigService } from '../app-config/app-config.service';
import { encryptAiConfigApiKey, resolveAiConfigApiKey } from './ai-config-secret-crypto';

const secretKey = '0123456789abcdef0123456789abcdef';

describe('ai-config-secret-crypto', () => {
  it('encrypts provider keys and clears the legacy plaintext value', () => {
    const persisted = encryptAiConfigApiKey('provider-key-1', createAppConfigService(secretKey));

    assert.equal(persisted.apiKey, '');
    assert.match(persisted.encryptedApiKey, /^v1:/);
    assert.equal(persisted.encryptedApiKey.includes('provider-key-1'), false);
    assert.equal(resolveAiConfigApiKey(persisted, createAppConfigService(secretKey)), 'provider-key-1');
  });

  it('keeps legacy plaintext rows readable during the migration window', () => {
    const apiKey = resolveAiConfigApiKey({ apiKey: 'legacy-provider-key', encryptedApiKey: null }, createAppConfigService());

    assert.equal(apiKey, 'legacy-provider-key');
  });

  it('requires an encryption key before saving encrypted provider keys', () => {
    assert.throws(() => encryptAiConfigApiKey('provider-key-1', createAppConfigService()), /AI_CONFIG_SECRET_ENCRYPTION_KEY/);
  });
});

function createAppConfigService(aiConfigSecretEncryptionKey?: string): AppConfigService {
  return {
    config: {
      aiConfigSecretEncryptionKey
    }
  } as AppConfigService;
}
