import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CrmSendAvailabilityService } from './crm-send-availability.service';
import type { CrmHolidayProvider, CrmHolidayQuery } from './crm-holiday.provider';

describe('CrmSendAvailabilityService', () => {
  it('allows US accounts with an explicit New York timezone during the local morning window', () => {
    const service = createService();

    const result = service.evaluate({
      now: new Date('2026-06-22T14:00:00.000Z'),
      country: 'US',
      timeZone: 'America/New_York'
    });

    assert.deepEqual(result, {
      canSend: true,
      timeZone: 'America/New_York',
      reason: 'within_window'
    });
  });

  it('rejects US accounts without timezone because the country is ambiguous', () => {
    const service = createService();

    const result = service.evaluate({
      now: new Date('2026-06-22T14:00:00.000Z'),
      country: 'US'
    });

    assert.deepEqual(result, {
      canSend: false,
      timeZone: null,
      reason: 'ambiguous_timezone'
    });
  });

  it('uses the UAE default timezone when no account timezone is provided', () => {
    const service = createService();

    const result = service.evaluate({
      now: new Date('2026-06-22T06:00:00.000Z'),
      country: 'AE'
    });

    assert.deepEqual(result, {
      canSend: true,
      timeZone: 'Asia/Dubai',
      reason: 'within_window'
    });
  });

  it('rejects weekend sends and moves nextAvailableAt to the next workday morning window', () => {
    const service = createService();

    const result = service.evaluate({
      now: new Date('2026-06-20T14:00:00.000Z'),
      country: 'US',
      timeZone: 'America/New_York'
    });

    assert.equal(result.canSend, false);
    assert.equal(result.timeZone, 'America/New_York');
    assert.equal(result.reason, 'weekend');
    assert.equal(result.nextAvailableAt?.toISOString(), '2026-06-22T13:00:00.000Z');
  });

  it('rejects fake holidays and moves nextAvailableAt past the holiday', () => {
    const service = createService({ holidays: ['US:2026-06-22'] });

    const result = service.evaluate({
      now: new Date('2026-06-22T14:00:00.000Z'),
      country: 'US',
      timeZone: 'America/New_York'
    });

    assert.equal(result.canSend, false);
    assert.equal(result.timeZone, 'America/New_York');
    assert.equal(result.reason, 'holiday');
    assert.equal(result.nextAvailableAt?.toISOString(), '2026-06-23T13:00:00.000Z');
  });

  it('moves the next available time to 14:00 on the same local day between morning and afternoon windows', () => {
    const service = createService();

    const result = service.evaluate({
      now: new Date('2026-06-22T16:10:00.000Z'),
      country: 'US',
      timeZone: 'America/New_York'
    });

    assert.equal(result.canSend, false);
    assert.equal(result.timeZone, 'America/New_York');
    assert.equal(result.reason, 'outside_window');
    assert.equal(result.nextAvailableAt?.toISOString(), '2026-06-22T18:00:00.000Z');
  });

  it('moves the next available time to the next workday morning after the afternoon window', () => {
    const service = createService();

    const result = service.evaluate({
      now: new Date('2026-06-22T23:00:00.000Z'),
      country: 'US',
      timeZone: 'America/New_York'
    });

    assert.equal(result.canSend, false);
    assert.equal(result.timeZone, 'America/New_York');
    assert.equal(result.reason, 'outside_window');
    assert.equal(result.nextAvailableAt?.toISOString(), '2026-06-23T13:00:00.000Z');
  });

  it('uses configured global workdays and send windows while preserving the customer timezone', () => {
    const service = createService();

    const result = service.evaluate({
      now: new Date('2026-06-22T21:30:00.000Z'),
      country: 'US',
      timeZone: 'America/New_York',
      sendRule: {
        workdays: [1, 2, 3, 4, 5],
        windows: [
          { startMinute: 9 * 60, endMinute: 12 * 60 },
          { startMinute: 14 * 60, endMinute: 18 * 60 }
        ]
      }
    });

    assert.deepEqual(result, {
      canSend: true,
      timeZone: 'America/New_York',
      reason: 'within_window'
    });
  });
});

function createService(input: { holidays?: string[] } = {}) {
  return new CrmSendAvailabilityService(new FakeHolidayProvider(input.holidays ?? []));
}

class FakeHolidayProvider implements CrmHolidayProvider {
  private readonly holidays: Set<string>;

  constructor(holidays: string[]) {
    this.holidays = new Set(holidays);
  }

  isHoliday(query: CrmHolidayQuery) {
    return this.holidays.has(`${query.country}:${query.localDate}`);
  }
}
