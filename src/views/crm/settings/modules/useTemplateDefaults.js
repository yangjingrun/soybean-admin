import { onMounted, shallowRef } from 'vue';
import { fetchCrmTemplateDefaults } from '@/service/api';
/** Load read-only CRM default template rules for the settings page. */
export function useTemplateDefaults() {
  const loading = shallowRef(false);
  const templateDefaults = shallowRef(null);
  async function loadTemplateDefaults() {
    if (loading.value) return;
    loading.value = true;
    try {
      const { data, error } = await fetchCrmTemplateDefaults();
      if (!error) {
        templateDefaults.value = data;
      }
    } finally {
      loading.value = false;
    }
  }
  onMounted(() => {
    void loadTemplateDefaults();
  });
  return {
    loadTemplateDefaults,
    loading,
    templateDefaults
  };
}
