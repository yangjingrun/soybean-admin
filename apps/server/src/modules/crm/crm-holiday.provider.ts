import { Injectable } from '@nestjs/common';
import type DateHolidays from 'date-holidays';
import { normalizeCrmSendCountry } from './country-send-rules';

type DateHolidaysConstructor = new (
  country: string,
  options?: {
    timezone?: string;
    types?: Array<'public' | 'bank'>;
  }
) => DateHolidays;

const DateHolidaysClass = require('date-holidays') as DateHolidaysConstructor;

export interface CrmHolidayQuery {
  country: string;
  timeZone: string;
  date: Date;
  localDate: string;
}

export interface CrmHolidayProvider {
  isHoliday(query: CrmHolidayQuery): boolean;
}

@Injectable()
export class CrmDateHolidayProvider implements CrmHolidayProvider {
  private readonly holidays = new Map<string, DateHolidays>();
  private readonly supportedCountries = new Set(Object.keys(new DateHolidaysClass('US').getCountries()));

  /** Checks date-holidays locally; unknown countries simply have no holiday calendar. */
  isHoliday(query: CrmHolidayQuery) {
    const country = normalizeCrmSendCountry(query.country);

    if (!this.supportedCountries.has(country)) {
      return false;
    }

    return this.getHolidays(country, query.timeZone).isHoliday(query.date) !== false;
  }

  private getHolidays(country: string, timeZone: string) {
    const key = `${country}:${timeZone}`;
    const existing = this.holidays.get(key);

    if (existing) {
      return existing;
    }

    const holidays = new DateHolidaysClass(country, {
      timezone: timeZone,
      types: ['public', 'bank']
    });

    this.holidays.set(key, holidays);

    return holidays;
  }
}
