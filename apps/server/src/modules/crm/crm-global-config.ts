export const crmGlobalConfigKey = 'default';
export const defaultEmailVerificationCooldownDays = 30;
export const maxEmailVerificationCooldownDays = 365;
export const defaultOwnerConcurrentSendLimit = 5;
export const maxOwnerConcurrentSendLimit = 100;
export const defaultFollowUpDelayDays = {
  step2Days: 3,
  step3Days: 7,
  step4Days: 14,
  step5Days: 21
};
export const maxFollowUpDelayDays = 90;

export interface CrmFollowUpDelayDays {
  step2Days: number;
  step3Days: number;
  step4Days: number;
  step5Days: number;
}

/** Normalizes the platform-wide email verification cache cooldown in days. */
export function normalizeEmailVerificationCooldownDays(value: unknown) {
  const numberValue = Number(value);

  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    return defaultEmailVerificationCooldownDays;
  }

  return Math.min(numberValue, maxEmailVerificationCooldownDays);
}

/** Normalizes the max queued outbound emails one owner can keep concurrently. */
export function normalizeOwnerConcurrentSendLimit(value: unknown) {
  const numberValue = Number(value);

  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    return defaultOwnerConcurrentSendLimit;
  }

  return Math.min(numberValue, maxOwnerConcurrentSendLimit);
}

/** Normalizes follow-up delay days for sequence steps 2-5. */
export function normalizeFollowUpDelayDays(value: unknown): CrmFollowUpDelayDays {
  if (typeof value === 'string') {
    const [step2Days, step3Days, step4Days, step5Days] = value.split(',').map(part => normalizeFollowUpDelayDay(part));

    return {
      step2Days: step2Days ?? defaultFollowUpDelayDays.step2Days,
      step3Days: step3Days ?? defaultFollowUpDelayDays.step3Days,
      step4Days: step4Days ?? defaultFollowUpDelayDays.step4Days,
      step5Days: step5Days ?? defaultFollowUpDelayDays.step5Days
    };
  }

  const record = value as Partial<CrmFollowUpDelayDays> | null | undefined;

  return {
    step2Days: normalizeFollowUpDelayDay(record?.step2Days) ?? defaultFollowUpDelayDays.step2Days,
    step3Days: normalizeFollowUpDelayDay(record?.step3Days) ?? defaultFollowUpDelayDays.step3Days,
    step4Days: normalizeFollowUpDelayDay(record?.step4Days) ?? defaultFollowUpDelayDays.step4Days,
    step5Days: normalizeFollowUpDelayDay(record?.step5Days) ?? defaultFollowUpDelayDays.step5Days
  };
}

/** Serializes follow-up delay days into the compact DB text field. */
export function serializeFollowUpDelayDays(value: unknown) {
  const normalized = normalizeFollowUpDelayDays(value);

  return [
    normalized.step2Days,
    normalized.step3Days,
    normalized.step4Days,
    normalized.step5Days
  ].join(',');
}

function normalizeFollowUpDelayDay(value: unknown) {
  const numberValue = Number(value);

  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    return null;
  }

  return Math.min(numberValue, maxFollowUpDelayDays);
}
