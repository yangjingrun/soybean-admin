import { computed, onMounted, shallowRef, toValue, watch, type MaybeRefOrGetter } from 'vue';
import type { CascaderOption } from 'naive-ui';
import { fetchCrmGeoCountries } from '@/service/api';
import { filterCrmRegionOption, type CrmRegionCascaderOption } from '@/utils/crm-region-cascader';
import { loadCachedCrmRegionOptions } from './crm-region-cascader-cache';

interface UseCrmRegionCascaderOptions {
  includeMarketRegions?: MaybeRefOrGetter<boolean | undefined>;
}

/** Load CRM geography options for reusable country/province/state cascader filters. */
export function useCrmRegionCascader(options: UseCrmRegionCascaderOptions = {}) {
  const regionOptions = shallowRef<CrmRegionCascaderOption[]>([]);
  const regionLoading = shallowRef(false);
  const displayRegionOptions = computed(() => regionOptions.value);
  const includeMarketRegions = computed(() => Boolean(toValue(options.includeMarketRegions)));
  let latestCountryRequestId = 0;

  onMounted(() => {
    void loadCountries();
  });

  watch(includeMarketRegions, () => {
    void loadCountries();
  });

  /** Load persisted countries once per browser session and attach local admin1 children. */
  async function loadCountries() {
    const requestId = latestCountryRequestId + 1;
    latestCountryRequestId = requestId;
    regionLoading.value = true;

    try {
      const options = await loadCachedCrmRegionOptions({
        loadCountries: fetchCountries,
        includeMarketRegions: includeMarketRegions.value
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
    return filterCrmRegionOption(pattern, option, path);
  }

  function clearRegionSearch() {}

  function handleRegionDropdownShow(_show: boolean) {}

  return {
    clearRegionSearch,
    filterCrmRegionOption: handleRegionFilter,
    handleRegionDropdownShow,
    regionLoading,
    regionOptions: displayRegionOptions
  };
}

async function fetchCountries() {
  const { data, error } = await fetchCrmGeoCountries();

  if (error || !data) {
    throw new Error('Failed to load CRM geo countries');
  }

  return data;
}
