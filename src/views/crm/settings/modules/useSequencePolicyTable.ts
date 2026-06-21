import { computed, onMounted, reactive, shallowRef } from 'vue';
import { useMessage } from 'naive-ui';
import { hasPermission } from '@soybean/shared';
import {
  archiveCrmSequencePolicy,
  createCrmSequencePolicy,
  fetchCrmSequencePolicies,
  setDefaultCrmSequencePolicy,
  updateCrmSequencePolicy
} from '@/service/api';
import { useAuthStore } from '@/store/modules/auth';
import {
  buildSequencePolicySearchParams,
  createDefaultSequencePolicyFilterModel,
  createDefaultSequencePolicyForm,
  createSequencePolicyFormFromRecord,
  normalizeSequencePolicyPayload
} from './shared';

/** Manage organization sequence policy requests, form modal state and row operations. */
export function useSequencePolicyTable() {
  const message = useMessage();
  const authStore = useAuthStore();
  const records = shallowRef<Api.Crm.SequencePolicyRecord[]>([]);
  const loading = shallowRef(false);
  const formVisible = shallowRef(false);
  const submitting = shallowRef(false);
  const operatingPolicyId = shallowRef<string | null>(null);
  const editingPolicyId = shallowRef<string | null>(null);
  let latestRequestId = 0;

  const pagination = reactive({
    current: 1,
    size: 10,
    total: 0
  });

  const filterModel = reactive<Api.Crm.SequencePolicyFilterModel>(createDefaultSequencePolicyFilterModel());
  const formModel = reactive<Api.Crm.SequencePolicyFormModel>(createDefaultSequencePolicyForm());
  const canManage = computed(() => hasPermission(authStore.userInfo, 'crm:settings:rules:write'));

  onMounted(() => {
    void loadSequencePolicies();
  });

  /** Load sequence policies with backend pagination and ignore stale responses. */
  async function loadSequencePolicies() {
    const requestId = latestRequestId + 1;
    latestRequestId = requestId;
    loading.value = true;

    try {
      const { data, error } = await fetchCrmSequencePolicies(
        buildSequencePolicySearchParams({
          current: pagination.current,
          size: pagination.size,
          filterModel
        })
      );

      if (error || requestId !== latestRequestId) {
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

    editingPolicyId.value = null;
    Object.assign(formModel, createDefaultSequencePolicyForm());
    formVisible.value = true;
  }

  function openEditModal(record: Api.Crm.SequencePolicyRecord) {
    if (!canManage.value) {
      return;
    }

    editingPolicyId.value = record.id;
    Object.assign(formModel, createSequencePolicyFormFromRecord(record));
    formVisible.value = true;
  }

  function handleFormVisibleUpdate(show: boolean) {
    formVisible.value = show;

    if (!show) {
      editingPolicyId.value = null;
      Object.assign(formModel, createDefaultSequencePolicyForm());
    }
  }

  /** Create or update the current sequence policy form, then refresh the list. */
  async function handleSubmitSequencePolicy() {
    if (!canManage.value) {
      return;
    }

    submitting.value = true;

    try {
      const payload = normalizeSequencePolicyPayload(formModel);
      const isEdit = Boolean(editingPolicyId.value);
      const { error } = editingPolicyId.value
        ? await updateCrmSequencePolicy(editingPolicyId.value, payload)
        : await createCrmSequencePolicy(payload);

      if (error) {
        return;
      }

      message.success(editingPolicyId.value ? '序列策略已更新' : '序列策略已新增');
      formVisible.value = false;
      editingPolicyId.value = null;
      Object.assign(formModel, createDefaultSequencePolicyForm());

      if (!isEdit) {
        pagination.current = 1;
      }

      await loadSequencePolicies();
    } finally {
      submitting.value = false;
    }
  }

  /** Archive one active sequence policy and refresh the list. */
  async function handleArchiveSequencePolicy(record: Api.Crm.SequencePolicyRecord) {
    if (!canManage.value || operatingPolicyId.value || record.status === 'archived') {
      return;
    }

    operatingPolicyId.value = record.id;

    try {
      const { error } = await archiveCrmSequencePolicy(record.id);

      if (error) {
        return;
      }

      message.success('序列策略已归档');
      await loadSequencePolicies();
    } finally {
      operatingPolicyId.value = null;
    }
  }

  /** Mark one active sequence policy as the organization default. */
  async function handleSetDefaultSequencePolicy(record: Api.Crm.SequencePolicyRecord) {
    if (!canManage.value || operatingPolicyId.value || record.status !== 'active' || record.isDefault) {
      return;
    }

    operatingPolicyId.value = record.id;

    try {
      const { error } = await setDefaultCrmSequencePolicy(record.id);

      if (error) {
        return;
      }

      message.success('默认序列策略已更新');
      await loadSequencePolicies();
    } finally {
      operatingPolicyId.value = null;
    }
  }

  function handleSearch() {
    pagination.current = 1;
    void loadSequencePolicies();
  }

  function handleReset() {
    Object.assign(filterModel, createDefaultSequencePolicyFilterModel());
    pagination.current = 1;
    void loadSequencePolicies();
  }

  function handlePageUpdate(page: number) {
    pagination.current = page;
    void loadSequencePolicies();
  }

  function handlePageSizeUpdate(pageSize: number) {
    pagination.size = pageSize;
    pagination.current = 1;
    void loadSequencePolicies();
  }

  return {
    canManage,
    editingPolicyId,
    filterModel,
    formModel,
    formVisible,
    handleArchiveSequencePolicy,
    handleFormVisibleUpdate,
    handlePageSizeUpdate,
    handlePageUpdate,
    handleReset,
    handleSearch,
    handleSetDefaultSequencePolicy,
    handleSubmitSequencePolicy,
    loadSequencePolicies,
    loading,
    openCreateModal,
    openEditModal,
    operatingPolicyId,
    pagination,
    records,
    submitting
  };
}
