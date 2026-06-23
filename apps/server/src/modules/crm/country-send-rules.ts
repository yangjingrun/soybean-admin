export type CrmSendAvailabilityReason =
  | 'within_window'
  | 'outside_window'
  | 'weekend'
  | 'holiday'
  | 'missing_timezone'
  | 'ambiguous_timezone';

export interface CrmSendWindow {
  startMinute: number;
  endMinute: number;
}

export interface CrmCountrySendRule {
  country: string;
  workdays: number[];
  windows: CrmSendWindow[];
  defaultTimezone?: string;
  requiresTimezone?: boolean;
}

export interface CrmResolvedSendTimezone {
  timeZone: string | null;
  reason?: Extract<CrmSendAvailabilityReason, 'missing_timezone' | 'ambiguous_timezone'>;
}

export const defaultCrmSendWindows: CrmSendWindow[] = [
  { startMinute: toMinuteOfDay(9, 30), endMinute: toMinuteOfDay(11, 30) },
  { startMinute: toMinuteOfDay(14, 0), endMinute: toMinuteOfDay(16, 30) }
];

const mondayToFriday = [1, 2, 3, 4, 5];
const sundayToThursday = [0, 1, 2, 3, 4];

const defaultCountrySendRule: CrmCountrySendRule = {
  country: 'DEFAULT',
  workdays: mondayToFriday,
  windows: defaultCrmSendWindows
};

export const crmCountrySendRules: Record<string, CrmCountrySendRule> = {
  US: {
    country: 'US',
    workdays: mondayToFriday,
    windows: defaultCrmSendWindows,
    requiresTimezone: true
  },
  CA: {
    country: 'CA',
    workdays: mondayToFriday,
    windows: defaultCrmSendWindows,
    requiresTimezone: true
  },
  AU: {
    country: 'AU',
    workdays: mondayToFriday,
    windows: defaultCrmSendWindows,
    requiresTimezone: true
  },
  AE: {
    country: 'AE',
    workdays: mondayToFriday,
    windows: defaultCrmSendWindows,
    defaultTimezone: 'Asia/Dubai'
  },
  SA: {
    country: 'SA',
    workdays: sundayToThursday,
    windows: defaultCrmSendWindows,
    defaultTimezone: 'Asia/Riyadh'
  },
  QA: {
    country: 'QA',
    workdays: sundayToThursday,
    windows: defaultCrmSendWindows,
    defaultTimezone: 'Asia/Qatar'
  },
  KW: {
    country: 'KW',
    workdays: sundayToThursday,
    windows: defaultCrmSendWindows,
    defaultTimezone: 'Asia/Kuwait'
  },
  OM: {
    country: 'OM',
    workdays: sundayToThursday,
    windows: defaultCrmSendWindows,
    defaultTimezone: 'Asia/Muscat'
  },
  BH: {
    country: 'BH',
    workdays: sundayToThursday,
    windows: defaultCrmSendWindows,
    defaultTimezone: 'Asia/Bahrain'
  },
  JO: {
    country: 'JO',
    workdays: sundayToThursday,
    windows: defaultCrmSendWindows,
    defaultTimezone: 'Asia/Amman'
  },
  IQ: {
    country: 'IQ',
    workdays: sundayToThursday,
    windows: defaultCrmSendWindows,
    defaultTimezone: 'Asia/Baghdad'
  },
  GB: {
    country: 'GB',
    workdays: mondayToFriday,
    windows: defaultCrmSendWindows,
    defaultTimezone: 'Europe/London'
  },
  DE: {
    country: 'DE',
    workdays: mondayToFriday,
    windows: defaultCrmSendWindows,
    defaultTimezone: 'Europe/Berlin'
  },
  FR: {
    country: 'FR',
    workdays: mondayToFriday,
    windows: defaultCrmSendWindows,
    defaultTimezone: 'Europe/Paris'
  },
  CN: {
    country: 'CN',
    workdays: mondayToFriday,
    windows: defaultCrmSendWindows,
    defaultTimezone: 'Asia/Shanghai'
  },
  JP: {
    country: 'JP',
    workdays: mondayToFriday,
    windows: defaultCrmSendWindows,
    defaultTimezone: 'Asia/Tokyo'
  },
  KR: {
    country: 'KR',
    workdays: mondayToFriday,
    windows: defaultCrmSendWindows,
    defaultTimezone: 'Asia/Seoul'
  },
  IN: {
    country: 'IN',
    workdays: mondayToFriday,
    windows: defaultCrmSendWindows,
    defaultTimezone: 'Asia/Kolkata'
  },
  BR: {
    country: 'BR',
    workdays: mondayToFriday,
    windows: defaultCrmSendWindows,
    requiresTimezone: true
  },
  MX: {
    country: 'MX',
    workdays: mondayToFriday,
    windows: defaultCrmSendWindows,
    requiresTimezone: true
  },
  RU: {
    country: 'RU',
    workdays: mondayToFriday,
    windows: defaultCrmSendWindows,
    requiresTimezone: true
  },
  ID: {
    country: 'ID',
    workdays: mondayToFriday,
    windows: defaultCrmSendWindows,
    requiresTimezone: true
  }
};

/** Normalizes user/account country input into the ISO alpha-2 style used by local send rules. */
export function normalizeCrmSendCountry(country?: string | null) {
  return country?.trim().toUpperCase() ?? '';
}

/** Returns the configured rule for a country, or the project default rule for unknown countries. */
export function getCrmCountrySendRule(country?: string | null) {
  const normalizedCountry = normalizeCrmSendCountry(country);

  return crmCountrySendRules[normalizedCountry] ?? defaultCountrySendRule;
}

/** Resolves account timezone first, then country default timezone, without guessing ambiguous countries. */
export function resolveCrmSendTimezone(input: { country?: string | null; timeZone?: string | null }) {
  const accountTimeZone = input.timeZone?.trim();

  if (accountTimeZone) {
    return { timeZone: accountTimeZone } satisfies CrmResolvedSendTimezone;
  }

  const rule = getCrmCountrySendRule(input.country);

  if (rule.defaultTimezone) {
    return { timeZone: rule.defaultTimezone } satisfies CrmResolvedSendTimezone;
  }

  return {
    timeZone: null,
    reason: rule.requiresTimezone ? 'ambiguous_timezone' : 'missing_timezone'
  } satisfies CrmResolvedSendTimezone;
}

function toMinuteOfDay(hour: number, minute: number) {
  return hour * 60 + minute;
}
