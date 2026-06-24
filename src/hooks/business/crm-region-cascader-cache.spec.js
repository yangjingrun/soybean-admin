import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadCachedCrmRegionOptions, resetCrmRegionCascaderCacheForTest } from './crm-region-cascader-cache';
describe('crm region cascader cache', () => {
  it('deduplicates concurrent catalog loads and attaches admin1 children', async () => {
    resetCrmRegionCascaderCacheForTest();
    let countryCallCount = 0;
    const [firstOptions, secondOptions] = await Promise.all([
      loadCachedCrmRegionOptions({
        async loadCountries() {
          countryCallCount += 1;
          return [
            { code: 'US', label: '美国', cityCount: 1 },
            { code: 'CN', label: '中国', cityCount: 1 }
          ];
        }
      }),
      loadCachedCrmRegionOptions({
        async loadCountries() {
          countryCallCount += 1;
          return [];
        }
      })
    ]);
    const cachedOptions = await loadCachedCrmRegionOptions({
      async loadCountries() {
        countryCallCount += 1;
        return [];
      }
    });
    const usOption = firstOptions.find(option => option.countryCode === 'US');
    const chinaOption = firstOptions.find(option => option.countryCode === 'CN');
    assert.equal(countryCallCount, 1);
    assert.equal(firstOptions, secondOptions);
    assert.equal(firstOptions, cachedOptions);
    assert.equal(
      usOption?.children?.some(option => option.label.includes('California')),
      true
    );
    assert.equal(
      chinaOption?.children?.some(option => option.label.includes('广东')),
      true
    );
  });
  it('does not cache failed catalog loads', async () => {
    resetCrmRegionCascaderCacheForTest();
    let countryCallCount = 0;
    await assert.rejects(
      loadCachedCrmRegionOptions({
        async loadCountries() {
          countryCallCount += 1;
          throw new Error('network failed');
        }
      })
    );
    const options = await loadCachedCrmRegionOptions({
      async loadCountries() {
        countryCallCount += 1;
        return [{ code: 'US', label: '美国', cityCount: 1 }];
      }
    });
    assert.equal(countryCallCount, 2);
    assert.equal(options.length, 1);
  });
});
