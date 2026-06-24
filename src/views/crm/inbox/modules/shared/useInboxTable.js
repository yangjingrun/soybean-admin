import { computed, onMounted, reactive, shallowRef, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { fetchCrmInboxThreads, fetchCrmMailboxes } from '@/service/api';
import { buildInboxPendingCountParams, buildInboxThreadSearchParams, createDefaultInboxFilterModel } from '../shared';
/** Manage CRM inbox thread list, stats, mailbox filters and detail navigation. */
export function useInboxTable() {
  const route = useRoute();
  const router = useRouter();
  const records = shallowRef([]);
  const mailboxRecords = shallowRef([]);
  const loading = shallowRef(false);
  const mailboxLoading = shallowRef(false);
  const pendingTotal = shallowRef(0);
  let latestListRequestId = 0;
  let latestMailboxRequestId = 0;
  const pagination = reactive({
    current: 1,
    size: 10,
    total: 0
  });
  const filterModel = reactive(createDefaultInboxFilterModel());
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
      const { data, error } = await fetchCrmMailboxes({
        current: 1,
        size: 100,
        status: 'active'
      });
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
  /** Open the standalone detail page for one thread. */
  function openThreadDetail(record) {
    void router.push(`/crm/inbox/detail/${record.id}`);
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
  function handlePageUpdate(page) {
    pagination.current = page;
    void loadThreads();
  }
  function handlePageSizeUpdate(pageSize) {
    pagination.size = pageSize;
    pagination.current = 1;
    void loadThreads();
  }
  return {
    filterModel,
    handlePageSizeUpdate,
    handlePageUpdate,
    handleReset,
    handleSearch,
    loadThreads,
    loading,
    mailboxLoading,
    mailboxOptions,
    openThreadDetail,
    pagination,
    pendingTotal,
    records
  };
}
function getRouteQueryString(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return '';
}
function isInboxThreadStatus(value) {
  return ['pending', 'handled', 'archived'].includes(value);
}
