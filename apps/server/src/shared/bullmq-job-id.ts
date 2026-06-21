const bullMqJobIdSeparator = '__';

/**
 * Builds deterministic BullMQ custom job IDs without using Redis key separators.
 *
 * BullMQ reserves `:` in ordinary custom job IDs, so queue modules should compose IDs through this helper.
 */
export function createBullMqJobId(...parts: Array<string | number>) {
  return parts.map(part => String(part)).join(bullMqJobIdSeparator);
}
