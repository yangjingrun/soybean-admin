import { computed, ref, watch } from 'vue';
import { fetchCrmGeoCities, fetchCrmGeoCountries } from '@/service/api';
/** Manage country/city cascading options for the lead import form. */
export function useLeadLocationOptions(formModel, visible) {
  const countryLoading = ref(false);
  const cityLoading = ref(false);
  const countryOptions = ref([]);
  const cityOptions = ref([]);
  const selectedCountryCode = ref(null);
  const hasSelectedCountry = computed(() => Boolean(selectedCountryCode.value));
  watch(
    () => visible.value,
    show => {
      if (!show) return;
      void loadCountries();
    }
  );
  watch(
    () => formModel.value.country,
    () => {
      if (!visible.value) return;
      syncSelectedCountry();
    }
  );
  /** Load country options from backend persisted GeoNames dictionary rows. */
  async function loadCountries() {
    if (countryOptions.value.length > 0) {
      syncSelectedCountry();
      return;
    }
    countryLoading.value = true;
    const { data, error } = await fetchCrmGeoCountries();
    countryLoading.value = false;
    if (error || !data) {
      return;
    }
    countryOptions.value = data.map(country => ({
      label: country.label,
      value: country.code,
      raw: country
    }));
    syncSelectedCountry();
  }
  /** Load cities for the selected country; keyword is provided by remote select search. */
  async function loadCities(keyword) {
    if (!selectedCountryCode.value) {
      cityOptions.value = [];
      return;
    }
    cityLoading.value = true;
    const { data, error } = await fetchCrmGeoCities({
      countryCode: selectedCountryCode.value,
      keyword,
      limit: 80
    });
    cityLoading.value = false;
    if (error || !data) {
      return;
    }
    cityOptions.value = data.map(city => ({
      label: city.asciiName && city.asciiName !== city.name ? `${city.name} / ${city.asciiName}` : city.name,
      value: city.name,
      raw: city
    }));
  }
  /** Keep form country as display text while the select internally tracks ISO code. */
  function handleCountryChange(countryCode) {
    selectedCountryCode.value = countryCode;
    const option = countryOptions.value.find(item => item.value === countryCode);
    formModel.value.country = option?.label ?? '';
    formModel.value.city = '';
    formModel.value.timeZone = '';
    cityOptions.value = [];
    if (countryCode) {
      void loadCities();
    }
  }
  /** Persist selected city; backend resolves timezone from country and city. */
  function handleCityChange(cityName) {
    formModel.value.city = cityName ?? '';
  }
  function syncSelectedCountry() {
    const country = formModel.value.country.trim().toLowerCase();
    if (!country) {
      selectedCountryCode.value = null;
      cityOptions.value = [];
      return;
    }
    const option = countryOptions.value.find(
      item => item.value.toLowerCase() === country || item.label.toLowerCase() === country
    );
    if (!option || option.value === selectedCountryCode.value) {
      return;
    }
    selectedCountryCode.value = option.value;
    void loadCities(formModel.value.city);
  }
  return {
    countryLoading,
    cityLoading,
    countryOptions,
    cityOptions,
    selectedCountryCode,
    hasSelectedCountry,
    loadCities,
    handleCountryChange,
    handleCityChange
  };
}
