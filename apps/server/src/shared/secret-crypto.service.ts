import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { AppConfigService } from '../modules/app-config/app-config.service';
import { assertSecretEncryptionKey, decryptSecret, encryptSecret, type SecretCryptoOptions } from './secret-crypto';

export interface StoredSecretFields {
  secret: string;
  encryptedSecret?: string | null;
}

export interface SecretStorageFields {
  secret: string;
  encryptedSecret: string;
}

@Injectable()
export class SecretCryptoService {
  constructor(@Inject(AppConfigService) private readonly appConfigService: AppConfigService) {}

  /** Encrypts one business secret for database storage and clears the legacy plaintext field. */
  encryptForStorage(secret: string, options: SecretCryptoOptions = {}): SecretStorageFields {
    return {
      secret: '',
      encryptedSecret: encryptSecret(secret, this.requireDefaultSecretKey(options), options)
    };
  }

  /** Resolves encrypted secret fields while legacy plaintext rows are still supported. */
  resolveStoredSecret(record: StoredSecretFields, options: SecretCryptoOptions = {}) {
    if (record.encryptedSecret) {
      return decryptSecret(record.encryptedSecret, this.requireDefaultSecretKey(options), options);
    }

    return record.secret;
  }

  /** Encrypts a secret with an explicitly provided key, for integrations that own a separate key. */
  encryptWithKey(secret: string, secretKey: string, options: SecretCryptoOptions = {}) {
    return encryptSecret(secret, this.requireSecretKey(secretKey, options), options);
  }

  /** Decrypts a secret with an explicitly provided key, for integrations that own a separate key. */
  decryptWithKey(encryptedSecret: string, secretKey: string, options: SecretCryptoOptions = {}) {
    return decryptSecret(encryptedSecret, this.requireSecretKey(secretKey, options), options);
  }

  private requireDefaultSecretKey(options: Pick<SecretCryptoOptions, 'keyLabel'> = {}) {
    const secretKey = this.appConfigService.config.aiConfigSecretEncryptionKey;

    if (!secretKey) {
      throw new ServiceUnavailableException(
        '业务密钥加密密钥未配置，请设置 32 字节 AI_CONFIG_SECRET_ENCRYPTION_KEY 后重试'
      );
    }

    return this.requireSecretKey(secretKey, options);
  }

  private requireSecretKey(secretKey: string, options: Pick<SecretCryptoOptions, 'keyLabel'> = {}) {
    try {
      assertSecretEncryptionKey(secretKey, options);
    } catch {
      throw new ServiceUnavailableException(`${options.keyLabel ?? '业务密钥加密密钥'}必须为 32 字节`);
    }

    return secretKey;
  }
}
