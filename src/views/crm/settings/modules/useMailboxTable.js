import { onMounted, reactive, shallowRef } from 'vue';
import { useMessage } from 'naive-ui';
import { notifyCrmWorkbenchChanged } from '@/hooks/business/crm-workbench-refresh';
import {
  createCrmGmailOAuthUrl,
  fetchCrmMailboxes,
  pauseCrmMailbox,
  renewCrmMailboxWatch,
  resumeCrmMailbox,
  syncCrmMailboxNow
} from '@/service/api';
import { buildMailboxSearchParams, createDefaultMailboxFilterModel } from './shared';
/** Manage CRM mailbox list requests, authorization modal state and row operations. */
export function useMailboxTable() {
  const message = useMessage();
  const records = shallowRef([]);
  const loading = shallowRef(false);
  const authorizeVisible = shallowRef(false);
  const authorizeSubmitting = shallowRef(false);
  const operatingMailboxId = shallowRef(null);
  let latestRequestId = 0;
  const pagination = reactive({
    current: 1,
    size: 10,
    total: 0
  });
  const filterModel = reactive(createDefaultMailboxFilterModel());
  onMounted(() => {
    void loadMailboxes();
  });
  /** Load mailboxes with backend pagination and ignore stale responses. */
  async function loadMailboxes() {
    const requestId = latestRequestId + 1;
    latestRequestId = requestId;
    loading.value = true;
    try {
      const { data, error } = await fetchCrmMailboxes(
        buildMailboxSearchParams({
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
  function openAuthorizeModal() {
    authorizeVisible.value = true;
  }
  function handleAuthorizeVisibleUpdate(show) {
    authorizeVisible.value = show;
  }
  /** Create a Gmail OAuth URL and send the user to Google consent. */
  async function handleAuthorizeMailbox() {
    await redirectToGmailOAuth({
      loadingTarget: 'modal'
    });
  }
  /** Re-authorize an expired Gmail mailbox from the table row. */
  async function handleReauthorizeMailbox(record) {
    if (operatingMailboxId.value || record.status !== 'auth_expired' || record.provider !== 'gmail') {
      return;
    }
    await redirectToGmailOAuth({
      loadingTarget: 'row',
      mailboxId: record.id
    });
  }
  /** Create a Gmail OAuth URL and redirect to Google consent. */
  async function redirectToGmailOAuth(options) {
    if (options.loadingTarget === 'modal') {
      authorizeSubmitting.value = true;
    } else {
      operatingMailboxId.value = options.mailboxId ?? null;
    }
    try {
      const { data, error } = await createCrmGmailOAuthUrl();
      if (error) {
        return;
      }
      window.location.assign(data.authorizationUrl);
    } finally {
      if (options.loadingTarget === 'modal') {
        authorizeSubmitting.value = false;
      } else {
        operatingMailboxId.value = null;
      }
    }
  }
  /** Toggle one mailbox status, then refresh the current list. */
  async function handleToggleMailbox(record) {
    if (operatingMailboxId.value || record.status === 'auth_expired') {
      return;
    }
    operatingMailboxId.value = record.id;
    try {
      const request = record.status === 'active' ? pauseCrmMailbox : resumeCrmMailbox;
      const { error } = await request(record.id);
      if (error) {
        return;
      }
      message.success(record.status === 'active' ? '邮箱已暂停' : '邮箱已恢复');
      notifyCrmWorkbenchChanged();
      await loadMailboxes();
    } finally {
      operatingMailboxId.value = null;
    }
  }
  /** Renew Gmail watch for one active mailbox, then refresh the current list. */
  async function handleRenewMailboxWatch(record) {
    if (operatingMailboxId.value || record.status !== 'active' || record.provider !== 'gmail') {
      return;
    }
    operatingMailboxId.value = record.id;
    try {
      const { error } = await renewCrmMailboxWatch(record.id);
      if (error) {
        return;
      }
      message.success('Gmail watch 已续订');
      notifyCrmWorkbenchChanged();
      await loadMailboxes();
    } finally {
      operatingMailboxId.value = null;
    }
  }
  /** Enqueue an immediate Gmail history sync for one active mailbox, then refresh the current list. */
  async function handleSyncMailboxNow(record) {
    if (operatingMailboxId.value || record.status !== 'active' || record.provider !== 'gmail') {
      return;
    }
    operatingMailboxId.value = record.id;
    try {
      const { data, error } = await syncCrmMailboxNow(record.id);
      if (error) {
        return;
      }
      message.success(formatMailboxSyncResultMessage(data.sync));
      notifyCrmWorkbenchChanged();
      await loadMailboxes();
    } finally {
      operatingMailboxId.value = null;
    }
  }
  function handleSearch() {
    pagination.current = 1;
    void loadMailboxes();
  }
  function handleReset() {
    Object.assign(filterModel, createDefaultMailboxFilterModel());
    pagination.current = 1;
    void loadMailboxes();
  }
  function handlePageUpdate(page) {
    pagination.current = page;
    void loadMailboxes();
  }
  function handlePageSizeUpdate(pageSize) {
    pagination.size = pageSize;
    pagination.current = 1;
    void loadMailboxes();
  }
  return {
    authorizeSubmitting,
    authorizeVisible,
    filterModel,
    handleAuthorizeMailbox,
    handleAuthorizeVisibleUpdate,
    handlePageSizeUpdate,
    handlePageUpdate,
    handleReauthorizeMailbox,
    handleRenewMailboxWatch,
    handleReset,
    handleSearch,
    handleSyncMailboxNow,
    handleToggleMailbox,
    loadMailboxes,
    loading,
    openAuthorizeModal,
    operatingMailboxId,
    pagination,
    records
  };
}
function formatMailboxSyncResultMessage(sync) {
  if (sync.queued) {
    return 'Gmail 同步任务已入队';
  }
  return sync.reason === 'checkpoint_reinitialized' ? 'Gmail 同步检查点已重新初始化' : 'Gmail 同步检查点已更新';
}
