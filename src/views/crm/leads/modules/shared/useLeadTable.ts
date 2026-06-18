import { onMounted, reactive, shallowRef } from 'vue';
import { fetchCrmAccounts } from '@/service/api';
import { buildLeadSearchParams, createDefaultLeadFilterModel } from '../shared';

/** Manage CRM lead list request state, pagination and current-page derived stats. */
export function useLeadTable() {
  const records = shallowRef<Api.Crm.LeadRecord[]>([]);
  const loading = shallowRef(false);
  let latestRequestId = 0;

  const pagination = reactive({
    current: 1,
    size: 10,
    total: 0
  });

  const filterModel = reactive<Api.Crm.LeadFilterModel>(createDefaultLeadFilterModel());

  onMounted(() => {
    void loadLeads();
  });

  /** Load CRM account leads with backend pagination. */
  async function loadLeads() {
    const requestId = latestRequestId + 1;
    latestRequestId = requestId;
    loading.value = true;

    try {
      const { data, error } = await fetchCrmAccounts(
        buildLeadSearchParams({
          current: pagination.current,
          size: pagination.size,
          filterModel
        })
      );

      if (error) {
        return;
      }

      if (requestId !== latestRequestId) {
        return;
      }

      records.value = data.records;
      pagination.current = data.current;
      pagination.size = data.size;
      pagination.total = data.total;
    } finally {
      if (requestId === latestRequestId) {
        loading.value = false;
      }
    }
  }

  function handleSearch() {
    pagination.current = 1;
    void loadLeads();
  }

  function handleReset() {
    Object.assign(filterModel, createDefaultLeadFilterModel());
    pagination.current = 1;
    void loadLeads();
  }

  function handlePageUpdate(page: number) {
    pagination.current = page;
    void loadLeads();
  }

  function handlePageSizeUpdate(pageSize: number) {
    pagination.size = pageSize;
    pagination.current = 1;
    void loadLeads();
  }

  return {
    filterModel,
    handlePageSizeUpdate,
    handlePageUpdate,
    handleReset,
    handleSearch,
    loadLeads,
    loading,
    pagination,
    records
  };
}
