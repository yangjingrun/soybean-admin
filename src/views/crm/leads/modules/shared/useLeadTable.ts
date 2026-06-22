import { onMounted, reactive, shallowRef, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useDialog, useMessage } from 'naive-ui';
import { notifyCrmWorkbenchChanged } from '@/hooks/business/crm-workbench-refresh';
import {
  archiveCrmAccount,
  createCrmAccountNote,
  fetchCrmAccountDetail,
  fetchCrmAccounts,
  importCrmLead,
  refreshCrmAccountEnrichment,
  restoreCrmAccount,
  updateCrmAccountStatus,
  verifyCrmContactEmail
} from '@/service/api';
import { buildLeadSearchParams, createDefaultLeadFilterModel, createDefaultLeadImportForm } from '../shared';

/** Manage CRM lead list request state, pagination and current-page derived stats. */
export function useLeadTable() {
  const dialog = useDialog();
  const message = useMessage();
  const route = useRoute();
  const router = useRouter();
  const records = shallowRef<Api.Crm.LeadRecord[]>([]);
  const loading = shallowRef(false);
  const detailVisible = shallowRef(false);
  const detailLoading = shallowRef(false);
  const importVisible = shallowRef(false);
  const importSubmitting = shallowRef(false);
  const leadDetail = shallowRef<Api.Crm.LeadDetail | null>(null);
  const selectedLeadId = shallowRef<string | null>(null);
  const noteSubmitting = shallowRef(false);
  const statusSubmitting = shallowRef(false);
  const archiveOperatingId = shallowRef<string | null>(null);
  const verifyingContactIds = shallowRef<string[]>([]);
  const refreshingEnrichmentProvider = shallowRef<Api.Crm.LeadEnrichmentProvider | null>(null);
  let latestRequestId = 0;
  let latestDetailRequestId = 0;

  const pagination = reactive({
    current: 1,
    size: 10,
    total: 0
  });

  const filterModel = reactive<Api.Crm.LeadFilterModel>(createDefaultLeadFilterModel());
  const importForm = reactive<Api.Crm.LeadImportFormModel>(createDefaultLeadImportForm());

  onMounted(() => {
    applyRouteFilters();
    void loadLeads();
  });

  watch(
    () => route.query,
    () => {
      if (route.name !== 'crm_leads') return;

      applyRouteFilters();
      pagination.current = 1;
      void loadLeads();
    }
  );

  function applyRouteFilters() {
    const status = getRouteQueryString(route.query.status);
    const sourceTaskId = getRouteQueryString(route.query.sourceTaskId);

    filterModel.status = null;
    filterModel.sourceTaskId = null;

    if (isLeadStatus(status)) {
      filterModel.status = status;
    }

    if (sourceTaskId) {
      filterModel.sourceTaskId = sourceTaskId;
    }
  }

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

  function openImportModal() {
    Object.assign(importForm, createDefaultLeadImportForm());
    importVisible.value = true;
  }

  function handleImportVisibleUpdate(show: boolean) {
    importVisible.value = show;
  }

  /** Import one manually entered CRM lead, then refresh and open the new detail drawer. */
  async function handleImportLead(payload: Api.Crm.LeadImportPayload) {
    importSubmitting.value = true;

    try {
      const { data, error } = await importCrmLead(payload);

      if (error) {
        return;
      }

      message.success(data.contact ? '客户和联系人已导入' : '客户已导入');
      notifyCrmWorkbenchChanged();
      importVisible.value = false;
      pagination.current = 1;
      await loadLeads();
      openLeadDetail(data.account);
    } finally {
      importSubmitting.value = false;
    }
  }

  /** Mark one contact email verification request as running. */
  function addVerifyingContact(contactId: string) {
    verifyingContactIds.value = [...verifyingContactIds.value, contactId];
  }

  /** Remove one finished contact email verification request. */
  function removeVerifyingContact(contactId: string) {
    verifyingContactIds.value = verifyingContactIds.value.filter(id => id !== contactId);
  }

  /** Verify one contact email, then refresh the matching open detail drawer. */
  async function handleVerifyContactEmail(contact: Api.Crm.LeadContact) {
    const contactId = contact.id;
    const accountId = contact.accountId;

    if (verifyingContactIds.value.includes(contactId)) {
      return;
    }

    addVerifyingContact(contactId);

    try {
      const { error } = await verifyCrmContactEmail(contactId);

      if (error) {
        return;
      }

      message.success('邮箱验证已完成');
      notifyCrmWorkbenchChanged();

      // Only refresh the drawer if the user is still viewing this contact's account.
      if (detailVisible.value && selectedLeadId.value === accountId) {
        await loadLeadDetail(accountId);
      }
    } finally {
      removeVerifyingContact(contactId);
    }
  }

  /** Manually refresh provider contacts from the open detail drawer. */
  async function handleRefreshAccountEnrichment(provider: Api.Crm.LeadEnrichmentProvider) {
    const id = selectedLeadId.value;

    if (!id || provider !== 'hunter' || refreshingEnrichmentProvider.value) {
      return;
    }

    refreshingEnrichmentProvider.value = provider;

    try {
      const { error } = await refreshCrmAccountEnrichment(id, { provider });

      if (error) {
        return;
      }

      message.success('联系人获取已完成');
      notifyCrmWorkbenchChanged();
      await loadLeads();

      if (detailVisible.value && selectedLeadId.value === id) {
        await loadLeadDetail(id);
      }
    } finally {
      refreshingEnrichmentProvider.value = null;
    }
  }

  /** Continue from a lead contact into the sequence review creation flow with the contact preselected. */
  async function handleCreateSequenceFromContact(contact: Api.Crm.LeadContact) {
    await router.push({
      path: '/crm/email-sequences',
      query: {
        accountId: contact.accountId,
        contactId: contact.id
      }
    });
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
      notifyCrmWorkbenchChanged();
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
      title: '确认归档客户',
      content: `确认归档“${record.name}”？归档后客户会进入已归档状态。`,
      positiveText: '归档',
      negativeText: '取消',
      onPositiveClick: () => archiveLead(record)
    });
  }

  function handleRestoreLead(record: Api.Crm.LeadRecord) {
    dialog.warning({
      title: '确认恢复客户',
      content: `确认恢复“${record.name}”？恢复后客户会回到候选状态。`,
      positiveText: '恢复',
      negativeText: '取消',
      onPositiveClick: () => restoreLead(record)
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

      message.success('客户已归档');
      notifyCrmWorkbenchChanged();

      if (selectedLeadId.value === record.id) {
        handleDetailVisibleUpdate(false);
      }

      await loadLeads();
    } finally {
      archiveOperatingId.value = null;
    }
  }

  /** Restore one archived lead, then refresh the list and matching detail drawer. */
  async function restoreLead(record: Api.Crm.LeadRecord) {
    archiveOperatingId.value = record.id;

    try {
      const { error } = await restoreCrmAccount(record.id);

      if (error) {
        return;
      }

      message.success('客户已恢复');
      notifyCrmWorkbenchChanged();
      await loadLeads();

      if (detailVisible.value && selectedLeadId.value === record.id) {
        await loadLeadDetail(record.id);
      }
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
    handleImportLead,
    handleImportVisibleUpdate,
    handleCreateSequenceFromContact,
    handleCreateNote,
    handleDetailVisibleUpdate,
    handlePageSizeUpdate,
    handlePageUpdate,
    handleReset,
    handleRestoreLead,
    handleRefreshAccountEnrichment,
    handleSearch,
    handleUpdateStatus,
    handleVerifyContactEmail,
    importForm,
    importSubmitting,
    importVisible,
    leadDetail,
    loadLeads,
    loadLeadDetail,
    loading,
    noteSubmitting,
    pagination,
    refreshingEnrichmentProvider,
    records,
    openLeadDetail,
    openImportModal,
    statusSubmitting,
    verifyingContactIds
  };
}

function getRouteQueryString(value: unknown) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return '';
}

function isLeadStatus(value: string): value is Api.Crm.CrmAccountStatus {
  return [
    'candidate',
    'missing_contact',
    'email_verification_pending',
    'manual_review_pending',
    'ready',
    'sequence_running',
    'replied_pending',
    'followed_up',
    'opportunity',
    'customer',
    'invalid',
    'paused',
    'blocked',
    'archived'
  ].includes(value);
}
