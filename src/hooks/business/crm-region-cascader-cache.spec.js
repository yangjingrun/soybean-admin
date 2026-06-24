import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  loadCachedCrmRegionOptions,
  resetCrmRegionCascaderCacheForTest,
  searchCachedCrmRegionCities
} from './crm-region-cascader-cache';
describe('crm region cascader cache', () => {
  it('deduplicates concurrent catalog loads and reuses cached options', async () => {
    resetCrmRegionCascaderCacheForTest();
    let countryCallCount = 0;
    const cityCountryCodes = [];
    const [firstOptions, secondOptions] = await Promise.all([
      loadCachedCrmRegionOptions({
        async loadCountries() {
          countryCallCount += 1;
          return [
            { code: 'US', label: '美国', cityCount: 1 },
            { code: 'CN', label: '中国', cityCount: 1 }
          ];
        },
        async loadCities(countryCode) {
          cityCountryCodes.push(countryCode);
          return [
            {
              name: countryCode === 'US' ? 'New York' : 'Shenzhen',
              asciiName: countryCode === 'US' ? 'New York' : 'Shenzhen',
              displayName: countryCode === 'US' ? '纽约' : '深圳',
              countryCode,
              timeZone: countryCode === 'US' ? 'America/New_York' : 'Asia/Shanghai'
            }
          ];
        }
      }),
      loadCachedCrmRegionOptions({
        async loadCountries() {
          countryCallCount += 1;
          return [
            { code: 'US', label: '美国', cityCount: 1 },
            { code: 'CN', label: '中国', cityCount: 1 }
          ];
        },
        async loadCities(countryCode) {
          cityCountryCodes.push(countryCode);
          return [];
        }
      })
    ]);
    const cachedOptions = await loadCachedCrmRegionOptions({
      async loadCountries() {
        countryCallCount += 1;
        return [];
      },
      async loadCities(countryCode) {
        cityCountryCodes.push(countryCode);
        return [];
      }
    });
    assert.equal(countryCallCount, 1);
    assert.deepEqual(cityCountryCodes.sort(), ['CN', 'US']);
    assert.equal(firstOptions, secondOptions);
    assert.equal(firstOptions, cachedOptions);
    assert.equal(firstOptions[0]?.children?.[0]?.label, '纽约 / New York');
  });
  it('does not cache failed catalog loads', async () => {
    resetCrmRegionCascaderCacheForTest();
    let countryCallCount = 0;
    await assert.rejects(
      loadCachedCrmRegionOptions({
        async loadCountries() {
          countryCallCount += 1;
          throw new Error('network failed');
        },
        async loadCities() {
          return [];
        }
      })
    );
    const options = await loadCachedCrmRegionOptions({
      async loadCountries() {
        countryCallCount += 1;
        return [{ code: 'US', label: '美国', cityCount: 1 }];
      },
      async loadCities(countryCode) {
        return [
          {
            name: 'New York',
            asciiName: 'New York',
            displayName: '纽约',
            countryCode,
            timeZone: 'America/New_York'
          }
        ];
      }
    });
    assert.equal(countryCallCount, 2);
    assert.equal(options.length, 1);
  });
  it('deduplicates cached city searches by trimmed keyword', async () => {
    resetCrmRegionCascaderCacheForTest();
    let searchCallCount = 0;
    const [firstCities, secondCities] = await Promise.all([
      searchCachedCrmRegionCities(' 深圳 ', async keyword => {
        searchCallCount += 1;
        return [
          {
            name: 'Shenzhen',
            asciiName: 'Shenzhen',
            displayName: '深圳',
            countryCode: 'CN',
            timeZone: 'Asia/Shanghai'
          }
        ].filter(city => city.displayName === keyword);
      }),
      searchCachedCrmRegionCities('深圳', async () => {
        searchCallCount += 1;
        return [];
      })
    ]);
    const cachedCities = await searchCachedCrmRegionCities('深圳', async () => {
      searchCallCount += 1;
      return [];
    });
    assert.equal(searchCallCount, 1);
    assert.equal(firstCities, secondCities);
    assert.equal(firstCities, cachedCities);
    assert.equal(firstCities[0]?.displayName, '深圳');
  });
});
