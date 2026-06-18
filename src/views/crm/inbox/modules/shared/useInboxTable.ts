import { computed, onMounted, reactive, shallowRef } from 'vue';
import { useMessage } from 'naive-ui';
import {
  fetchCrmInboxThreadDetail,
  fetchCrmInboxThreads,
  fetchCrmMailboxes,
  updateCrmInboxThreadStatus
} from '@/service/api';
import { buildInboxPendingCountParams, buildInboxThreadSearchParams, createDefaultInboxFilterModel } from '../shared';

/** Manage CRM inbox thread list, stats, mailbox filters and drawer operations. */
export function useInboxTable() {
  const message = useMessage();
  const records = shallowRef<Api.Crm.InboxThreadRecord[]>([]);
  const mailboxRecords = shallowRef<Api.Crm.MailboxRecord[]>([]);
  const currentDetail = shallowRef<Api.Crm.InboxThreadDetail | null>(null);
  const loading = shallowRef(false);
  const mailboxLoading = shallowRef(false);
  const detailVisible = shallowRef(false);
  const detailLoading = shallowRef(false);
  const statusSubmitting = shallowRef(false);
  const statusOperating = shallowRef<Api.Crm.InboxThreadStatus | null>(null);
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
    void Promise.all([loadThreads(), loadMailboxes()]);
  });

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
    detailVisible.value = true;
    void loadThreadDetail(record.id);
  }

  function handleDetailVisibleUpdate(show: boolean) {
    detailVisible.value = show;

    if (!show) {
      latestDetailRequestId += 1;
      selectedThreadId.value = null;
      currentDetail.value = null;
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
    filterModel,
    handleDetailVisibleUpdate,
    handlePageSizeUpdate,
    handlePageUpdate,
    handleReset,
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
    statusOperating,
    statusSubmitting
  };
}
