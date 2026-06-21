import { ServiceUnavailableException } from '@nestjs/common';
import type { AppConfigService } from '../app-config/app-config.service';
import { assertSecretEncryptionKey, decryptSecret, encryptSecret } from '../../shared/secret-crypto';

const aiConfigSecretCryptoOptions = {
  keyLabel: 'AI config secret encryption key',
  valueLabel: 'Encrypted AI config secret'
};

interface StoredApiKeyFields {
  apiKey: string;
  encryptedApiKey?: string | null;
}

/** Encrypts an AI gateway provider key and clears the legacy plaintext column. */
export function encryptAiConfigApiKey(apiKey: string, appConfigService: AppConfigService) {
  return {
    apiKey: '',
    encryptedApiKey: encryptSecret(apiKey, requireAiConfigSecretEncryptionKey(appConfigService), aiConfigSecretCryptoOptions)
  };
}

/** Resolves encrypted provider keys while legacy plaintext rows are being migrated. */
export function resolveAiConfigApiKey(record: StoredApiKeyFields, appConfigService: AppConfigService) {
  if (record.encryptedApiKey) {
    return decryptSecret(record.encryptedApiKey, requireAiConfigSecretEncryptionKey(appConfigService), aiConfigSecretCryptoOptions);
  }

  return record.apiKey;
}

function requireAiConfigSecretEncryptionKey(appConfigService: AppConfigService) {
  const secretKey = appConfigService.config.aiConfigSecretEncryptionKey;

  if (!secretKey) {
    throw new ServiceUnavailableException(
      'AI 配置加密密钥未配置，请设置 32 字节 AI_CONFIG_SECRET_ENCRYPTION_KEY 后重试'
    );
  }

  try {
    assertSecretEncryptionKey(secretKey, aiConfigSecretCryptoOptions);
  } catch {
    throw new ServiceUnavailableException('AI 配置加密密钥必须为 32 字节，请检查 AI_CONFIG_SECRET_ENCRYPTION_KEY');
  }

  return secretKey;
}
