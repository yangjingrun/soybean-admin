import { crmAdmin1Regions } from '@/constants/crm-admin1-regions';
import { createCrmAdmin1RegionOption, createCrmCountryRegionOption } from '@/utils/crm-region-cascader';
let regionCatalogCache = null;
let regionCatalogLoadingPromise = null;
/** Load and cache the CRM country -> province/state cascader tree for the current browser session. */
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
export function resetCrmRegionCascaderCacheForTest() {
  regionCatalogCache = null;
  regionCatalogLoadingPromise = null;
}
async function loadCrmRegionCatalog(loaders) {
  const admin1OptionsByCountry = groupAdmin1OptionsByCountry();
  return (await loaders.loadCountries()).map(country => ({
    ...createCrmCountryRegionOption(country),
    children: admin1OptionsByCountry.get(country.code) ?? []
  }));
}
function groupAdmin1OptionsByCountry() {
  const optionsByCountry = new Map();
  for (const region of crmAdmin1Regions) {
    const options = optionsByCountry.get(region.countryCode) ?? [];
    options.push(createCrmAdmin1RegionOption(region));
    optionsByCountry.set(region.countryCode, options);
  }
  return optionsByCountry;
}
