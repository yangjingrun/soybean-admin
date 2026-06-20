// Workbench "today" follows the current CRM business day, while quota buckets remain UTC elsewhere.
const crmBusinessDayOffsetMinutes = 8 * 60;

/** Returns the start of the CRM business day that contains the given date. */
export function startOfCrmBusinessDay(date: Date) {
  const shifted = new Date(date.getTime() + crmBusinessDayOffsetMinutes * 60_000);

  return new Date(
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) -
      crmBusinessDayOffsetMinutes * 60_000
  );
}

/** Adds calendar days on top of an already-normalized CRM business day boundary. */
export function addCrmBusinessDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

/** Creates the half-open Prisma date range used by CRM day filters. */
export function toDateRange(from: Date, to: Date) {
  return { gte: from, lt: to };
}

/** Formats a date into the CRM business-day key used by dashboard trends. */
export function formatCrmBusinessDateKey(date: Date) {
  return new Date(date.getTime() + crmBusinessDayOffsetMinutes * 60_000).toISOString().slice(0, 10);
}

/** Counts records by CRM business day. */
export function countDates(dates: Date[]) {
  const counts = new Map<string, number>();

  for (const date of dates) {
    const key = formatCrmBusinessDateKey(date);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return counts;
}

/** Narrows nullable date values after Prisma aggregate selects. */
export function isDate(value: Date | null): value is Date {
  return value instanceof Date;
}
