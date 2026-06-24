import { computed, onMounted, shallowRef } from 'vue';
import type { CascaderOption } from 'naive-ui';
import { fetchCrmGeoCities, fetchCrmGeoCountries } from '@/service/api';
import {
  createCrmCityRegionOption,
  createCrmCountryRegionOption,
  filterCrmRegionOption,
  type CrmRegionCascaderOption
} from '@/utils/crm-region-cascader';

const cityFetchLimit = 5000;
const citySearchLimit = 80;
const citySearchDebounceMs = 260;
const cityLoadConcurrency = 4;
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

  /** Load all persisted countries once; cities are loaded lazily per country. */
  async function loadCountries() {
    const requestId = latestCountryRequestId + 1;
    latestCountryRequestId = requestId;
    regionLoading.value = true;

    try {
      const { data, error } = await fetchCrmGeoCountries();

      if (error || !data || requestId !== latestCountryRequestId) {
        return;
      }

      regionOptions.value = data.map(createCrmCountryRegionOption);
      await loadAllCountryCities(regionOptions.value);
    } finally {
      if (requestId === latestCountryRequestId) {
        regionLoading.value = false;
      }
    }
  }

  /** Load every country's city children so hover expansion can stay native and immediate. */
  async function loadCountryCities(regionOption: CrmRegionCascaderOption) {
    const { data, error } = await fetchCrmGeoCities({
      countryCode: regionOption.countryCode,
      limit: cityFetchLimit
    });

    if (error || !data) {
      return;
    }

    regionOption.children = data.map(createCrmCityRegionOption);
  }

  async function loadAllCountryCities(countryOptions: CrmRegionCascaderOption[]) {
    let cursor = 0;

    async function runWorker() {
      while (cursor < countryOptions.length) {
        const option = countryOptions[cursor];
        cursor += 1;

        if (option) {
          await loadCountryCities(option);
        }
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(cityLoadConcurrency, countryOptions.length) }, () => runWorker())
    );
    regionOptions.value = [...countryOptions];
  }

  function handleRegionFilter(pattern: string, option: CascaderOption, path: CascaderOption[] = []) {
    queueCitySearch(pattern);

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

    const { data, error } = await fetchCrmGeoCities({
      keyword,
      limit: citySearchLimit
    });

    if (error || !data || requestId !== latestCitySearchRequestId) {
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
