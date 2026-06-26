export interface CrmLocalDateParts {
  year: number;
  month: number;
  day: number;
}

export interface CrmZonedDateTimeParts extends CrmLocalDateParts {
  hour: number;
  minute: number;
  second: number;
  weekday: number;
}

const zonedFormatters = new Map<string, Intl.DateTimeFormat>();

/** Converts an absolute Date into calendar/time parts in the customer's IANA timezone. */
export function toCrmZonedDateTimeParts(date: Date, timeZone: string): CrmZonedDateTimeParts {
  const values = Object.fromEntries(
    getZonedFormatter(timeZone)
      .formatToParts(date)
      .filter(part => part.type !== 'literal')
      .map(part => [part.type, part.value])
  );
  const dateParts = {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day)
  };

  return {
    ...dateParts,
    hour: normalizeIntlHour(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
    weekday: getCrmLocalWeekday(dateParts)
  };
}

/** Formats a local date key as YYYY-MM-DD for holiday provider lookups and fake tests. */
export function toCrmLocalDateKey(date: CrmLocalDateParts) {
  return `${date.year}-${padDatePart(date.month)}-${padDatePart(date.day)}`;
}

/** Returns the local weekday where 0 is Sunday and 6 is Saturday. */
export function getCrmLocalWeekday(date: CrmLocalDateParts) {
  return new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
}

/** Adds calendar days without applying the server process timezone. */
export function addCrmLocalDays(date: CrmLocalDateParts, days: number): CrmLocalDateParts {
  const next = new Date(Date.UTC(date.year, date.month - 1, date.day + days));

  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate()
  };
}

/** Converts customer local date and minute-of-day into a UTC Date using Intl timezone offsets. */
export function toCrmUtcDateFromLocalMinute(date: CrmLocalDateParts, minuteOfDay: number, timeZone: string) {
  const hour = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;
  const localTimeMs = Date.UTC(date.year, date.month - 1, date.day, hour, minute, 0, 0);
  let utcMs = localTimeMs;

  // Offset can change around DST boundaries; a few refinements converge for normal business hours.
  for (let index = 0; index < 3; index += 1) {
    utcMs = localTimeMs - getCrmTimeZoneOffsetMs(new Date(utcMs), timeZone);
  }

  return new Date(utcMs);
}

export function toCrmMinuteOfDay(parts: Pick<CrmZonedDateTimeParts, 'hour' | 'minute'>) {
  return parts.hour * 60 + parts.minute;
}

function getCrmTimeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = toCrmZonedDateTimeParts(date, timeZone);
  const zonedAsUtcMs = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second, 0);

  return zonedAsUtcMs - date.getTime();
}

function getZonedFormatter(timeZone: string) {
  const existing = zonedFormatters.get(timeZone);

  if (existing) {
    return existing;
  }

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  zonedFormatters.set(timeZone, formatter);

  return formatter;
}

function normalizeIntlHour(hour?: string) {
  const value = Number(hour);

  return value === 24 ? 0 : value;
}

function padDatePart(value: number) {
  return String(value).padStart(2, '0');
}
