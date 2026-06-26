import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createCrmAdmin1RegionOption,
  createCrmCityRegionOption,
  createCrmCountryRegionOption,
  createCrmMarketRegionOption,
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

  it('creates selectable market region options for AI lead market grouping', () => {
    const option = createCrmMarketRegionOption(
      {
        code: 'middle_east',
        label: '中东',
        aliases: ['Middle East', 'GCC'],
        countryCodes: ['SA', 'AE']
      },
      []
    );

    assert.equal(option.nodeType, 'marketRegion');
    assert.equal(option.marketRegionCode, 'middle_east');
    assert.deepEqual(getCrmRegionKeywords(String(option.value)), ['中东', 'Middle East', 'GCC', 'Gulf market']);
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

  it('uses province and state admin1 options for region filters', () => {
    const option = createCrmAdmin1RegionOption({
      countryCode: 'US',
      code: 'CA',
      name: 'California',
      asciiName: null,
      displayName: '加利福尼亚州'
    });

    assert.equal(option.nodeType, 'admin1');
    assert.equal(option.label, '加利福尼亚州 / California');
    assert.equal(filterCrmRegionOption('California', option), true);
    assert.deepEqual(getCrmRegionKeywords(String(option.value)), ['加利福尼亚州', 'California']);
  });
});
