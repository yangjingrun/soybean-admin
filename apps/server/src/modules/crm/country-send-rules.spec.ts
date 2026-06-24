import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getCrmCountrySendRule, normalizeCrmSendCountry, resolveCrmSendTimezone } from './country-send-rules';

describe('CRM country send rules', () => {
  it('normalizes mapped Chinese country names to send-rule country codes', () => {
    assert.equal(normalizeCrmSendCountry('美国'), 'US');
    assert.equal(normalizeCrmSendCountry('沙特阿拉伯'), 'SA');
    assert.equal(normalizeCrmSendCountry('Taiwan'), 'TW');
  });

  it('resolves send windows and timezone defaults from mapped country names', () => {
    assert.equal(getCrmCountrySendRule('沙特阿拉伯').country, 'SA');
    assert.deepEqual(resolveCrmSendTimezone({ country: '沙特阿拉伯' }), { timeZone: 'Asia/Riyadh' });
    assert.deepEqual(resolveCrmSendTimezone({ country: '美国' }), {
      timeZone: null,
      reason: 'ambiguous_timezone'
    });
  });
});
