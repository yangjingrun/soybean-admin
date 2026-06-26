import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);
const passwordKeyLength = 64;
const temporaryPasswordLength = 14;
const temporaryPasswordChars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

/** Hash one password with a random salt. */
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = await hashPasswordWithSalt(password, salt);

  return {
    hash,
    salt
  };
}

/** Verify a plain password against a stored salt and hash. */
export async function verifyPassword(password: string, salt: string, hash: string) {
  const passwordHash = await hashPasswordWithSalt(password, salt);
  const expected = Buffer.from(hash, 'hex');
  const actual = Buffer.from(passwordHash, 'hex');

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** Generate a readable temporary password for create and reset operations. */
export function generateTemporaryPassword() {
  const bytes = randomBytes(temporaryPasswordLength);

  return Array.from(bytes, byte => temporaryPasswordChars[byte % temporaryPasswordChars.length]).join('');
}

async function hashPasswordWithSalt(password: string, salt: string) {
  const key = (await scryptAsync(password, salt, passwordKeyLength)) as Buffer;

  return key.toString('hex');
}
