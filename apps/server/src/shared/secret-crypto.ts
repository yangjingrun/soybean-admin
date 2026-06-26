import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const secretVersion = 'v1';
const secretAlgorithm = 'aes-256-gcm';
const secretIvLength = 12;

export interface SecretCryptoOptions {
  keyLabel?: string;
  valueLabel?: string;
}

/** Verifies that a configured secret key matches the AES-256 key length. */
export function assertSecretEncryptionKey(
  secretKey: string,
  options: Pick<SecretCryptoOptions, 'keyLabel'> = {}
): void {
  normalizeSecretKey(secretKey, options.keyLabel);
}

/** Encrypts a short application secret with AES-256-GCM. */
export function encryptSecret(plainText: string, secretKey: string, options: SecretCryptoOptions = {}): string {
  const key = normalizeSecretKey(secretKey, options.keyLabel);
  const iv = randomBytes(secretIvLength);
  const cipher = createCipheriv(secretAlgorithm, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [secretVersion, toBase64Url(iv), toBase64Url(authTag), toBase64Url(encrypted)].join(':');
}

/** Decrypts a short application secret stored by encryptSecret. */
export function decryptSecret(encryptedValue: string, secretKey: string, options: SecretCryptoOptions = {}): string {
  const [version, ivValue, authTagValue, encryptedTextValue] = encryptedValue.split(':');

  if (version !== secretVersion || !ivValue || !authTagValue || !encryptedTextValue) {
    throw new Error(`${options.valueLabel ?? 'Encrypted secret'} format is invalid`);
  }

  const key = normalizeSecretKey(secretKey, options.keyLabel);
  const decipher = createDecipheriv(secretAlgorithm, key, fromBase64Url(ivValue));
  decipher.setAuthTag(fromBase64Url(authTagValue));

  return Buffer.concat([decipher.update(fromBase64Url(encryptedTextValue)), decipher.final()]).toString('utf8');
}

function normalizeSecretKey(secretKey: string, keyLabel = 'Secret encryption key') {
  const key = Buffer.from(secretKey, 'utf8');

  if (key.length !== 32) {
    throw new Error(`${keyLabel} must be 32 bytes`);
  }

  return key;
}

function toBase64Url(value: Buffer) {
  return value.toString('base64url');
}

function fromBase64Url(value: string) {
  return Buffer.from(value, 'base64url');
}
