import { computed, onMounted, shallowRef } from 'vue';
import { useRouter } from 'vue-router';
import { useMessage } from 'naive-ui';
import { notifyCrmWorkbenchChanged } from '@/hooks/business/crm-workbench-refresh';
import {
  archiveCrmAccount,
  createCrmSequenceReviewItem,
  fetchCrmAccountDetail,
  fetchCrmAccounts,
  fetchCrmSendPreference,
  refreshCrmAccountEnrichment,
  restoreCrmAccount,
  verifyCrmContactEmail
} from '@/service/api';
import {
  buildAssistantCapacitySummary,
  buildAssistantQueueViews,
  type AssistantQueueKey
} from './shared';

const overviewPageSize = 100;

/** Manage AI assistant first-phase CRM overview, detail drawer and lead actions. */
export function useAiAssistantPage() {
  const message = useMessage();
  const router = useRouter();
  const records = shallowRef<Api.Crm.LeadRecord[]>([]);
  const loading = shallowRef(false);
  const detailVisible = shallowRef(false);
  const detailLoading = shallowRef(false);
  const selectedDetail = shallowRef<Api.Crm.LeadDetail | null>(null);
  const selectedLeadId = shallowRef<string | null>(null);
  const sendPreference = shallowRef<Api.Crm.SendPreference | null>(null);
  const activeQueueKey = shallowRef<AssistantQueueKey>('recommended');
  let latestOverviewRequestId = 0;
  let latestDetailRequestId = 0;

  const capacitySummary = computed(() => buildAssistantCapacitySummary(records.value, sendPreference.value));
  const queueViews = computed(() => buildAssistantQueueViews(records.value));
  const activeQueueView = computed(
    () => queueViews.value.find(view => view.key === activeQueueKey.value) ?? queueViews.value[0]!
  );

  onMounted(() => {
    void loadOverview();
  });

  /** Load assistant overview data and ignore stale list responses. */
  async function loadOverview() {
    const requestId = latestOverviewRequestId + 1;
    latestOverviewRequestId = requestId;
    loading.value = true;

    try {
      const [accountsResult, sendPreferenceResult] = await Promise.all([
        fetchCrmAccounts({ current: 1, size: overviewPageSize }),
        fetchCrmSendPreference()
      ]);

      if (requestId !== latestOverviewRequestId) {
        return;
      }

      if (accountsResult.error) {
        return;
      }

      records.value = accountsResult.data.records;

      if (!sendPreferenceResult.error) {
        sendPreference.value = sendPreferenceResult.data;
      }
    } finally {
      if (requestId === latestOverviewRequestId) {
        loading.value = false;
      }
    }
  }

  /** Open one CRM lead detail drawer and start a guarded detail request. */
  function openDetail(record: Api.Crm.LeadRecord) {
    selectedLeadId.value = record.id;
    selectedDetail.value = null;
    detailVisible.value = true;
    void loadDetail(record.id);
  }

  /** Sync drawer visible state and invalidate in-flight detail requests on close. */
  function handleDetailVisibleUpdate(show: boolean) {
    detailVisible.value = show;

    if (!show) {
      selectedLeadId.value = null;
      selectedDetail.value = null;
      detailLoading.value = false;
      latestDetailRequestId += 1;
    }
  }

  /** Create the first follow-up review item from the best available contact. */
  async function startFollowUp() {
    const detail = selectedDetail.value;

    if (!detail) {
      return;
    }

    const contact = detail.contacts.find(item => item.emailStatus === 'valid') ?? detail.contacts[0];

    if (!contact) {
      message.warning('当前客户还没有联系人，先补齐联系人后再开始跟进');
      return;
    }

    const { data, error } = await createCrmSequenceReviewItem({
      accountId: detail.account.id,
      contactId: contact.id
    });

    if (error) {
      return;
    }

    message.success('首封开发信草稿已生成');
    notifyCrmWorkbenchChanged();

    const enrollmentId = data.item.enrollment.id;
    await router.push({
      path: '/crm/email-sequences',
      ...(enrollmentId ? { query: { enrollmentId } } : {})
    });
  }

  /** Archive one lead from the assistant queue and refresh current assistant data. */
  async function archiveLead(record = selectedDetail.value?.account) {
    if (!record) {
      return;
    }

    const { error } = await archiveCrmAccount(record.id, { reason: 'AI 开发助手暂不开发' });

    if (error) {
      return;
    }

    message.success('客户已标记为暂不开发');
    notifyCrmWorkbenchChanged();
    await refreshAfterLeadMutation();
  }

  /** Restore one archived lead and refresh current assistant data. */
  async function restoreLead(record = selectedDetail.value?.account) {
    if (!record) {
      return;
    }

    const { error } = await restoreCrmAccount(record.id);

    if (error) {
      return;
    }

    message.success('客户已恢复为候选线索');
    notifyCrmWorkbenchChanged();
    await refreshAfterLeadMutation();
  }

  /** Refresh Hunter enrichment for one lead and reload the open detail when still relevant. */
  async function refreshLeadEnrichment(record = selectedDetail.value?.account) {
    if (!record) {
      return;
    }

    const { error } = await refreshCrmAccountEnrichment(record.id, { provider: 'hunter' });

    if (error) {
      return;
    }

    message.success('联系人获取已完成');
    notifyCrmWorkbenchChanged();
    await refreshAfterLeadMutation();
  }

  /** Verify one contact email, then refresh list and matching detail state. */
  async function verifyContactEmail(contact: Api.Crm.LeadContact) {
    const { error } = await verifyCrmContactEmail(contact.id);

    if (error) {
      return;
    }

    message.success('邮箱验证已完成');
    notifyCrmWorkbenchChanged();
    await refreshAfterLeadMutation();
  }

  function goToCrmLeads() {
    return router.push('/crm/leads');
  }

  function goToEmailSequences() {
    return router.push('/crm/email-sequences');
  }

  function goToInbox() {
    return router.push('/crm/inbox');
  }

  /** Load detail for the selected lead and prevent old responses from replacing newer detail. */
  async function loadDetail(id = selectedLeadId.value) {
    if (!id) {
      return;
    }

    const requestId = latestDetailRequestId + 1;
    latestDetailRequestId = requestId;
    detailLoading.value = true;

    try {
      const { data, error } = await fetchCrmAccountDetail(id);

      if (error || requestId !== latestDetailRequestId || selectedLeadId.value !== id) {
        return;
      }

      selectedDetail.value = data;
    } finally {
      if (requestId === latestDetailRequestId) {
        detailLoading.value = false;
      }
    }
  }

  /** Refresh list and the currently open detail after a lead mutation. */
  async function refreshAfterLeadMutation() {
    await loadOverview();

    // Detail may have been closed while the list request was in flight.
    if (detailVisible.value && selectedLeadId.value) {
      await loadDetail(selectedLeadId.value);
    }
  }

  return {
    activeQueueKey,
    activeQueueView,
    archiveLead,
    capacitySummary,
    detailLoading,
    detailVisible,
    goToCrmLeads,
    goToEmailSequences,
    goToInbox,
    handleDetailVisibleUpdate,
    loadOverview,
    loading,
    openDetail,
    queueViews,
    records,
    refreshLeadEnrichment,
    restoreLead,
    selectedDetail,
    sendPreference,
    startFollowUp,
    verifyContactEmail
  };
}
