export const crmGlobalConfigKey = 'default';
export const defaultEmailVerificationCooldownDays = 30;
export const maxEmailVerificationCooldownDays = 365;
export const defaultOwnerConcurrentSendLimit = 5;
export const maxOwnerConcurrentSendLimit = 100;
export const defaultOwnerDailySendLimit = 50;
export const defaultFollowUpSharePercent = 70;
export const defaultOwnerDailySendLimitMax = 200;
export const maxOwnerDailySendLimitMax = 1000;
export const defaultFollowUpDelayDays = {
  step2Days: 3,
  step3Days: 7,
  step4Days: 14,
  step5Days: 21
};
export const maxFollowUpDelayDays = 90;
export const defaultCrmSendWorkdays = [1, 2, 3, 4, 5];
export const defaultCrmSendWindows = [
  { startMinute: toMinuteOfDay(9, 0), endMinute: toMinuteOfDay(12, 0) },
  { startMinute: toMinuteOfDay(14, 0), endMinute: toMinuteOfDay(18, 0) }
];

export interface CrmFollowUpDelayDays {
  step2Days: number;
  step3Days: number;
  step4Days: number;
  step5Days: number;
}

export interface CrmConfiguredSendWindow {
  startMinute: number;
  endMinute: number;
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

/** Normalizes the platform hard cap for each owner's daily queued sends. */
export function normalizeOwnerDailySendLimitMax(value: unknown) {
  const numberValue = Number(value);

  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    return defaultOwnerDailySendLimitMax;
  }

  return Math.min(numberValue, maxOwnerDailySendLimitMax);
}

/** Normalizes a current owner's daily queued-send preference against the platform cap. */
export function normalizeOwnerDailySendLimit(value: unknown, maxLimit: number) {
  const numberValue = Number(value);

  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    return defaultOwnerDailySendLimit;
  }

  return Math.min(numberValue, maxLimit);
}

/** Normalizes the percentage of daily capacity reserved for follow-up messages. */
export function normalizeFollowUpSharePercent(value: unknown) {
  const numberValue = Number(value);

  if (!Number.isInteger(numberValue) || numberValue < 0) {
    return defaultFollowUpSharePercent;
  }

  return Math.min(numberValue, 100);
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

  return [normalized.step2Days, normalized.step3Days, normalized.step4Days, normalized.step5Days].join(',');
}

/** Normalizes platform-wide customer local workdays, using 0-6 as Sunday-Saturday. */
export function normalizeCrmSendWorkdays(value: unknown): number[] {
  const rawItems = typeof value === 'string' ? value.split(',') : Array.isArray(value) ? value : [];
  const workdays = rawItems.map(item => Number(item)).filter(item => Number.isInteger(item) && item >= 0 && item <= 6);
  const uniqueWorkdays = Array.from(new Set(workdays));

  return uniqueWorkdays.length > 0 ? uniqueWorkdays : [...defaultCrmSendWorkdays];
}

/** Serializes platform-wide customer local workdays into a compact DB text field. */
export function serializeCrmSendWorkdays(value: unknown) {
  return normalizeCrmSendWorkdays(value).join(',');
}

/** Normalizes platform-wide customer local send windows. */
export function normalizeCrmSendWindows(value: unknown): CrmConfiguredSendWindow[] {
  const rawItems = typeof value === 'string' ? value.split(',') : Array.isArray(value) ? value : [];
  const windows = rawItems
    .map(item => normalizeCrmSendWindow(item))
    .filter((item): item is CrmConfiguredSendWindow => Boolean(item))
    .sort((left, right) => left.startMinute - right.startMinute);

  return windows.length > 0 ? windows : defaultCrmSendWindows.map(window => ({ ...window }));
}

/** Serializes platform-wide customer local send windows into a compact DB text field. */
export function serializeCrmSendWindows(value: unknown) {
  return normalizeCrmSendWindows(value).map(formatCrmSendWindow).join(',');
}

function normalizeFollowUpDelayDay(value: unknown) {
  const numberValue = Number(value);

  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    return null;
  }

  return Math.min(numberValue, maxFollowUpDelayDays);
}

function normalizeCrmSendWindow(value: unknown): CrmConfiguredSendWindow | null {
  if (typeof value === 'string') {
    const [start, end] = value.split('-').map(part => parseMinuteOfDay(part));

    if (start === null || end === null || start >= end) {
      return null;
    }

    return { startMinute: start, endMinute: end };
  }

  const record = value as Partial<CrmConfiguredSendWindow> | null | undefined;
  const startMinute = Number(record?.startMinute);
  const endMinute = Number(record?.endMinute);

  if (
    !Number.isInteger(startMinute) ||
    !Number.isInteger(endMinute) ||
    startMinute < 0 ||
    endMinute > 24 * 60 ||
    startMinute >= endMinute
  ) {
    return null;
  }

  return { startMinute, endMinute };
}

function parseMinuteOfDay(value: string | undefined) {
  const match = value?.trim().match(/^(\d{1,2}):(\d{2})$/);

  if (!match) {
    return null;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 24 || minute < 0 || minute > 59) {
    return null;
  }

  if (hour === 24 && minute !== 0) {
    return null;
  }

  return toMinuteOfDay(hour, minute);
}

function formatCrmSendWindow(window: CrmConfiguredSendWindow) {
  return `${formatMinuteOfDay(window.startMinute)}-${formatMinuteOfDay(window.endMinute)}`;
}

function formatMinuteOfDay(value: number) {
  const hour = Math.floor(value / 60);
  const minute = value % 60;

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function toMinuteOfDay(hour: number, minute: number) {
  return hour * 60 + minute;
}
