import { onMounted, reactive, shallowRef } from 'vue';
import { useDialog, useMessage } from 'naive-ui';
import {
  archiveCrmAccount,
  createCrmAccountNote,
  fetchCrmAccountDetail,
  fetchCrmAccounts,
  updateCrmAccountStatus
} from '@/service/api';
import { buildLeadSearchParams, createDefaultLeadFilterModel } from '../shared';

/** Manage CRM lead list request state, pagination and current-page derived stats. */
export function useLeadTable() {
  const dialog = useDialog();
  const message = useMessage();
  const records = shallowRef<Api.Crm.LeadRecord[]>([]);
  const loading = shallowRef(false);
  const detailVisible = shallowRef(false);
  const detailLoading = shallowRef(false);
  const leadDetail = shallowRef<Api.Crm.LeadDetail | null>(null);
  const selectedLeadId = shallowRef<string | null>(null);
  const noteSubmitting = shallowRef(false);
  const statusSubmitting = shallowRef(false);
  const archiveOperatingId = shallowRef<string | null>(null);
  let latestRequestId = 0;
  let latestDetailRequestId = 0;

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

  /** Load detail for the selected lead and ignore stale drawer requests. */
  async function loadLeadDetail(id = selectedLeadId.value) {
    if (!id) {
      return;
    }

    const requestId = latestDetailRequestId + 1;
    latestDetailRequestId = requestId;
    detailLoading.value = true;

    try {
      const { data, error } = await fetchCrmAccountDetail(id);

      if (error) {
        return;
      }

      // The drawer may have switched to another lead while this request was in flight.
      if (requestId !== latestDetailRequestId || selectedLeadId.value !== id) {
        return;
      }

      leadDetail.value = data;
    } finally {
      if (requestId === latestDetailRequestId) {
        detailLoading.value = false;
      }
    }
  }

  /** Open detail drawer for one lead and start a fresh detail request. */
  function openLeadDetail(record: Api.Crm.LeadRecord) {
    selectedLeadId.value = record.id;
    leadDetail.value = null;
    detailVisible.value = true;
    void loadLeadDetail(record.id);
  }

  function handleDetailVisibleUpdate(show: boolean) {
    detailVisible.value = show;

    if (!show) {
      selectedLeadId.value = null;
      leadDetail.value = null;
      detailLoading.value = false;
      latestDetailRequestId += 1;
    }
  }

  async function handleCreateNote(payload: Api.Crm.LeadNotePayload) {
    const id = selectedLeadId.value;

    if (!id) {
      return;
    }

    noteSubmitting.value = true;

    try {
      const { error } = await createCrmAccountNote(id, payload);

      if (error) {
        return;
      }

      message.success('备注已添加');
      if (detailVisible.value && selectedLeadId.value === id) {
        await loadLeadDetail(id);
      }
    } finally {
      noteSubmitting.value = false;
    }
  }

  async function handleUpdateStatus(payload: Api.Crm.LeadStatusPayload) {
    const id = selectedLeadId.value;

    if (!id) {
      return;
    }

    statusSubmitting.value = true;

    try {
      const { error } = await updateCrmAccountStatus(id, payload);

      if (error) {
        return;
      }

      message.success('状态已更新');
      await loadLeads();

      if (detailVisible.value && selectedLeadId.value === id) {
        await loadLeadDetail(id);
      }
    } finally {
      statusSubmitting.value = false;
    }
  }

  function handleArchiveLead(record: Api.Crm.LeadRecord) {
    dialog.warning({
      title: '确认归档线索',
      content: `确认归档“${record.name}”？归档后线索会进入已归档状态。`,
      positiveText: '归档',
      negativeText: '取消',
      onPositiveClick: () => archiveLead(record)
    });
  }

  /** Archive one lead, then refresh the list and close the matching detail drawer. */
  async function archiveLead(record: Api.Crm.LeadRecord) {
    archiveOperatingId.value = record.id;

    try {
      const { error } = await archiveCrmAccount(record.id);

      if (error) {
        return;
      }

      message.success('线索已归档');

      if (selectedLeadId.value === record.id) {
        handleDetailVisibleUpdate(false);
      }

      await loadLeads();
    } finally {
      archiveOperatingId.value = null;
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
    archiveOperatingId,
    detailLoading,
    detailVisible,
    filterModel,
    handleArchiveLead,
    handleCreateNote,
    handleDetailVisibleUpdate,
    handlePageSizeUpdate,
    handlePageUpdate,
    handleReset,
    handleSearch,
    handleUpdateStatus,
    leadDetail,
    loadLeads,
    loadLeadDetail,
    loading,
    noteSubmitting,
    pagination,
    records,
    openLeadDetail,
    statusSubmitting
  };
}
