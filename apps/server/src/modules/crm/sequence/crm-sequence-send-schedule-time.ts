import { BadRequestException } from '@nestjs/common';
import type { CrmSendAvailabilityService } from '../crm-send-availability.service';
import type { CrmAccountRecord, CrmGlobalConfigRecord } from '../crm.types';

export interface CrmSequenceScheduledAtInput {
  availabilityService: CrmSendAvailabilityService;
  account: Pick<CrmAccountRecord, 'country' | 'city' | 'timeZone'>;
  globalConfig: Pick<CrmGlobalConfigRecord, 'sendWorkdays' | 'sendWindows'>;
  latestScheduledAt?: Date | null;
  mailboxScheduleTimes?: Date[];
  now?: Date;
  random?: () => number;
}

export const crmSendCadenceMinDelayMs = 5 * 60 * 1000;
export const crmSendCadenceMaxDelayMs = 10 * 60 * 1000;

/** Resolves the real first-send schedule time based on the recipient's local send window. */
export function resolveCrmSequenceScheduledAt(input: CrmSequenceScheduledAtInput) {
  const now = input.now ?? new Date();
  const cadenceDelayMs = createCrmSendCadenceDelayMs(input.random ?? Math.random);
  const scheduleTimes = normalizeMailboxScheduleTimes(input);
  let candidate = resolveRecipientReadyAt(input, now).readyAt;

  for (let index = 0; index <= scheduleTimes.length + 30; index += 1) {
    const recipientReadyAt = resolveRecipientReadyAt(input, candidate).readyAt;
    const conflictAt = findMailboxScheduleConflict(scheduleTimes, recipientReadyAt, cadenceDelayMs);

    if (!conflictAt) {
      return recipientReadyAt;
    }

    // Move past the conflicting mailbox slot, then re-check the recipient's local send window.
    candidate = new Date(conflictAt.getTime() + cadenceDelayMs);
  }

  throw new BadRequestException('发送邮箱排期过密，请稍后重试');
}

/** Applies the owner-level send cadence after the recipient can receive mail. */
export function resolveCrmSendCadenceReadyAt(input: {
  readyAt: Date;
  latestScheduledAt?: Date | null;
  random?: () => number;
}) {
  if (!input.latestScheduledAt) {
    return input.readyAt;
  }

  const cadenceReadyAt = new Date(
    input.latestScheduledAt.getTime() + createCrmSendCadenceDelayMs(input.random ?? Math.random)
  );

  return cadenceReadyAt > input.readyAt ? cadenceReadyAt : input.readyAt;
}

export function createCrmSendCadenceDelayMs(random: () => number) {
  const ratio = Math.min(Math.max(random(), 0), 0.999999);

  return Math.floor(crmSendCadenceMinDelayMs + ratio * (crmSendCadenceMaxDelayMs - crmSendCadenceMinDelayMs));
}

/** Normalize mailbox schedule inputs and keep them ordered for gap scanning. */
function normalizeMailboxScheduleTimes(input: CrmSequenceScheduledAtInput) {
  const times = input.mailboxScheduleTimes?.length
    ? input.mailboxScheduleTimes
    : input.latestScheduledAt
      ? [input.latestScheduledAt]
      : [];

  return Array.from(new Set(times.map(time => time.getTime())))
    .sort((left, right) => left - right)
    .map(time => new Date(time));
}

/** Returns a planned/sent mailbox time that is too close to the candidate slot. */
function findMailboxScheduleConflict(scheduleTimes: Date[], candidate: Date, cadenceDelayMs: number) {
  const candidateTime = candidate.getTime();

  for (const scheduleTime of scheduleTimes) {
    const time = scheduleTime.getTime();

    if (time <= candidateTime && candidateTime - time < cadenceDelayMs) {
      return scheduleTime;
    }

    if (time > candidateTime) {
      return time - candidateTime < cadenceDelayMs ? scheduleTime : null;
    }
  }

  return null;
}

function resolveRecipientReadyAt(input: CrmSequenceScheduledAtInput, now: Date) {
  const availability = input.availabilityService.evaluate({
    now,
    country: input.account.country ?? '',
    city: input.account.city,
    timeZone: input.account.timeZone,
    sendRule: {
      workdays: input.globalConfig.sendWorkdays,
      windows: input.globalConfig.sendWindows
    }
  });

  if (availability.canSend) {
    return {
      readyAt: now,
      timeZone: availability.timeZone
    };
  }

  if (availability.nextAvailableAt) {
    return {
      readyAt: availability.nextAvailableAt,
      timeZone: availability.timeZone
    };
  }

  throw new BadRequestException('客户时区不明确，请先补充客户国家、城市或时区');
}
