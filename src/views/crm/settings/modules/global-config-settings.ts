/** Create the default platform-wide CRM config form. */
export function createDefaultGlobalConfigForm(): Api.Crm.GlobalConfigFormModel {
  return {
    emailVerificationCooldownDays: 30,
    ownerConcurrentSendLimit: 5,
    ownerDailySendLimitMax: 200,
    followUpDelayDays: createDefaultFollowUpDelayDays(),
    sendWorkdays: [1, 2, 3, 4, 5],
    sendWindows: createDefaultSendWindows()
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
    step4Days: 12,
    step5Days: 18
  };
}

/** Create the default customer local work time window. */
export function createDefaultSendWindow(): Api.Crm.SendWindow {
  return {
    startMinute: 9 * 60,
    endMinute: 12 * 60
  };
}

/** Create the default customer local work time windows. */
export function createDefaultSendWindows(): Api.Crm.SendWindow[] {
  return [createDefaultSendWindow(), { startMinute: 14 * 60, endMinute: 18 * 60 }];
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

/** Check whether customer local workdays can be saved. */
export function isValidSendWorkdays(value: number[]) {
  const uniqueValues = new Set(value);

  return (
    value.length > 0 &&
    uniqueValues.size === value.length &&
    value.every(day => Number.isInteger(day) && day >= 0 && day <= 6)
  );
}

/** Check whether customer local send windows can be saved. */
export function isValidSendWindows(value: Api.Crm.SendWindow[]) {
  return (
    value.length > 0 &&
    value.every(
      window =>
        Number.isInteger(window.startMinute) &&
        Number.isInteger(window.endMinute) &&
        window.startMinute >= 0 &&
        window.endMinute <= 24 * 60 &&
        window.startMinute < window.endMinute
    )
  );
}
