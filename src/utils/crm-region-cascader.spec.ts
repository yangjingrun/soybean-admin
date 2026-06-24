import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createCrmCityRegionOption,
  createCrmCountryRegionOption,
  filterCrmRegionOption,
  getCrmRegionKeywords
} from './crm-region-cascader';

describe('crm region cascader helpers', () => {
  it('adds regional indicator flag to country options', () => {
    const option = createCrmCountryRegionOption({
      code: 'US',
      label: '美国',
      cityCount: 120
    });

    assert.equal(option.flag, '🇺🇸');
    assert.equal(option.label, '美国');
  });

  it('matches country options by localized names and ISO code', () => {
    const option = createCrmCountryRegionOption({
      code: 'US',
      label: '美国',
      cityCount: 120
    });

    assert.equal(filterCrmRegionOption('美国', option), true);
    assert.equal(filterCrmRegionOption('United States', option), true);
    assert.equal(filterCrmRegionOption('US', option), true);
  });

  it('keeps invalid country codes without a flag', () => {
    const option = createCrmCountryRegionOption({
      code: 'WORLD',
      label: '全球',
      cityCount: 0
    });

    assert.equal(option.flag, '');
  });

  it('uses localized city display names without losing original keywords', () => {
    const option = createCrmCityRegionOption({
      name: 'New York',
      asciiName: 'New York',
      displayName: '纽约',
      countryCode: 'US',
      timeZone: 'America/New_York'
    });

    assert.equal(option.label, '纽约 / New York');
    assert.deepEqual(option.keywords, ['纽约', 'New York']);
    assert.deepEqual(getCrmRegionKeywords(String(option.value)), ['纽约', 'New York']);
  });
});
