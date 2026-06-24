import { computed, onMounted, shallowRef } from 'vue';
import type { CascaderOption } from 'naive-ui';
import { fetchCrmGeoCities, fetchCrmGeoCountries } from '@/service/api';
import {
  createCrmCityRegionOption,
  filterCrmRegionOption,
  type CrmRegionCascaderOption
} from '@/utils/crm-region-cascader';
import {
  hasCachedCrmRegionOptions,
  loadCachedCrmRegionOptions,
  searchCachedCrmRegionCities
} from './crm-region-cascader-cache';

const cityFetchLimit = 5000;
const citySearchLimit = 80;
const citySearchDebounceMs = 260;
/** Load CRM geography options for reusable country/city cascader filters. */
export function useCrmRegionCascader() {
  const regionOptions = shallowRef<CrmRegionCascaderOption[]>([]);
  const searchRegionOptions = shallowRef<CrmRegionCascaderOption[]>([]);
  const regionLoading = shallowRef(false);
  const displayRegionOptions = computed(() =>
    searchRegionOptions.value.length ? searchRegionOptions.value : regionOptions.value
  );
  let latestCountryRequestId = 0;
  let latestCitySearchRequestId = 0;
  let latestCitySearchPattern = '';
  let citySearchTimer: ReturnType<typeof setTimeout> | null = null;

  onMounted(() => {
    void loadCountries();
  });

  /** Load all persisted countries once per browser session and share them across component instances. */
  async function loadCountries() {
    const requestId = latestCountryRequestId + 1;
    latestCountryRequestId = requestId;
    regionLoading.value = true;

    try {
      const options = await loadCachedCrmRegionOptions({
        loadCountries: fetchCountries,
        loadCities: fetchCountryCities
      });

      if (requestId !== latestCountryRequestId) {
        return;
      }

      regionOptions.value = options;
    } catch {
      if (requestId === latestCountryRequestId) {
        regionOptions.value = [];
      }
    } finally {
      if (requestId === latestCountryRequestId) {
        regionLoading.value = false;
      }
    }
  }

  function handleRegionFilter(pattern: string, option: CascaderOption, path: CascaderOption[] = []) {
    if (!hasCachedCrmRegionOptions()) {
      queueCitySearch(pattern);
    }

    return filterCrmRegionOption(pattern, option, path);
  }

  function queueCitySearch(pattern: string) {
    const searchPattern = pattern.trim();

    if (!shouldSearchRemoteCity(searchPattern) || searchPattern === latestCitySearchPattern) {
      return;
    }

    latestCitySearchPattern = searchPattern;

    if (citySearchTimer) {
      clearTimeout(citySearchTimer);
    }

    citySearchTimer = setTimeout(() => {
      void searchCities(searchPattern);
    }, citySearchDebounceMs);
  }

  async function searchCities(keyword: string) {
    const requestId = latestCitySearchRequestId + 1;
    latestCitySearchRequestId = requestId;

    let data: Api.Crm.GeoCityOption[];

    try {
      data = await searchCachedCrmRegionCities(keyword, fetchCitySearchResults);
    } catch {
      return;
    }

    if (requestId !== latestCitySearchRequestId) {
      return;
    }

    mergeCityOptions(data);
  }

  /** Build a temporary city-search tree without mutating the fully loadable country tree. */
  function mergeCityOptions(cities: Api.Crm.GeoCityOption[]) {
    const countryOptions = new Map(regionOptions.value.map(option => [option.countryCode, option]));
    const searchCountryOptions = new Map<string, CrmRegionCascaderOption>();

    cities.forEach(city => {
      const countryOption = countryOptions.get(city.countryCode);

      if (!countryOption) {
        return;
      }

      const cityOption = createCrmCityRegionOption(city);
      const searchCountryOption =
        searchCountryOptions.get(city.countryCode) ??
        ({
          ...countryOption,
          children: []
        } satisfies CrmRegionCascaderOption);
      const children = searchCountryOption.children ?? [];

      if (!children.some(child => child.value === cityOption.value)) {
        searchCountryOption.children = [...children, cityOption];
      }

      searchCountryOptions.set(city.countryCode, searchCountryOption);
    });

    searchRegionOptions.value = Array.from(searchCountryOptions.values());
  }

  function clearRegionSearch() {
    searchRegionOptions.value = [];
    latestCitySearchPattern = '';
  }

  function handleRegionDropdownShow(show: boolean) {
    if (!show) {
      clearRegionSearch();
    }
  }

  return {
    clearRegionSearch,
    filterCrmRegionOption: handleRegionFilter,
    handleRegionDropdownShow,
    regionLoading,
    regionOptions: displayRegionOptions
  };
}

function shouldSearchRemoteCity(pattern: string) {
  return pattern.length >= 2 || /[\u4e00-\u9fff]/.test(pattern);
}

async function fetchCountries() {
  const { data, error } = await fetchCrmGeoCountries();

  if (error || !data) {
    throw new Error('Failed to load CRM geo countries');
  }

  return data;
}

async function fetchCountryCities(countryCode: string) {
  const { data, error } = await fetchCrmGeoCities({
    countryCode,
    limit: cityFetchLimit
  });

  if (error || !data) {
    throw new Error(`Failed to load CRM geo cities for ${countryCode}`);
  }

  return data;
}

async function fetchCitySearchResults(keyword: string) {
  const { data, error } = await fetchCrmGeoCities({
    keyword,
    limit: citySearchLimit
  });

  if (error || !data) {
    throw new Error('Failed to search CRM geo cities');
  }

  return data;
}
