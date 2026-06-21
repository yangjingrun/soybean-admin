import { computed, onMounted, reactive, shallowRef, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useMessage } from 'naive-ui';
import {
  confirmCrmInboxMessageUnsubscribe,
  fetchCrmInboxThreadDetail,
  fetchCrmInboxThreads,
  fetchCrmMailboxes,
  polishCrmInboxReplyDraft,
  replyCrmInboxThread,
  saveCrmInboxReplyDraft,
  updateCrmInboxThreadStatus
} from '@/service/api';
import {
  buildInboxPendingCountParams,
  buildInboxReplySubmitPayload,
  buildInboxThreadSearchParams,
  createDefaultInboxFilterModel
} from '../shared';

/** Manage CRM inbox thread list, stats, mailbox filters and drawer operations. */
export function useInboxTable() {
  const route = useRoute();
  const message = useMessage();
  const records = shallowRef<Api.Crm.InboxThreadRecord[]>([]);
  const mailboxRecords = shallowRef<Api.Crm.MailboxRecord[]>([]);
  const currentDetail = shallowRef<Api.Crm.InboxThreadDetail | null>(null);
  const loading = shallowRef(false);
  const mailboxLoading = shallowRef(false);
  const detailVisible = shallowRef(false);
  const detailLoading = shallowRef(false);
  const replyTopic = shallowRef('');
  const replyBody = shallowRef('');
  const draftPolishing = shallowRef(false);
  const draftSaving = shallowRef(false);
  const replySending = shallowRef(false);
  const statusSubmitting = shallowRef(false);
  const statusOperating = shallowRef<Api.Crm.InboxThreadStatus | null>(null);
  const unsubscribeConfirming = shallowRef(false);
  const selectedThreadId = shallowRef<string | null>(null);
  const pendingTotal = shallowRef(0);
  let latestListRequestId = 0;
  let latestDetailRequestId = 0;
  let latestMailboxRequestId = 0;

  const pagination = reactive({
    current: 1,
    size: 10,
    total: 0
  });
  const filterModel = reactive<Api.Crm.InboxThreadFilterModel>(createDefaultInboxFilterModel());

  const mailboxOptions = computed(() =>
    mailboxRecords.value.map(mailbox => ({
      label: mailbox.maskedEmail,
      value: mailbox.id
    }))
  );

  onMounted(() => {
    applyRouteFilters();
    void Promise.all([loadThreads(), loadMailboxes()]);
  });

  watch(
    () => route.query,
    () => {
      if (route.name !== 'crm_inbox') return;

      applyRouteFilters();
      pagination.current = 1;
      void loadThreads();
    }
  );

  function applyRouteFilters() {
    const status = getRouteQueryString(route.query.status);

    filterModel.status = null;

    if (isInboxThreadStatus(status)) {
      filterModel.status = status;
    }
  }

  /** Load inbox threads and the pending count while ignoring stale responses. */
  async function loadThreads() {
    const requestId = latestListRequestId + 1;
    latestListRequestId = requestId;
    loading.value = true;

    try {
      const [threadResult, pendingResult] = await Promise.all([
        fetchCrmInboxThreads(
          buildInboxThreadSearchParams({
            current: pagination.current,
            size: pagination.size,
            filterModel
          })
        ),
        fetchCrmInboxThreads(buildInboxPendingCountParams(filterModel))
      ]);

      if (requestId !== latestListRequestId) {
        return;
      }

      if (pendingResult.error) {
        pendingTotal.value = 0;
      } else {
        pendingTotal.value = pendingResult.data.total;
      }

      if (threadResult.error) {
        return;
      }

      records.value = threadResult.data.records;
      pagination.current = threadResult.data.current;
      pagination.size = threadResult.data.size;
      pagination.total = threadResult.data.total;
    } finally {
      if (requestId === latestListRequestId) {
        loading.value = false;
      }
    }
  }

  /** Load active mailboxes for the optional inbox mailbox filter. */
  async function loadMailboxes() {
    const requestId = latestMailboxRequestId + 1;
    latestMailboxRequestId = requestId;
    mailboxLoading.value = true;

    try {
      const { data, error } = await fetchCrmMailboxes({ current: 1, size: 100, status: 'active' });

      if (error || requestId !== latestMailboxRequestId) {
        return;
      }

      mailboxRecords.value = data.records;
    } finally {
      if (requestId === latestMailboxRequestId) {
        mailboxLoading.value = false;
      }
    }
  }

  /** Load the currently selected thread detail and ignore stale drawer responses. */
  async function loadThreadDetail(id = selectedThreadId.value) {
    if (!id) {
      return;
    }

    const requestId = latestDetailRequestId + 1;
    latestDetailRequestId = requestId;
    detailLoading.value = true;

    try {
      const { data, error } = await fetchCrmInboxThreadDetail(id);

      if (error || requestId !== latestDetailRequestId || selectedThreadId.value !== id) {
        return;
      }

      currentDetail.value = data;
      syncReplyDraftFromDetail(data);
    } finally {
      if (requestId === latestDetailRequestId) {
        detailLoading.value = false;
      }
    }
  }

  /** Open detail drawer for one thread and start a fresh detail request. */
  function openThreadDetail(record: Api.Crm.InboxThreadRecord) {
    selectedThreadId.value = record.id;
    currentDetail.value = null;
    replyTopic.value = '';
    replyBody.value = '';
    detailVisible.value = true;
    void loadThreadDetail(record.id);
  }

  function handleDetailVisibleUpdate(show: boolean) {
    detailVisible.value = show;

    if (!show) {
      latestDetailRequestId += 1;
      selectedThreadId.value = null;
      currentDetail.value = null;
      replyTopic.value = '';
      replyBody.value = '';
      detailLoading.value = false;
    }
  }

  /** Update one thread status, then refresh list and matching open detail. */
  async function handleUpdateStatus(status: Api.Crm.InboxThreadStatus) {
    const threadId = selectedThreadId.value;

    if (!threadId) {
      return;
    }

    statusSubmitting.value = true;
    statusOperating.value = status;

    try {
      const { data, error } = await updateCrmInboxThreadStatus(threadId, { status });

      if (error || selectedThreadId.value !== threadId) {
        return;
      }

      message.success('收件箱状态已更新');
      currentDetail.value = currentDetail.value
        ? {
            ...currentDetail.value,
            account: data.account,
            thread: data.thread
          }
        : currentDetail.value;
      await loadThreads();

      if (detailVisible.value && selectedThreadId.value === threadId) {
        await loadThreadDetail(threadId);
      }
    } finally {
      statusSubmitting.value = false;
      statusOperating.value = null;
    }
  }

  /** Sync editable draft inputs from the owner-visible backend reply draft. */
  function syncReplyDraftFromDetail(detail: Api.Crm.InboxThreadDetail) {
    replyTopic.value = detail.replyDraft?.topic ?? '';
    replyBody.value = detail.replyDraft?.bodyText ?? '';
  }

  /** Ask AI to polish the user's reply topic into a local draft without sending Gmail. */
  async function handlePolishReplyDraft() {
    const threadId = selectedThreadId.value;
    const topic = replyTopic.value.trim();

    if (!threadId || draftPolishing.value) {
      return;
    }

    if (!currentDetail.value?.canOperate) {
      message.warning('当前账号不可润色该回复草稿');
      return;
    }

    if (!topic) {
      message.warning('请先填写回复主题或要点');
      return;
    }

    draftPolishing.value = true;
    try {
      const { data, error } = await polishCrmInboxReplyDraft(threadId, { topic });

      if (error || selectedThreadId.value !== threadId) {
        return;
      }

      message.success('AI 润色回复草稿已生成');
      currentDetail.value = data;
      syncReplyDraftFromDetail(data);
      await loadThreads();
    } finally {
      draftPolishing.value = false;
    }
  }

  /** Save the locally edited reply draft without triggering Gmail sending. */
  async function handleSaveReplyDraft() {
    const threadId = selectedThreadId.value;
    const topic = replyTopic.value.trim();
    const bodyText = replyBody.value.trim();

    if (!threadId || draftSaving.value) {
      return;
    }

    if (!currentDetail.value?.canOperate) {
      message.warning('当前账号不可保存该回复草稿');
      return;
    }

    if (!topic) {
      message.warning('请先填写回复主题或要点');
      return;
    }

    if (!bodyText) {
      message.warning('回复草稿正文不能为空');
      return;
    }

    draftSaving.value = true;
    try {
      const { data, error } = await saveCrmInboxReplyDraft(threadId, { topic, bodyText });

      if (error || selectedThreadId.value !== threadId) {
        return;
      }

      message.success('回复草稿已保存');
      currentDetail.value = data;
      syncReplyDraftFromDetail(data);
    } finally {
      draftSaving.value = false;
    }
  }

  /** Send the current reply body through the bound mailbox, then refresh detail and list. */
  async function handleSendReply() {
    const threadId = selectedThreadId.value;

    if (!threadId || replySending.value) {
      return;
    }

    const replyPayloadResult = buildInboxReplySubmitPayload({
      canOperate: Boolean(currentDetail.value?.canOperate),
      topic: replyTopic.value,
      bodyText: replyBody.value
    });

    if (!replyPayloadResult.ok) {
      message.warning(replyPayloadResult.message);
      return;
    }

    replySending.value = true;
    try {
      const { data, error } = await replyCrmInboxThread(threadId, replyPayloadResult.payload);

      if (error || selectedThreadId.value !== threadId) {
        return;
      }

      message.success('回复已发送');
      currentDetail.value = data;
      syncReplyDraftFromDetail(data);
      // 发送会改变线程消息、状态和列表统计，两个视图都重新拉取。
      await Promise.all([loadThreadDetail(threadId), loadThreads()]);
    } finally {
      replySending.value = false;
    }
  }

  /** Confirm a weak unsubscribe signal before applying blacklist side effects. */
  async function handleConfirmUnsubscribe(messageId: string) {
    const threadId = selectedThreadId.value;

    if (!threadId || unsubscribeConfirming.value) {
      return;
    }

    if (!currentDetail.value?.canOperate) {
      message.warning('当前账号不可确认该退订');
      return;
    }

    unsubscribeConfirming.value = true;
    try {
      const { data, error } = await confirmCrmInboxMessageUnsubscribe(messageId);

      if (error || selectedThreadId.value !== threadId) {
        return;
      }

      message.success('已确认退订并加入黑名单');
      currentDetail.value = data;
      syncReplyDraftFromDetail(data);
      await loadThreads();
    } finally {
      unsubscribeConfirming.value = false;
    }
  }

  function handleSearch() {
    pagination.current = 1;
    void loadThreads();
  }

  function handleReset() {
    Object.assign(filterModel, createDefaultInboxFilterModel());
    pagination.current = 1;
    void loadThreads();
  }

  function handlePageUpdate(page: number) {
    pagination.current = page;
    void loadThreads();
  }

  function handlePageSizeUpdate(pageSize: number) {
    pagination.size = pageSize;
    pagination.current = 1;
    void loadThreads();
  }

  return {
    currentDetail,
    detailLoading,
    detailVisible,
    draftPolishing,
    draftSaving,
    filterModel,
    handleDetailVisibleUpdate,
    handlePageSizeUpdate,
    handlePageUpdate,
    handlePolishReplyDraft,
    handleConfirmUnsubscribe,
    handleReset,
    handleSaveReplyDraft,
    handleSendReply,
    handleSearch,
    handleUpdateStatus,
    loadThreadDetail,
    loadThreads,
    loading,
    mailboxLoading,
    mailboxOptions,
    openThreadDetail,
    pagination,
    pendingTotal,
    records,
    replyBody,
    replySending,
    replyTopic,
    statusOperating,
    statusSubmitting,
    unsubscribeConfirming
  };
}

function getRouteQueryString(value: unknown) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return '';
}

function isInboxThreadStatus(value: string): value is Api.Crm.InboxThreadStatus {
  return ['pending', 'handled', 'archived'].includes(value);
}
