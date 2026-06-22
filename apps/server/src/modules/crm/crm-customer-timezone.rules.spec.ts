import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveCrmCustomerTimeZone } from './crm-customer-timezone.rules';

describe('resolveCrmCustomerTimeZone', () => {
  it('resolves common city timezones for trade customer profiles', () => {
    const cases = [
      [{ country: 'US', city: 'New York' }, 'America/New_York'],
      [{ country: 'United States', city: 'Los Angeles' }, 'America/Los_Angeles'],
      [{ country: 'USA', city: 'Chicago' }, 'America/Chicago'],
      [{ country: 'US', city: 'Houston' }, 'America/Chicago'],
      [{ country: 'US', city: 'Denver' }, 'America/Denver'],
      [{ country: 'United Arab Emirates', city: 'Dubai' }, 'Asia/Dubai'],
      [{ country: 'SA', city: 'Jeddah' }, 'Asia/Riyadh'],
      [{ country: 'GB', city: 'London' }, 'Europe/London'],
      [{ country: 'DE', city: 'Berlin' }, 'Europe/Berlin'],
      [{ country: 'FR', city: 'Paris' }, 'Europe/Paris'],
      [{ country: 'IN', city: 'Delhi' }, 'Asia/Kolkata'],
      [{ country: 'JP', city: 'Tokyo' }, 'Asia/Tokyo'],
      [{ country: 'KR', city: 'Seoul' }, 'Asia/Seoul'],
      [{ country: 'CN', city: 'Shenzhen' }, 'Asia/Shanghai']
    ] as const;

    for (const [input, expected] of cases) {
      assert.equal(resolveCrmCustomerTimeZone(input), expected);
    }
  });

  it('does not guess multi-timezone countries without a city match', () => {
    assert.equal(resolveCrmCustomerTimeZone({ country: 'US', city: null }), null);
    assert.equal(resolveCrmCustomerTimeZone({ country: 'United States', city: 'Springfield' }), null);
  });

  it('falls back to defaults for supported single-timezone countries', () => {
    assert.equal(resolveCrmCustomerTimeZone({ country: 'AE', city: null }), 'Asia/Dubai');
    assert.equal(resolveCrmCustomerTimeZone({ country: 'UAE', city: '' }), 'Asia/Dubai');
    assert.equal(resolveCrmCustomerTimeZone({ country: 'Saudi Arabia', city: 'Unknown' }), 'Asia/Riyadh');
    assert.equal(resolveCrmCustomerTimeZone({ country: 'UK', city: null }), 'Europe/London');
  });
});
