import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createCrmCountryRegionOption } from './crm-region-cascader';

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

  it('keeps invalid country codes without a flag', () => {
    const option = createCrmCountryRegionOption({
      code: 'WORLD',
      label: '全球',
      cityCount: 0
    });

    assert.equal(option.flag, '');
  });
});
