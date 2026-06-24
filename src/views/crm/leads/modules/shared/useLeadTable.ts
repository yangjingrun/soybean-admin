import { onMounted, reactive, shallowRef, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useDialog, useMessage } from 'naive-ui';
import { notifyCrmWorkbenchChanged } from '@/hooks/business/crm-workbench-refresh';
import {
  archiveCrmAccount,
  createCrmContact,
  createCrmAccountNote,
  deleteCrmContact,
  fetchCrmAccountDetail,
  fetchCrmAccounts,
  importCrmLead,
  refreshCrmAccountEnrichment,
  restoreCrmAccount,
  updateCrmAccount,
  updateCrmContact,
  updateCrmAccountStatus,
  verifyCrmContactEmail
} from '@/service/api';
import {
  buildLeadSearchParams,
  createDefaultLeadFilterModel,
  createDefaultLeadImportForm,
  type LeadCommunicationTab
} from '../shared';

/** Manage CRM lead list request state, pagination and current-page derived stats. */
export function useLeadTable() {
  const dialog = useDialog();
  const message = useMessage();
  const route = useRoute();
  const router = useRouter();
  const records = shallowRef<Api.Crm.LeadRecord[]>([]);
  const loading = shallowRef(false);
  const detailVisible = shallowRef(false);
  const detailActiveTab = shallowRef<LeadCommunicationTab>('overview');
  const detailLoading = shallowRef(false);
  const importVisible = shallowRef(false);
  const importSubmitting = shallowRef(false);
  const leadDetail = shallowRef<Api.Crm.LeadDetail | null>(null);
  const selectedLeadId = shallowRef<string | null>(null);
  const noteSubmitting = shallowRef(false);
  const accountSubmitting = shallowRef(false);
  const contactSubmitting = shallowRef(false);
  const contactDeletingId = shallowRef<string | null>(null);
  const statusSubmitting = shallowRef(false);
  const archiveOperatingId = shallowRef<string | null>(null);
  const verifyingContactIds = shallowRef<string[]>([]);
  const refreshingEnrichmentProvider = shallowRef<Api.Crm.LeadEnrichmentProvider | null>(null);
  const expandedRowKeys = shallowRef<string[]>([]);
  const expandedLeadDetails = shallowRef<Record<string, Api.Crm.LeadDetail>>({});
  const expandedLeadLoadingIds = shallowRef<string[]>([]);
  const expandedLeadFailedIds = shallowRef<string[]>([]);
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
      syncExpandedRowsWithVisibleRecords(data.records);
    } finally {
      if (requestId === latestRequestId) {
        loading.value = false;
      }
    }
  }

  /** Load detail for the selected lead and ignore stale communication-modal requests. */
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

      // The modal may have switched to another lead while this request was in flight.
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

  /** Open the unified customer communication modal on the requested tab. */
  function openLeadDetail(record: Api.Crm.LeadRecord, activeTab: LeadCommunicationTab = 'overview') {
    selectedLeadId.value = record.id;
    detailActiveTab.value = activeTab;
    leadDetail.value = null;
    detailVisible.value = true;
    void loadLeadDetail(record.id);
  }

  /** Load contacts for a list-row expansion without replacing the active detail drawer. */
  async function loadExpandedLeadDetail(id: string, force = false) {
    if (!force && expandedLeadDetails.value[id]) {
      return;
    }

    if (expandedLeadLoadingIds.value.includes(id)) {
      return;
    }

    expandedLeadLoadingIds.value = [...expandedLeadLoadingIds.value, id];
    expandedLeadFailedIds.value = expandedLeadFailedIds.value.filter(item => item !== id);

    try {
      const { data, error } = await fetchCrmAccountDetail(id);

      if (error) {
        expandedLeadFailedIds.value = [...expandedLeadFailedIds.value, id];
        return;
      }

      expandedLeadDetails.value = {
        ...expandedLeadDetails.value,
        [id]: data
      };
    } finally {
      expandedLeadLoadingIds.value = expandedLeadLoadingIds.value.filter(item => item !== id);
    }
  }

  /** Keep expanded row keys controlled and lazy-load newly expanded company contacts. */
  function handleExpandedRowKeysUpdate(keys: string[]) {
    expandedRowKeys.value = keys;

    for (const id of keys) {
      void loadExpandedLeadDetail(id);
    }
  }

  async function refreshExpandedLeadDetail(id: string) {
    if (!expandedLeadDetails.value[id] && !expandedRowKeys.value.includes(id)) {
      return;
    }

    await loadExpandedLeadDetail(id, true);
  }

  function handleDetailVisibleUpdate(show: boolean) {
    detailVisible.value = show;

    if (!show) {
      selectedLeadId.value = null;
      detailActiveTab.value = 'overview';
      leadDetail.value = null;
      detailLoading.value = false;
      latestDetailRequestId += 1;
    }
  }

  function handleDetailActiveTabUpdate(tab: LeadCommunicationTab) {
    detailActiveTab.value = tab;
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
      await loadLeads();

      // Only refresh the drawer if the user is still viewing this contact's account.
      if (detailVisible.value && selectedLeadId.value === accountId) {
        await loadLeadDetail(accountId);
      }

      await refreshExpandedLeadDetail(accountId);
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

      await refreshExpandedLeadDetail(id);
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

  async function handleUpdateAccount(payload: Api.Crm.LeadAccountUpdatePayload, done?: (success: boolean) => void) {
    const id = selectedLeadId.value;

    if (!id) {
      done?.(false);
      return;
    }

    accountSubmitting.value = true;

    try {
      const { error } = await updateCrmAccount(id, payload);

      if (error) {
        done?.(false);
        return;
      }

      message.success('账户信息已更新');
      notifyCrmWorkbenchChanged();
      await loadLeads();

      if (detailVisible.value && selectedLeadId.value === id) {
        await loadLeadDetail(id);
      }

      done?.(true);
    } finally {
      accountSubmitting.value = false;
    }
  }

  async function handleCreateContact(payload: Api.Crm.LeadContactCreatePayload, done?: (success: boolean) => void) {
    const accountId = selectedLeadId.value;

    if (!accountId) {
      done?.(false);
      return false;
    }

    contactSubmitting.value = true;

    try {
      const { error } = await createCrmContact(accountId, payload);

      if (error) {
        done?.(false);
        return false;
      }

      message.success('联系人已新增');
      notifyCrmWorkbenchChanged();
      await loadLeads();

      if (detailVisible.value && selectedLeadId.value === accountId) {
        await loadLeadDetail(accountId);
      }

      await refreshExpandedLeadDetail(accountId);
      done?.(true);
      return true;
    } finally {
      contactSubmitting.value = false;
    }
  }

  async function handleUpdateContact(
    contactId: string,
    payload: Api.Crm.LeadContactUpdatePayload,
    done?: (success: boolean) => void
  ) {
    contactSubmitting.value = true;

    try {
      const { error } = await updateCrmContact(contactId, payload);

      if (error) {
        done?.(false);
        return false;
      }

      message.success('联系人已更新');
      notifyCrmWorkbenchChanged();

      if (detailVisible.value && selectedLeadId.value) {
        await loadLeadDetail(selectedLeadId.value);
      }

      const updatedAccountId = findCachedContactAccountId(contactId);

      if (updatedAccountId) {
        await refreshExpandedLeadDetail(updatedAccountId);
      }

      done?.(true);
      return true;
    } finally {
      contactSubmitting.value = false;
    }
  }

  async function handleDeleteContact(contact: Api.Crm.LeadContact) {
    if (contactDeletingId.value) {
      return;
    }

    contactDeletingId.value = contact.id;

    try {
      const { error } = await deleteCrmContact(contact.id);

      if (error) {
        return;
      }

      message.success('联系人已删除');
      notifyCrmWorkbenchChanged();
      await loadLeads();

      if (detailVisible.value && selectedLeadId.value === contact.accountId) {
        await loadLeadDetail(contact.accountId);
      }

      await refreshExpandedLeadDetail(contact.accountId);
    } finally {
      contactDeletingId.value = null;
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
      title: '确认暂不开发客户',
      content: `确认将“${record.name}”标记为暂不开发？客户会移出日常开发队列，但保留历史记录，后续可重新开发。`,
      positiveText: '暂不开发',
      negativeText: '取消',
      onPositiveClick: () => archiveLead(record)
    });
  }

  function handleRestoreLead(record: Api.Crm.LeadRecord) {
    dialog.warning({
      title: '确认重新开发客户',
      content: `确认重新开发“${record.name}”？客户会回到候选线索，继续补资料和创建开发信。`,
      positiveText: '重新开发',
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

      message.success('客户已标记为暂不开发');
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

      message.success('客户已恢复为候选线索');
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
    accountSubmitting,
    contactDeletingId,
    contactSubmitting,
    detailActiveTab,
    detailLoading,
    detailVisible,
    expandedLeadDetails,
    expandedLeadFailedIds,
    expandedLeadLoadingIds,
    expandedRowKeys,
    filterModel,
    handleArchiveLead,
    handleUpdateAccount,
    handleImportLead,
    handleImportVisibleUpdate,
    handleCreateSequenceFromContact,
    handleCreateContact,
    handleCreateNote,
    handleDeleteContact,
    handleDetailActiveTabUpdate,
    handleDetailVisibleUpdate,
    handleExpandedRowKeysUpdate,
    handlePageSizeUpdate,
    handlePageUpdate,
    handleReset,
    handleRestoreLead,
    handleRefreshAccountEnrichment,
    handleSearch,
    handleUpdateContact,
    handleUpdateStatus,
    handleVerifyContactEmail,
    importForm,
    importSubmitting,
    importVisible,
    leadDetail,
    loadLeads,
    loadLeadDetail,
    loadExpandedLeadDetail,
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

  function syncExpandedRowsWithVisibleRecords(nextRecords: Api.Crm.LeadRecord[]) {
    const visibleIds = new Set(nextRecords.map(record => record.id));

    expandedRowKeys.value = expandedRowKeys.value.filter(id => visibleIds.has(id));
    expandedLeadLoadingIds.value = expandedLeadLoadingIds.value.filter(id => visibleIds.has(id));
    expandedLeadFailedIds.value = expandedLeadFailedIds.value.filter(id => visibleIds.has(id));
    expandedLeadDetails.value = Object.fromEntries(
      Object.entries(expandedLeadDetails.value).filter(([id]) => visibleIds.has(id))
    );
  }

  function findCachedContactAccountId(contactId: string) {
    const detailContact = leadDetail.value?.contacts.find(contact => contact.id === contactId);

    if (detailContact) {
      return detailContact.accountId;
    }

    for (const detail of Object.values(expandedLeadDetails.value)) {
      const contact = detail.contacts.find(item => item.id === contactId);

      if (contact) {
        return contact.accountId;
      }
    }

    return null;
  }
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
