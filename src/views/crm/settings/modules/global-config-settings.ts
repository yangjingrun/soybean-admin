/** Create the default platform-wide CRM config form. */
export function createDefaultGlobalConfigForm(): Api.Crm.GlobalConfigFormModel {
  return {
    emailVerificationCooldownDays: 30,
    ownerConcurrentSendLimit: 5,
    ownerDailySendLimitMax: 200,
    followUpDelayDays: createDefaultFollowUpDelayDays()
  };
}

/** Create the default current-owner send scheduling preference form. */
export function createDefaultSendPreferenceForm(): Api.Crm.SendPreferenceFormModel {
  return {
    dailySendLimit: 50,
    followUpSharePercent: 70,
    ownerDailySendLimitMax: 200
  };
}

/** Create the default sequence follow-up delay policy in days for steps 2-5. */
export function createDefaultFollowUpDelayDays(): Api.Crm.FollowUpDelayDays {
  return {
    step2Days: 3,
    step3Days: 7,
    step4Days: 14,
    step5Days: 21
  };
}

/** Check whether the platform email verification cache cooldown can be saved. */
export function isValidEmailVerificationCooldownDays(value: number | null): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 365;
}

/** Check whether one owner's queued send concurrency limit can be saved. */
export function isValidOwnerConcurrentSendLimit(value: number | null): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 100;
}

/** Check whether the platform-wide owner daily send hard limit can be saved. */
export function isValidOwnerDailySendLimitMax(value: number | null): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1;
}

/** Check whether one owner daily send limit respects the platform hard limit. */
export function isValidDailySendLimit(value: number | null, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= max;
}

/** Check whether follow-up send share percent can be saved. */
export function isValidFollowUpSharePercent(value: number | null): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100;
}

/** Check whether all follow-up delay days can be saved. */
export function isValidFollowUpDelayDays(value: Api.Crm.FollowUpDelayDays) {
  return Object.values(value).every(day => Number.isInteger(day) && day >= 1 && day <= 90);
}
