import { computed, onMounted, reactive, shallowRef } from 'vue';
import { useMessage } from 'naive-ui';
import { hasPermission } from '@soybean/shared';
import { archiveCrmProductLine, createCrmProductLine, fetchCrmProductLines, updateCrmProductLine } from '@/service/api';
import { useAuthStore } from '@/store/modules/auth';
import {
  buildProductLineSearchParams,
  createDefaultProductLineFilterModel,
  createDefaultProductLineForm,
  createProductLineFormFromRecord,
  normalizeProductLinePayload
} from './shared';

/** Manage organization product line list requests, form modal state and row operations. */
export function useProductLineTable() {
  const message = useMessage();
  const authStore = useAuthStore();
  const records = shallowRef<Api.Crm.ProductLineRecord[]>([]);
  const loading = shallowRef(false);
  const formVisible = shallowRef(false);
  const submitting = shallowRef(false);
  const operatingProductLineId = shallowRef<string | null>(null);
  const editingProductLineId = shallowRef<string | null>(null);
  const editingProductLineRecord = shallowRef<Api.Crm.ProductLineRecord | null>(null);
  const promptHistoryVisible = shallowRef(false);
  let latestRequestId = 0;

  const pagination = reactive({
    current: 1,
    size: 10,
    total: 0
  });

  const filterModel = reactive<Api.Crm.ProductLineFilterModel>(createDefaultProductLineFilterModel());
  const formModel = reactive<Api.Crm.ProductLineFormModel>(createDefaultProductLineForm());
  const canManage = computed(() => hasPermission(authStore.userInfo, 'crm:settings:assets:write'));
  const canManageAiWritingConfig = canManage;

  onMounted(() => {
    void loadProductLines();
  });

  /** Load product lines with backend pagination and ignore stale responses. */
  async function loadProductLines() {
    const requestId = latestRequestId + 1;
    latestRequestId = requestId;
    loading.value = true;

    try {
      const { data, error } = await fetchCrmProductLines(
        buildProductLineSearchParams({
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

  function openCreateModal() {
    if (!canManage.value) {
      return;
    }

    editingProductLineId.value = null;
    editingProductLineRecord.value = null;
    promptHistoryVisible.value = false;
    Object.assign(formModel, createDefaultProductLineForm());
    formVisible.value = true;
  }

  function openEditModal(record: Api.Crm.ProductLineRecord) {
    if (!canManage.value) {
      return;
    }

    editingProductLineId.value = record.id;
    editingProductLineRecord.value = record;
    Object.assign(formModel, createProductLineFormFromRecord(record));
    formVisible.value = true;
  }

  function openPromptHistoryDrawer() {
    if (!editingProductLineId.value) {
      return;
    }

    promptHistoryVisible.value = true;
  }

  function handleFormVisibleUpdate(show: boolean) {
    formVisible.value = show;

    if (!show) {
      editingProductLineId.value = null;
      editingProductLineRecord.value = null;
      promptHistoryVisible.value = false;
      Object.assign(formModel, createDefaultProductLineForm());
    }
  }

  function handlePromptHistoryVisibleUpdate(show: boolean) {
    promptHistoryVisible.value = show;
  }

  /** Apply the restored backend product line to both the open form and current table page. */
  function handlePromptVersionRestored(productLine: Api.Crm.ProductLineRecord) {
    if (productLine.id !== editingProductLineId.value) {
      return;
    }

    editingProductLineRecord.value = productLine;
    Object.assign(formModel, createProductLineFormFromRecord(productLine));
    records.value = records.value.map(record => (record.id === productLine.id ? productLine : record));
  }

  /** Create or update the current product line form, then refresh the list. */
  async function handleSubmitProductLine() {
    if (!canManage.value) {
      return;
    }

    submitting.value = true;

    try {
      const payload = normalizeProductLinePayload(formModel);
      const isEdit = Boolean(editingProductLineId.value);

      if (isEdit && !canManageAiWritingConfig.value) {
        delete (payload as Partial<Api.Crm.ProductLinePayload>).aiWritingConfig;
      }

      const { error } = editingProductLineId.value
        ? await updateCrmProductLine(editingProductLineId.value, payload)
        : await createCrmProductLine(payload);

      if (error) {
        return;
      }

      message.success(editingProductLineId.value ? '产品线已更新' : '产品线已新增');
      formVisible.value = false;
      editingProductLineId.value = null;
      Object.assign(formModel, createDefaultProductLineForm());

      if (!isEdit) {
        pagination.current = 1;
      }

      await loadProductLines();
    } finally {
      submitting.value = false;
    }
  }

  /** Archive one active product line, then refresh the current list. */
  async function handleArchiveProductLine(record: Api.Crm.ProductLineRecord) {
    if (!canManage.value || operatingProductLineId.value || record.status === 'archived') {
      return;
    }

    operatingProductLineId.value = record.id;

    try {
      const { error } = await archiveCrmProductLine(record.id);

      if (error) {
        return;
      }

      message.success('产品线已归档');
      await loadProductLines();
    } finally {
      operatingProductLineId.value = null;
    }
  }

  function handleSearch() {
    pagination.current = 1;
    void loadProductLines();
  }

  function handleReset() {
    Object.assign(filterModel, createDefaultProductLineFilterModel());
    pagination.current = 1;
    void loadProductLines();
  }

  function handlePageUpdate(page: number) {
    pagination.current = page;
    void loadProductLines();
  }

  function handlePageSizeUpdate(pageSize: number) {
    pagination.size = pageSize;
    pagination.current = 1;
    void loadProductLines();
  }

  return {
    editingProductLineId,
    editingProductLineRecord,
    filterModel,
    formModel,
    formVisible,
    handleArchiveProductLine,
    handleFormVisibleUpdate,
    handlePageSizeUpdate,
    handlePageUpdate,
    handlePromptHistoryVisibleUpdate,
    handlePromptVersionRestored,
    handleReset,
    handleSearch,
    handleSubmitProductLine,
    canManageAiWritingConfig,
    canManage,
    loadProductLines,
    loading,
    openCreateModal,
    openEditModal,
    openPromptHistoryDrawer,
    operatingProductLineId,
    pagination,
    promptHistoryVisible,
    records,
    submitting
  };
}
