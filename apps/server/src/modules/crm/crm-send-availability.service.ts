import { Inject, Injectable } from '@nestjs/common';
import {
  type CrmCountrySendRule,
  type CrmSendAvailabilityReason,
  getCrmCountrySendRule,
  normalizeCrmSendCountry,
  resolveCrmSendTimezone
} from './country-send-rules';
import type { CrmHolidayProvider } from './crm-holiday.provider';
import {
  type CrmLocalDateParts,
  addCrmLocalDays,
  getCrmLocalWeekday,
  toCrmLocalDateKey,
  toCrmMinuteOfDay,
  toCrmUtcDateFromLocalMinute,
  toCrmZonedDateTimeParts
} from './crm-send-timezone.rules';
import { CRM_HOLIDAY_PROVIDER } from './crm.tokens';

export interface CrmSendAvailabilityInput {
  now: Date;
  country: string;
  timeZone?: string | null;
  city?: string | null;
  sendRule?: Pick<CrmCountrySendRule, 'workdays' | 'windows'>;
}

export interface CrmSendAvailabilityResult {
  canSend: boolean;
  timeZone: string | null;
  reason?: CrmSendAvailabilityReason;
  nextAvailableAt?: Date;
}

@Injectable()
export class CrmSendAvailabilityService {
  constructor(
    @Inject(CRM_HOLIDAY_PROVIDER)
    private readonly holidayProvider: CrmHolidayProvider
  ) {}

  /** Evaluates whether a CRM message can be sent now in the customer's local business calendar. */
  evaluate(input: CrmSendAvailabilityInput): CrmSendAvailabilityResult {
    const country = normalizeCrmSendCountry(input.country);
    const rule = this.resolveSendRule(country, input.sendRule);
    const resolvedTimeZone = resolveCrmSendTimezone(input);

    if (!resolvedTimeZone.timeZone) {
      return {
        canSend: false,
        timeZone: null,
        reason: resolvedTimeZone.reason
      };
    }

    const timeZone = resolvedTimeZone.timeZone;
    const localNow = toCrmZonedDateTimeParts(input.now, timeZone);

    if (!this.isWorkday(localNow, rule)) {
      return this.rejectWithNextAvailableAt('weekend', country, timeZone, rule, addCrmLocalDays(localNow, 1));
    }

    if (this.isHoliday(country, timeZone, input.now, localNow)) {
      return this.rejectWithNextAvailableAt('holiday', country, timeZone, rule, addCrmLocalDays(localNow, 1));
    }

    const currentMinute = toCrmMinuteOfDay(localNow);
    const withinWindow = rule.windows.some(
      window => currentMinute >= window.startMinute && currentMinute < window.endMinute
    );

    if (withinWindow) {
      return {
        canSend: true,
        timeZone,
        reason: 'within_window'
      };
    }

    return {
      canSend: false,
      timeZone,
      reason: 'outside_window',
      nextAvailableAt: this.findNextAvailableAt({
        country,
        timeZone,
        rule,
        startDate: localNow,
        afterMinute: currentMinute
      })
    };
  }

  private rejectWithNextAvailableAt(
    reason: Extract<CrmSendAvailabilityReason, 'weekend' | 'holiday'>,
    country: string,
    timeZone: string,
    rule: CrmCountrySendRule,
    startDate: CrmLocalDateParts
  ): CrmSendAvailabilityResult {
    return {
      canSend: false,
      timeZone,
      reason,
      nextAvailableAt: this.findNextAvailableAt({
        country,
        timeZone,
        rule,
        startDate
      })
    };
  }

  /** Finds the next configured send window while skipping local weekends and holidays. */
  private findNextAvailableAt(input: {
    country: string;
    timeZone: string;
    rule: CrmCountrySendRule;
    startDate: CrmLocalDateParts;
    afterMinute?: number;
  }) {
    let cursor = input.startDate;
    let afterMinute = input.afterMinute;

    while (true) {
      if (this.isWorkday(cursor, input.rule)) {
        for (const window of input.rule.windows) {
          if (afterMinute !== undefined && window.startMinute <= afterMinute) {
            continue;
          }

          const candidate = toCrmUtcDateFromLocalMinute(cursor, window.startMinute, input.timeZone);

          if (!this.isHoliday(input.country, input.timeZone, candidate, cursor)) {
            return candidate;
          }
        }
      }

      cursor = addCrmLocalDays(cursor, 1);
      afterMinute = undefined;
    }
  }

  private isWorkday(date: CrmLocalDateParts, rule: CrmCountrySendRule) {
    return rule.workdays.includes(getCrmLocalWeekday(date));
  }

  private resolveSendRule(country: string, sendRule?: Pick<CrmCountrySendRule, 'workdays' | 'windows'>) {
    const countryRule = getCrmCountrySendRule(country);

    if (!sendRule) {
      return countryRule;
    }

    return {
      ...countryRule,
      workdays: sendRule.workdays,
      windows: sendRule.windows
    };
  }

  private isHoliday(country: string, timeZone: string, date: Date, localDate: CrmLocalDateParts) {
    return this.holidayProvider.isHoliday({
      country,
      timeZone,
      date,
      localDate: toCrmLocalDateKey(localDate)
    });
  }
}
