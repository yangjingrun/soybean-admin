import { onMounted, reactive, shallowRef } from 'vue';
import { fetchCrmBlacklistEntries } from '@/service/api';
import { buildBlacklistSearchParams, createDefaultBlacklistFilterModel } from './shared';

/** Manage organization unsubscribe blacklist list requests and pagination. */
export function useBlacklistTable() {
  const records = shallowRef<Api.Crm.BlacklistRecord[]>([]);
  const loading = shallowRef(false);
  let latestRequestId = 0;

  const pagination = reactive({
    current: 1,
    size: 10,
    total: 0
  });

  const filterModel = reactive<Api.Crm.BlacklistFilterModel>(createDefaultBlacklistFilterModel());

  onMounted(() => {
    void loadBlacklistEntries();
  });

  /** Load blacklist entries with backend pagination and ignore stale responses. */
  async function loadBlacklistEntries() {
    const requestId = latestRequestId + 1;
    latestRequestId = requestId;
    loading.value = true;

    try {
      const { data, error } = await fetchCrmBlacklistEntries(
        buildBlacklistSearchParams({
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
    void loadBlacklistEntries();
  }

  function handleReset() {
    Object.assign(filterModel, createDefaultBlacklistFilterModel());
    pagination.current = 1;
    void loadBlacklistEntries();
  }

  function handlePageUpdate(page: number) {
    pagination.current = page;
    void loadBlacklistEntries();
  }

  function handlePageSizeUpdate(pageSize: number) {
    pagination.size = pageSize;
    pagination.current = 1;
    void loadBlacklistEntries();
  }

  return {
    filterModel,
    handlePageSizeUpdate,
    handlePageUpdate,
    handleReset,
    handleSearch,
    loadBlacklistEntries,
    loading,
    pagination,
    records
  };
}
