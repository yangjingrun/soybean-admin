import { computed, onMounted, reactive, shallowRef } from 'vue';
import { useMessage } from 'naive-ui';
import { hasPermission } from '@soybean/shared';
import {
  archiveCrmPersonaProfile,
  createCrmPersonaProfile,
  fetchCrmPersonaProfiles,
  setDefaultCrmPersonaProfile,
  updateCrmPersonaProfile
} from '@/service/api';
import { useAuthStore } from '@/store/modules/auth';
import {
  buildPersonaProfileSearchParams,
  createDefaultPersonaProfileFilterModel,
  createDefaultPersonaProfileForm,
  createPersonaProfileFormFromRecord,
  normalizePersonaProfilePayload
} from './shared';

/** Manage organization persona profile list requests, modal state and row operations. */
export function usePersonaProfileTable() {
  const message = useMessage();
  const authStore = useAuthStore();
  const records = shallowRef<Api.Crm.PersonaProfileRecord[]>([]);
  const loading = shallowRef(false);
  const formVisible = shallowRef(false);
  const submitting = shallowRef(false);
  const operatingPersonaProfileId = shallowRef<string | null>(null);
  const editingPersonaProfileId = shallowRef<string | null>(null);
  let latestRequestId = 0;

  const canManage = computed(() => hasPermission(authStore.userInfo, 'crm:settings:assets:write'));

  const pagination = reactive({
    current: 1,
    size: 10,
    total: 0
  });

  const filterModel = reactive<Api.Crm.PersonaProfileFilterModel>(createDefaultPersonaProfileFilterModel());
  const formModel = reactive<Api.Crm.PersonaProfileFormModel>(createDefaultPersonaProfileForm());

  onMounted(() => {
    void loadPersonaProfiles();
  });

  /** Load persona profiles with backend pagination and ignore stale responses. */
  async function loadPersonaProfiles() {
    const requestId = latestRequestId + 1;
    latestRequestId = requestId;
    loading.value = true;

    try {
      const { data, error } = await fetchCrmPersonaProfiles(
        buildPersonaProfileSearchParams({
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

    editingPersonaProfileId.value = null;
    Object.assign(formModel, createDefaultPersonaProfileForm());
    formVisible.value = true;
  }

  function openEditModal(record: Api.Crm.PersonaProfileRecord) {
    if (!canManage.value) {
      return;
    }

    editingPersonaProfileId.value = record.id;
    Object.assign(formModel, createPersonaProfileFormFromRecord(record));
    formVisible.value = true;
  }

  function handleFormVisibleUpdate(show: boolean) {
    formVisible.value = show;

    if (!show) {
      editingPersonaProfileId.value = null;
      Object.assign(formModel, createDefaultPersonaProfileForm());
    }
  }

  /** Create or update the current persona profile form, then refresh the list. */
  async function handleSubmitPersonaProfile() {
    if (!canManage.value) {
      return;
    }

    submitting.value = true;

    try {
      const payload = normalizePersonaProfilePayload(formModel);
      const isEdit = Boolean(editingPersonaProfileId.value);
      const { error } = editingPersonaProfileId.value
        ? await updateCrmPersonaProfile(editingPersonaProfileId.value, payload)
        : await createCrmPersonaProfile(payload);

      if (error) {
        return;
      }

      message.success(editingPersonaProfileId.value ? '画像已更新' : '画像已新增');
      formVisible.value = false;
      editingPersonaProfileId.value = null;
      Object.assign(formModel, createDefaultPersonaProfileForm());

      if (!isEdit) {
        pagination.current = 1;
      }

      await loadPersonaProfiles();
    } finally {
      submitting.value = false;
    }
  }

  /** Archive one active persona profile, then refresh the current list. */
  async function handleArchivePersonaProfile(record: Api.Crm.PersonaProfileRecord) {
    if (!canManage.value || operatingPersonaProfileId.value || record.status === 'archived') {
      return;
    }

    operatingPersonaProfileId.value = record.id;

    try {
      const { error } = await archiveCrmPersonaProfile(record.id);

      if (error) {
        return;
      }

      message.success('画像已归档');
      await loadPersonaProfiles();
    } finally {
      operatingPersonaProfileId.value = null;
    }
  }

  /** Set one active profile as the organization default drafting persona. */
  async function handleSetDefaultPersonaProfile(record: Api.Crm.PersonaProfileRecord) {
    if (!canManage.value || operatingPersonaProfileId.value || record.status !== 'active' || record.isDefault) {
      return;
    }

    operatingPersonaProfileId.value = record.id;

    try {
      const { error } = await setDefaultCrmPersonaProfile(record.id);

      if (error) {
        return;
      }

      message.success('默认画像已更新');
      await loadPersonaProfiles();
    } finally {
      operatingPersonaProfileId.value = null;
    }
  }

  function handleSearch() {
    pagination.current = 1;
    void loadPersonaProfiles();
  }

  function handleReset() {
    Object.assign(filterModel, createDefaultPersonaProfileFilterModel());
    pagination.current = 1;
    void loadPersonaProfiles();
  }

  function handlePageUpdate(page: number) {
    pagination.current = page;
    void loadPersonaProfiles();
  }

  function handlePageSizeUpdate(pageSize: number) {
    pagination.size = pageSize;
    pagination.current = 1;
    void loadPersonaProfiles();
  }

  return {
    canManage,
    editingPersonaProfileId,
    filterModel,
    formModel,
    formVisible,
    handleArchivePersonaProfile,
    handleFormVisibleUpdate,
    handlePageSizeUpdate,
    handlePageUpdate,
    handleReset,
    handleSearch,
    handleSetDefaultPersonaProfile,
    handleSubmitPersonaProfile,
    loadPersonaProfiles,
    loading,
    openCreateModal,
    openEditModal,
    operatingPersonaProfileId,
    pagination,
    records,
    submitting
  };
}
