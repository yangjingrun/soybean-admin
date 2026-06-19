export const crmGlobalConfigKey = 'default';
export const defaultEmailVerificationCooldownDays = 30;
export const maxEmailVerificationCooldownDays = 365;

/** Normalizes the platform-wide email verification cache cooldown in days. */
export function normalizeEmailVerificationCooldownDays(value: unknown) {
  const numberValue = Number(value);

  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    return defaultEmailVerificationCooldownDays;
  }

  return Math.min(numberValue, maxEmailVerificationCooldownDays);
}
