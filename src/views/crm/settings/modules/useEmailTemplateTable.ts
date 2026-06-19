import { onMounted, reactive, shallowRef } from 'vue';
import { useMessage } from 'naive-ui';
import {
  archiveCrmEmailTemplateGroup,
  createCrmEmailTemplateGroup,
  fetchCrmEmailTemplateGroups,
  setDefaultCrmEmailTemplateGroup,
  updateCrmEmailTemplateGroup
} from '@/service/api';
import {
  buildEmailTemplateSearchParams,
  createDefaultEmailTemplateFilterModel,
  createDefaultEmailTemplateForm,
  createEmailTemplateFormFromRecord,
  normalizeEmailTemplatePayload
} from './shared';

/** Manage organization email template list requests, form modal state and row operations. */
export function useEmailTemplateTable() {
  const message = useMessage();
  const records = shallowRef<Api.Crm.EmailTemplateGroupRecord[]>([]);
  const loading = shallowRef(false);
  const formVisible = shallowRef(false);
  const submitting = shallowRef(false);
  const operatingTemplateId = shallowRef<string | null>(null);
  const editingTemplateId = shallowRef<string | null>(null);
  let latestRequestId = 0;

  const pagination = reactive({
    current: 1,
    size: 10,
    total: 0
  });

  const filterModel = reactive<Api.Crm.EmailTemplateFilterModel>(createDefaultEmailTemplateFilterModel());
  const formModel = reactive<Api.Crm.EmailTemplateFormModel>(createDefaultEmailTemplateForm());

  onMounted(() => {
    void loadEmailTemplates();
  });

  /** Load email template groups with backend pagination and ignore stale responses. */
  async function loadEmailTemplates() {
    const requestId = latestRequestId + 1;
    latestRequestId = requestId;
    loading.value = true;

    try {
      const { data, error } = await fetchCrmEmailTemplateGroups(
        buildEmailTemplateSearchParams({
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
    editingTemplateId.value = null;
    Object.assign(formModel, createDefaultEmailTemplateForm());
    formVisible.value = true;
  }

  function openEditModal(record: Api.Crm.EmailTemplateGroupRecord) {
    editingTemplateId.value = record.id;
    Object.assign(formModel, createEmailTemplateFormFromRecord(record));
    formVisible.value = true;
  }

  function handleFormVisibleUpdate(show: boolean) {
    formVisible.value = show;

    if (!show) {
      editingTemplateId.value = null;
      Object.assign(formModel, createDefaultEmailTemplateForm());
    }
  }

  /** Create or update the current email template form, then refresh the list. */
  async function handleSubmitEmailTemplate() {
    submitting.value = true;

    try {
      const payload = normalizeEmailTemplatePayload(formModel);
      const isEdit = Boolean(editingTemplateId.value);
      const { error } = editingTemplateId.value
        ? await updateCrmEmailTemplateGroup(editingTemplateId.value, payload)
        : await createCrmEmailTemplateGroup(payload);

      if (error) {
        return;
      }

      message.success(editingTemplateId.value ? '邮件模板已更新' : '邮件模板已新增');
      formVisible.value = false;
      editingTemplateId.value = null;
      Object.assign(formModel, createDefaultEmailTemplateForm());

      if (!isEdit) {
        pagination.current = 1;
      }

      await loadEmailTemplates();
    } finally {
      submitting.value = false;
    }
  }

  /** Archive one active email template group and refresh the list. */
  async function handleArchiveEmailTemplate(record: Api.Crm.EmailTemplateGroupRecord) {
    if (operatingTemplateId.value || record.status === 'archived') {
      return;
    }

    operatingTemplateId.value = record.id;

    try {
      const { error } = await archiveCrmEmailTemplateGroup(record.id);

      if (error) {
        return;
      }

      message.success('邮件模板已归档');
      await loadEmailTemplates();
    } finally {
      operatingTemplateId.value = null;
    }
  }

  /** Mark one active email template as the organization default drafting template. */
  async function handleSetDefaultEmailTemplate(record: Api.Crm.EmailTemplateGroupRecord) {
    if (operatingTemplateId.value || record.status !== 'active' || record.isDefault) {
      return;
    }

    operatingTemplateId.value = record.id;

    try {
      const { error } = await setDefaultCrmEmailTemplateGroup(record.id);

      if (error) {
        return;
      }

      message.success('默认邮件模板已更新');
      await loadEmailTemplates();
    } finally {
      operatingTemplateId.value = null;
    }
  }

  function handleSearch() {
    pagination.current = 1;
    void loadEmailTemplates();
  }

  function handleReset() {
    Object.assign(filterModel, createDefaultEmailTemplateFilterModel());
    pagination.current = 1;
    void loadEmailTemplates();
  }

  function handlePageUpdate(page: number) {
    pagination.current = page;
    void loadEmailTemplates();
  }

  function handlePageSizeUpdate(pageSize: number) {
    pagination.size = pageSize;
    pagination.current = 1;
    void loadEmailTemplates();
  }

  return {
    editingTemplateId,
    filterModel,
    formModel,
    formVisible,
    handleArchiveEmailTemplate,
    handleFormVisibleUpdate,
    handlePageSizeUpdate,
    handlePageUpdate,
    handleReset,
    handleSearch,
    handleSetDefaultEmailTemplate,
    handleSubmitEmailTemplate,
    loadEmailTemplates,
    loading,
    openCreateModal,
    openEditModal,
    operatingTemplateId,
    pagination,
    records,
    submitting
  };
}
