import { SecretCryptoService } from '../../shared/secret-crypto.service';

const aiConfigSecretOptions = {
  keyLabel: 'AI config secret encryption key',
  valueLabel: 'Encrypted AI config secret'
};

interface StoredApiKeyFields {
  apiKey: string;
  encryptedApiKey?: string | null;
}

/** Converts an API key into the common encrypted database field pair. */
export function toEncryptedApiKeyStorage(secretCryptoService: SecretCryptoService, apiKey: string) {
  const fields = secretCryptoService.encryptForStorage(apiKey, aiConfigSecretOptions);

  return {
    apiKey: fields.secret,
    encryptedApiKey: fields.encryptedSecret
  };
}

/** Resolves encrypted API key fields while legacy plaintext rows remain readable. */
export function resolveStoredApiKey(secretCryptoService: SecretCryptoService, record: StoredApiKeyFields) {
  return secretCryptoService.resolveStoredSecret(
    {
      secret: record.apiKey,
      encryptedSecret: record.encryptedApiKey
    },
    aiConfigSecretOptions
  );
}
