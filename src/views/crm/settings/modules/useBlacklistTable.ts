import { computed, onMounted, reactive, shallowRef } from 'vue';
import { useMessage } from 'naive-ui';
import { hasPermission } from '@soybean/shared';
import { fetchCrmBlacklistEntries, removeCrmBlacklistEntry } from '@/service/api';
import { useAuthStore } from '@/store/modules/auth';
import { buildBlacklistSearchParams, createDefaultBlacklistFilterModel } from './shared';

/** Manage organization unsubscribe blacklist list requests and pagination. */
export function useBlacklistTable() {
  const message = useMessage();
  const authStore = useAuthStore();
  const records = shallowRef<Api.Crm.BlacklistRecord[]>([]);
  const loading = shallowRef(false);
  const removeModalVisible = shallowRef(false);
  const removeSubmitting = shallowRef(false);
  const removingRecord = shallowRef<Api.Crm.BlacklistRecord | null>(null);
  const removeFormModel = reactive<Api.Crm.BlacklistRemovePayload>({
    reason: ''
  });
  let latestRequestId = 0;

  const pagination = reactive({
    current: 1,
    size: 10,
    total: 0
  });

  const filterModel = reactive<Api.Crm.BlacklistFilterModel>(createDefaultBlacklistFilterModel());
  const canRemove = computed(() => hasPermission(authStore.userInfo, 'crm:settings:safety:write'));

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

  function openRemoveModal(record: Api.Crm.BlacklistRecord) {
    if (!canRemove.value) {
      return;
    }

    removingRecord.value = record;
    removeFormModel.reason = '';
    removeModalVisible.value = true;
  }

  function handleRemoveModalVisibleUpdate(show: boolean) {
    removeModalVisible.value = show;

    if (!show) {
      removingRecord.value = null;
      removeFormModel.reason = '';
    }
  }

  /** Remove one blacklist entry with an explicit audit reason, then refresh the list. */
  async function handleRemoveBlacklistEntry() {
    const reason = removeFormModel.reason.trim();
    const record = removingRecord.value;

    if (!record || !canRemove.value) return;

    if (!reason) {
      message.warning('请输入解除原因');
      return;
    }

    removeSubmitting.value = true;

    try {
      const { error } = await removeCrmBlacklistEntry(record.id, { reason });

      if (error) {
        return;
      }

      message.success('黑名单已解除');
      handleRemoveModalVisibleUpdate(false);
      await loadBlacklistEntries();
    } finally {
      removeSubmitting.value = false;
    }
  }

  return {
    canRemove,
    filterModel,
    handlePageSizeUpdate,
    handlePageUpdate,
    handleReset,
    handleRemoveBlacklistEntry,
    handleRemoveModalVisibleUpdate,
    handleSearch,
    loadBlacklistEntries,
    loading,
    pagination,
    openRemoveModal,
    removeFormModel,
    removeModalVisible,
    removeSubmitting,
    removingRecord,
    records
  };
}
