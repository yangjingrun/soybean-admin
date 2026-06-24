import { computed, h, onMounted, reactive, shallowRef, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { NButton, useDialog, useMessage, useNotification } from 'naive-ui';
import { notifyCrmWorkbenchChanged } from '@/hooks/business/crm-workbench-refresh';
import {
  archiveCrmAccount,
  createCrmContact,
  createCrmAccountNote,
  createCrmFirstOutreachAiDraftTask,
  deleteCrmContact,
  fetchCrmAccountDetail,
  fetchCrmAccounts,
  fetchCrmMailboxes,
  fetchCrmProductLines,
  fetchCrmSequencePolicies,
  importCrmLead,
  refreshCrmAccountEnrichment,
  restoreCrmAccount,
  updateCrmAccount,
  updateCrmContact,
  updateCrmAccountStatus,
  verifyCrmContactEmail
} from '@/service/api';
import { createDefaultSequenceCreateForm } from '../../../email-sequences/modules/shared';
import { isMailboxAvailableForSequence } from '../../../settings/modules/shared';
import {
  buildLeadSequenceTarget,
  buildLeadSequenceTargetsFromCheckedRows,
  buildLeadSearchParams,
  canCreateSequenceFromLeadAccountContact,
  createDefaultLeadFilterModel,
  createDefaultLeadImportForm,
  patchLeadEmailProgressForContacts
} from '../shared';
/** Manage CRM lead list request state, pagination and current-page derived stats. */
export function useLeadTable() {
  const dialog = useDialog();
  const message = useMessage();
  const notification = useNotification();
  const route = useRoute();
  const router = useRouter();
  const records = shallowRef([]);
  const checkedLeadRowKeys = shallowRef([]);
  const loading = shallowRef(false);
  const detailVisible = shallowRef(false);
  const detailActiveTab = shallowRef('overview');
  const detailActiveContactId = shallowRef(null);
  const detailLoading = shallowRef(false);
  const importVisible = shallowRef(false);
  const importSubmitting = shallowRef(false);
  const leadDetail = shallowRef(null);
  const selectedLeadId = shallowRef(null);
  const noteSubmitting = shallowRef(false);
  const accountSubmitting = shallowRef(false);
  const contactSubmitting = shallowRef(false);
  const contactDeletingId = shallowRef(null);
  const statusSubmitting = shallowRef(false);
  const archiveOperatingId = shallowRef(null);
  const verifyingContactIds = shallowRef([]);
  const refreshingEnrichmentProvider = shallowRef(null);
  const sequenceCreateVisible = shallowRef(false);
  const sequenceCreateSubmitting = shallowRef(false);
  const sequenceResourceLoading = shallowRef(false);
  const sequenceTargets = shallowRef([]);
  const sequenceMailboxOptions = shallowRef([]);
  const sequenceProductLineOptions = shallowRef([]);
  const sequencePolicyOptions = shallowRef([]);
  const expandedRowKeys = shallowRef([]);
  const expandedLeadDetails = shallowRef({});
  const expandedLeadLoadingIds = shallowRef([]);
  const expandedLeadFailedIds = shallowRef([]);
  let latestRequestId = 0;
  let latestDetailRequestId = 0;
  const pagination = reactive({
    current: 1,
    size: 10,
    total: 0
  });
  const filterModel = reactive(createDefaultLeadFilterModel());
  const importForm = reactive(createDefaultLeadImportForm());
  const sequenceCreateForm = reactive(createDefaultSequenceCreateForm());
  const checkedLeadSequenceTargets = computed(() =>
    buildLeadSequenceTargetsFromCheckedRows(records.value, checkedLeadRowKeys.value)
  );
  const sequenceMailboxSelectOptions = computed(() =>
    sequenceMailboxOptions.value
      .filter(mailbox => isMailboxAvailableForSequence(mailbox))
      .map(mailbox => ({
        label: mailbox.maskedEmail,
        value: mailbox.id
      }))
  );
  const sequenceProductLineSelectOptions = computed(() =>
    sequenceProductLineOptions.value.map(productLine => ({
      label: productLine.name,
      value: productLine.id,
      aiWritingConfig: productLine.aiWritingConfig
    }))
  );
  const sequencePolicySelectOptions = computed(() =>
    sequencePolicyOptions.value.map(policy => ({
      label: `${policy.name}${policy.isDefault ? ' · 默认' : ''}`,
      value: policy.id
    }))
  );
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
      checkedLeadRowKeys.value = checkedLeadRowKeys.value.filter(id => data.records.some(record => record.id === id));
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
  function openLeadDetail(record, activeTab = 'overview', contactId) {
    selectedLeadId.value = record.id;
    detailActiveTab.value = activeTab;
    detailActiveContactId.value = contactId ?? record.primaryContact?.id ?? null;
    leadDetail.value = null;
    detailVisible.value = true;
    void loadLeadDetail(record.id);
  }
  /** Load contacts for a list-row expansion without replacing the active detail drawer. */
  async function loadExpandedLeadDetail(id, force = false) {
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
  function handleExpandedRowKeysUpdate(keys) {
    expandedRowKeys.value = keys;
    for (const id of keys) {
      void loadExpandedLeadDetail(id);
    }
  }
  async function refreshExpandedLeadDetail(id) {
    if (!expandedLeadDetails.value[id] && !expandedRowKeys.value.includes(id)) {
      return;
    }
    await loadExpandedLeadDetail(id, true);
  }
  function handleDetailVisibleUpdate(show) {
    detailVisible.value = show;
    if (!show) {
      selectedLeadId.value = null;
      detailActiveTab.value = 'overview';
      detailActiveContactId.value = null;
      leadDetail.value = null;
      detailLoading.value = false;
      latestDetailRequestId += 1;
    }
  }
  function handleDetailActiveTabUpdate(tab) {
    detailActiveTab.value = tab;
  }
  function openImportModal() {
    Object.assign(importForm, createDefaultLeadImportForm());
    importVisible.value = true;
  }
  function handleImportVisibleUpdate(show) {
    importVisible.value = show;
  }
  /** Import one manually entered CRM lead, then refresh and open the new detail drawer. */
  async function handleImportLead(payload) {
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
  function addVerifyingContact(contactId) {
    verifyingContactIds.value = [...verifyingContactIds.value, contactId];
  }
  /** Remove one finished contact email verification request. */
  function removeVerifyingContact(contactId) {
    verifyingContactIds.value = verifyingContactIds.value.filter(id => id !== contactId);
  }
  /** Verify one contact email, then refresh the matching open detail drawer. */
  async function handleVerifyContactEmail(contact) {
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
  async function handleRefreshAccountEnrichment(provider) {
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
  /** Open first-email generation modal for one contact in the customer workspace. */
  function handleCreateSequenceFromContact(contact) {
    if (!canOpenSequenceForContact(contact)) {
      message.warning('只有未开发客户可以生成开发信');
      return;
    }
    openSequenceCreateModal([buildLeadSequenceTarget(contact, findCachedLeadAccount(contact.accountId))]);
  }
  /** Open first-email generation modal for selected visible customer rows. */
  function handleOpenBatchSequenceCreateModal() {
    if (!checkedLeadSequenceTargets.value.length) {
      message.warning('请先勾选可生成开发信的客户');
      return;
    }
    openSequenceCreateModal(checkedLeadSequenceTargets.value);
  }
  function handleCheckedLeadRowKeysUpdate(keys) {
    checkedLeadRowKeys.value = keys;
  }
  function handleSequenceCreateVisibleUpdate(show) {
    sequenceCreateVisible.value = show;
    if (!show) {
      sequenceTargets.value = [];
      Object.assign(sequenceCreateForm, createDefaultSequenceCreateForm());
    }
  }
  /** Load sending resources needed by first-email generation. */
  async function loadSequenceCreateResources() {
    sequenceResourceLoading.value = true;
    try {
      const [mailboxes, productLines, sequencePolicies] = await Promise.all([
        fetchCrmMailboxes({ current: 1, size: 100, status: 'active' }),
        fetchCrmProductLines({ current: 1, size: 100, status: 'active' }),
        fetchCrmSequencePolicies({ current: 1, size: 100, status: 'active' })
      ]);
      if (!mailboxes.error) sequenceMailboxOptions.value = mailboxes.data.records;
      if (!productLines.error) sequenceProductLineOptions.value = productLines.data.records;
      if (!sequencePolicies.error) sequencePolicyOptions.value = sequencePolicies.data.records;
    } finally {
      sequenceResourceLoading.value = false;
    }
  }
  /** Create first-email drafts for selected contacts without leaving the customer page. */
  async function handleCreateSequencesFromTargets() {
    if (!sequenceTargets.value.length) {
      return;
    }
    if (!sequenceCreateForm.mailboxId) {
      message.warning('请选择发送邮箱');
      return;
    }
    const submittedTargets = [...sequenceTargets.value];
    const progressPatch = {
      at: new Date().toISOString(),
      contactIds: submittedTargets.map(target => target.contactId),
      label: '正在生成中',
      status: 'draft_pending_review'
    };
    sequenceCreateSubmitting.value = true;
    try {
      const { error } = await createCrmFirstOutreachAiDraftTask({
        targets: submittedTargets.map(target => ({
          accountId: target.accountId,
          contactId: target.contactId
        })),
        ...(sequenceCreateForm.productLineId ? { productLineId: sequenceCreateForm.productLineId } : {}),
        mailboxId: sequenceCreateForm.mailboxId,
        ...(sequenceCreateForm.policyId ? { policyId: sequenceCreateForm.policyId } : {})
      });
      if (error) {
        return;
      }
      patchVisibleLeadEmailProgress(progressPatch);
      showFirstOutreachProgressNotification(submittedTargets.length);
      notifyCrmWorkbenchChanged();
      checkedLeadRowKeys.value = [];
      sequenceCreateVisible.value = false;
      sequenceTargets.value = [];
      Object.assign(sequenceCreateForm, createDefaultSequenceCreateForm());
      await loadLeads();
      patchVisibleLeadEmailProgress(progressPatch);
      if (detailVisible.value && selectedLeadId.value) {
        await loadLeadDetail(selectedLeadId.value);
        patchVisibleLeadEmailProgress(progressPatch);
      }
    } finally {
      sequenceCreateSubmitting.value = false;
    }
  }
  async function handleCreateNote(payload) {
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
  async function handleUpdateAccount(payload, done) {
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
  async function handleCreateContact(payload, done) {
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
  async function handleUpdateContact(contactId, payload, done) {
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
  async function handleDeleteContact(contact) {
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
  async function handleUpdateStatus(payload) {
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
  function handleArchiveLead(record) {
    dialog.warning({
      title: '确认暂不开发客户',
      content: `确认将“${record.name}”标记为暂不开发？客户会移出日常开发队列，但保留历史记录，后续可重新开发。`,
      positiveText: '暂不开发',
      negativeText: '取消',
      onPositiveClick: () => archiveLead(record)
    });
  }
  function handleRestoreLead(record) {
    dialog.warning({
      title: '确认重新开发客户',
      content: `确认重新开发“${record.name}”？客户会回到候选线索，继续补资料和创建开发信。`,
      positiveText: '重新开发',
      negativeText: '取消',
      onPositiveClick: () => restoreLead(record)
    });
  }
  /** Archive one lead, then refresh the list and close the matching detail drawer. */
  async function archiveLead(record) {
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
  async function restoreLead(record) {
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
  function handlePageUpdate(page) {
    pagination.current = page;
    void loadLeads();
  }
  function handlePageSizeUpdate(pageSize) {
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
    detailActiveContactId,
    detailLoading,
    detailVisible,
    expandedLeadDetails,
    expandedLeadFailedIds,
    expandedLeadLoadingIds,
    expandedRowKeys,
    filterModel,
    checkedLeadRowKeys,
    checkedLeadSequenceTargets,
    handleArchiveLead,
    handleUpdateAccount,
    handleCheckedLeadRowKeysUpdate,
    handleCreateSequencesFromTargets,
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
    handleOpenBatchSequenceCreateModal,
    handleReset,
    handleRestoreLead,
    handleRefreshAccountEnrichment,
    handleSearch,
    handleSequenceCreateVisibleUpdate,
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
    sequenceCreateForm,
    sequenceCreateSubmitting,
    sequenceCreateVisible,
    sequenceMailboxSelectOptions,
    sequencePolicySelectOptions,
    sequenceProductLineSelectOptions,
    sequenceResourceLoading,
    sequenceTargets,
    statusSubmitting,
    verifyingContactIds
  };
  function syncExpandedRowsWithVisibleRecords(nextRecords) {
    const visibleIds = new Set(nextRecords.map(record => record.id));
    expandedRowKeys.value = expandedRowKeys.value.filter(id => visibleIds.has(id));
    expandedLeadLoadingIds.value = expandedLeadLoadingIds.value.filter(id => visibleIds.has(id));
    expandedLeadFailedIds.value = expandedLeadFailedIds.value.filter(id => visibleIds.has(id));
    expandedLeadDetails.value = Object.fromEntries(
      Object.entries(expandedLeadDetails.value).filter(([id]) => visibleIds.has(id))
    );
  }
  function findCachedContactAccountId(contactId) {
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
  function findCachedLeadAccount(accountId) {
    const record = records.value.find(item => item.id === accountId);
    if (record) {
      return record;
    }
    if (leadDetail.value?.account.id === accountId) {
      return leadDetail.value.account;
    }
    return Object.values(expandedLeadDetails.value).find(detail => detail.account.id === accountId)?.account ?? null;
  }
  function canOpenSequenceForContact(contact) {
    const account = findCachedLeadAccount(contact.accountId);
    return account ? canCreateSequenceFromLeadAccountContact(account, contact) : false;
  }
  function openSequenceCreateModal(targets) {
    sequenceTargets.value = targets;
    Object.assign(sequenceCreateForm, createDefaultSequenceCreateForm());
    sequenceCreateVisible.value = true;
    void loadSequenceCreateResources();
  }
  /** Keep the visible customer table and open drawers aligned with submitted background generation. */
  function patchVisibleLeadEmailProgress(patch) {
    records.value = records.value.map(record => patchLeadEmailProgressForContacts(record, patch));
    if (leadDetail.value) {
      leadDetail.value = patchLeadEmailProgressForContacts(leadDetail.value, patch);
    }
    expandedLeadDetails.value = Object.fromEntries(
      Object.entries(expandedLeadDetails.value).map(([id, detail]) => [
        id,
        patchLeadEmailProgressForContacts(detail, patch)
      ])
    );
  }
  /** Guide first-time users to the persisted AI draft task progress entry. */
  function showFirstOutreachProgressNotification(count) {
    const notice = notification.info({
      title: '批量开发信生成中',
      content: `已提交后台生成 ${count} 封开发信。客户开发台邮箱进度已标记为“正在生成中”，也可到邮箱调度查看任务进度。`,
      meta: '系统通知',
      duration: 0,
      keepAliveOnHover: true,
      action: () =>
        h(
          NButton,
          {
            size: 'small',
            type: 'primary',
            onClick: () => {
              notice.destroy();
              void router.push('/crm/email-sequences');
            }
          },
          { default: () => '查看' }
        )
    });
  }
}
function getRouteQueryString(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return '';
}
function isLeadStatus(value) {
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
