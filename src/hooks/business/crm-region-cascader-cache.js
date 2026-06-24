import { createCrmCityRegionOption, createCrmCountryRegionOption } from '@/utils/crm-region-cascader';
const cityLoadConcurrency = 4;
let regionCatalogCache = null;
let regionCatalogLoadingPromise = null;
const citySearchCache = new Map();
const citySearchLoadingPromises = new Map();
/** Load and cache the full CRM region cascader tree for the current browser session. */
export async function loadCachedCrmRegionOptions(loaders) {
  if (regionCatalogCache) {
    return regionCatalogCache;
  }
  if (!regionCatalogLoadingPromise) {
    regionCatalogLoadingPromise = loadCrmRegionCatalog(loaders);
  }
  try {
    regionCatalogCache = await regionCatalogLoadingPromise;
    return regionCatalogCache;
  } finally {
    regionCatalogLoadingPromise = null;
  }
}
/** Whether the full in-memory region tree is already available. */
export function hasCachedCrmRegionOptions() {
  return Boolean(regionCatalogCache);
}
/** Cache remote city keyword searches to avoid repeated identical server calls while typing. */
export async function searchCachedCrmRegionCities(keyword, loadCities) {
  const searchKeyword = keyword.trim();
  if (citySearchCache.has(searchKeyword)) {
    return citySearchCache.get(searchKeyword) ?? [];
  }
  const loadingPromise = citySearchLoadingPromises.get(searchKeyword) ?? loadCities(searchKeyword);
  citySearchLoadingPromises.set(searchKeyword, loadingPromise);
  try {
    const cities = await loadingPromise;
    citySearchCache.set(searchKeyword, cities);
    return cities;
  } finally {
    citySearchLoadingPromises.delete(searchKeyword);
  }
}
export function resetCrmRegionCascaderCacheForTest() {
  regionCatalogCache = null;
  regionCatalogLoadingPromise = null;
  citySearchCache.clear();
  citySearchLoadingPromises.clear();
}
async function loadCrmRegionCatalog(loaders) {
  const countryOptions = (await loaders.loadCountries()).map(createCrmCountryRegionOption);
  let cursor = 0;
  async function runWorker() {
    while (cursor < countryOptions.length) {
      const option = countryOptions[cursor];
      cursor += 1;
      if (option) {
        const cities = await loaders.loadCities(option.countryCode);
        option.children = cities.map(createCrmCityRegionOption);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(cityLoadConcurrency, countryOptions.length) }, () => runWorker()));
  return countryOptions;
}
