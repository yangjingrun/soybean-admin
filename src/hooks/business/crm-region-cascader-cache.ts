import { crmAdmin1Regions } from '@/constants/crm-admin1-regions';
import {
  crmMarketRegions,
  crmUnclassifiedMarketRegion,
  resolveCrmMarketRegionByCountryCode
} from '@/constants/crm-market-regions';
import {
  createCrmAdmin1RegionOption,
  createCrmCountryRegionOption,
  createCrmMarketRegionOption,
  type CrmRegionCascaderOption
} from '@/utils/crm-region-cascader';

interface CrmRegionCatalogLoaders {
  loadCountries: () => Promise<Api.Crm.GeoCountryOption[]>;
  includeMarketRegions?: boolean;
}

const regionCatalogCache = new Map<string, CrmRegionCascaderOption[]>();
const regionCatalogLoadingPromise = new Map<string, Promise<CrmRegionCascaderOption[]>>();

/** Load and cache the CRM country -> province/state cascader tree for the current browser session. */
export async function loadCachedCrmRegionOptions(loaders: CrmRegionCatalogLoaders) {
  const cacheKey = getRegionCatalogCacheKey(loaders.includeMarketRegions);
  const cachedOptions = regionCatalogCache.get(cacheKey);

  if (cachedOptions) {
    return cachedOptions;
  }

  if (!regionCatalogLoadingPromise.has(cacheKey)) {
    regionCatalogLoadingPromise.set(cacheKey, loadCrmRegionCatalog(loaders));
  }

  try {
    const options = await regionCatalogLoadingPromise.get(cacheKey)!;

    regionCatalogCache.set(cacheKey, options);

    return options;
  } finally {
    regionCatalogLoadingPromise.delete(cacheKey);
  }
}

export function resetCrmRegionCascaderCacheForTest() {
  regionCatalogCache.clear();
  regionCatalogLoadingPromise.clear();
}

async function loadCrmRegionCatalog(loaders: CrmRegionCatalogLoaders) {
  const admin1OptionsByCountry = groupAdmin1OptionsByCountry();
  const countryOptions = (await loaders.loadCountries()).map(country => ({
    ...createCrmCountryRegionOption(country),
    children: admin1OptionsByCountry.get(country.code) ?? []
  }));

  return loaders.includeMarketRegions ? groupCountryOptionsByMarketRegion(countryOptions) : countryOptions;
}

function groupCountryOptionsByMarketRegion(countryOptions: CrmRegionCascaderOption[]) {
  const optionsByMarketCode = new Map<string, CrmRegionCascaderOption[]>();
  const unclassifiedOptions: CrmRegionCascaderOption[] = [];

  for (const countryOption of countryOptions) {
    const marketRegion = resolveCrmMarketRegionByCountryCode(countryOption.countryCode);

    if (!marketRegion) {
      unclassifiedOptions.push(countryOption);
      continue;
    }

    const options = optionsByMarketCode.get(marketRegion.code) ?? [];

    options.push(countryOption);
    optionsByMarketCode.set(marketRegion.code, options);
  }

  const marketOptions = crmMarketRegions.flatMap(region => {
    const children = optionsByMarketCode.get(region.code) ?? [];

    return children.length ? [createCrmMarketRegionOption(region, children)] : [];
  });

  return unclassifiedOptions.length
    ? [...marketOptions, createCrmMarketRegionOption(crmUnclassifiedMarketRegion, unclassifiedOptions)]
    : marketOptions;
}

function groupAdmin1OptionsByCountry() {
  const optionsByCountry = new Map<string, CrmRegionCascaderOption[]>();

  for (const region of crmAdmin1Regions) {
    const options = optionsByCountry.get(region.countryCode) ?? [];

    options.push(createCrmAdmin1RegionOption(region));
    optionsByCountry.set(region.countryCode, options);
  }

  return optionsByCountry;
}

function getRegionCatalogCacheKey(includeMarketRegions: boolean | undefined) {
  return includeMarketRegions ? 'market' : 'country';
}
