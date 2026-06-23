import { onMounted, reactive, shallowRef } from 'vue';
import { useMessage } from 'naive-ui';
import { notifyCrmWorkbenchChanged } from '@/hooks/business/crm-workbench-refresh';
import {
  createCrmGmailOAuthUrl,
  deleteCrmMailbox,
  fetchCrmMailboxes,
  pauseCrmMailbox,
  renewCrmMailboxWatch,
  resumeCrmMailbox,
  revokeCrmMailboxAuthorization,
  syncCrmMailboxNow
} from '@/service/api';
import { closePendingGmailOAuthTab, openGmailOAuthUrlInTab, openPendingGmailOAuthTab } from './mailbox-oauth-tab';
import { buildMailboxSearchParams, createDefaultMailboxFilterModel } from './shared';

export type MailboxOperationAction =
  | 'delete'
  | 'reauthorize'
  | 'renewWatch'
  | 'revokeAuthorization'
  | 'syncNow'
  | 'toggle';

export interface OperatingMailboxAction {
  action: MailboxOperationAction;
  id: string;
}

/** Manage CRM mailbox list requests, authorization modal state and row operations. */
export function useMailboxTable() {
  const message = useMessage();
  const records = shallowRef<Api.Crm.MailboxRecord[]>([]);
  const loading = shallowRef(false);
  const authorizeVisible = shallowRef(false);
  const authorizeSubmitting = shallowRef(false);
  const operatingMailboxAction = shallowRef<OperatingMailboxAction | null>(null);
  let latestRequestId = 0;

  const pagination = reactive({
    current: 1,
    size: 10,
    total: 0
  });

  const filterModel = reactive<Api.Crm.MailboxFilterModel>(createDefaultMailboxFilterModel());

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

  function handleAuthorizeVisibleUpdate(show: boolean) {
    authorizeVisible.value = show;
  }

  /** Create a Gmail OAuth URL and send the user to Google consent. */
  async function handleAuthorizeMailbox() {
    await redirectToGmailOAuth({
      loadingTarget: 'modal'
    });
  }

  /** Re-authorize an expired Gmail mailbox from the table row. */
  async function handleReauthorizeMailbox(record: Api.Crm.MailboxRecord) {
    if (
      operatingMailboxAction.value ||
      (record.status !== 'auth_expired' && record.status !== 'revoked') ||
      record.provider !== 'gmail'
    ) {
      return;
    }

    await redirectToGmailOAuth({
      loadingTarget: 'row',
      mailboxId: record.id
    });
  }

  /** Create a Gmail OAuth URL and open Google consent in a new browser tab. */
  async function redirectToGmailOAuth(options: { loadingTarget: 'modal' | 'row'; mailboxId?: string }) {
    const pendingTab = openPendingGmailOAuthTab();

    if (options.loadingTarget === 'modal') {
      authorizeSubmitting.value = true;
    } else {
      operatingMailboxAction.value = options.mailboxId ? { action: 'reauthorize', id: options.mailboxId } : null;
    }

    try {
      const { data, error } = await createCrmGmailOAuthUrl();

      if (error) {
        closePendingGmailOAuthTab(pendingTab);
        return;
      }

      const opened = openGmailOAuthUrlInTab(data.authorizationUrl, pendingTab);

      if (!opened) {
        message.warning('浏览器拦截了 Google 授权页，请允许弹窗后重试');
        return;
      }

      authorizeVisible.value = false;
      message.success('已在新标签页打开 Google 授权页');
    } finally {
      if (options.loadingTarget === 'modal') {
        authorizeSubmitting.value = false;
      } else {
        operatingMailboxAction.value = null;
      }
    }
  }

  /** Toggle one mailbox status, then refresh the current list. */
  async function handleToggleMailbox(record: Api.Crm.MailboxRecord) {
    if (operatingMailboxAction.value || record.status === 'auth_expired' || record.status === 'revoked') {
      return;
    }

    operatingMailboxAction.value = { action: 'toggle', id: record.id };

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
      operatingMailboxAction.value = null;
    }
  }

  /** Cancel one Gmail authorization while keeping the mailbox record reserved. */
  async function handleRevokeMailboxAuthorization(record: Api.Crm.MailboxRecord) {
    if (operatingMailboxAction.value || record.provider !== 'gmail' || record.status === 'revoked') {
      return;
    }

    operatingMailboxAction.value = { action: 'revokeAuthorization', id: record.id };

    try {
      const { error } = await revokeCrmMailboxAuthorization(record.id);

      if (error) {
        return;
      }

      message.success('Gmail 授权已取消，邮箱记录已保留');
      notifyCrmWorkbenchChanged();
      await loadMailboxes();
    } finally {
      operatingMailboxAction.value = null;
    }
  }

  /** Delete one unavailable mailbox and release its Gmail address for rebinding. */
  async function handleDeleteMailbox(record: Api.Crm.MailboxRecord) {
    if (operatingMailboxAction.value || (record.status !== 'auth_expired' && record.status !== 'revoked')) {
      return;
    }

    operatingMailboxAction.value = { action: 'delete', id: record.id };

    try {
      const { error } = await deleteCrmMailbox(record.id);

      if (error) {
        return;
      }

      message.success('邮箱已删除，邮箱地址可重新绑定');
      notifyCrmWorkbenchChanged();
      await loadMailboxes();
    } finally {
      operatingMailboxAction.value = null;
    }
  }

  /** Renew receive-sync subscription for one active mailbox, then refresh the current list. */
  async function handleRenewMailboxWatch(record: Api.Crm.MailboxRecord) {
    if (operatingMailboxAction.value || record.status !== 'active' || record.provider !== 'gmail') {
      return;
    }

    operatingMailboxAction.value = { action: 'renewWatch', id: record.id };

    try {
      const { error } = await renewCrmMailboxWatch(record.id);

      if (error) {
        return;
      }

      message.success('收信同步已续期');
      notifyCrmWorkbenchChanged();
      await loadMailboxes();
    } finally {
      operatingMailboxAction.value = null;
    }
  }

  /** Enqueue an immediate Gmail history sync for one active mailbox, then refresh the current list. */
  async function handleSyncMailboxNow(record: Api.Crm.MailboxRecord) {
    if (operatingMailboxAction.value || record.status !== 'active' || record.provider !== 'gmail') {
      return;
    }

    operatingMailboxAction.value = { action: 'syncNow', id: record.id };

    try {
      const { data, error } = await syncCrmMailboxNow(record.id);

      if (error) {
        return;
      }

      message.success(formatMailboxSyncResultMessage(data.sync));
      notifyCrmWorkbenchChanged();
      await loadMailboxes();
    } finally {
      operatingMailboxAction.value = null;
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

  function handlePageUpdate(page: number) {
    pagination.current = page;
    void loadMailboxes();
  }

  function handlePageSizeUpdate(pageSize: number) {
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
    handleDeleteMailbox,
    handlePageSizeUpdate,
    handlePageUpdate,
    handleReauthorizeMailbox,
    handleRenewMailboxWatch,
    handleRevokeMailboxAuthorization,
    handleReset,
    handleSearch,
    handleSyncMailboxNow,
    handleToggleMailbox,
    loadMailboxes,
    loading,
    openAuthorizeModal,
    operatingMailboxAction,
    pagination,
    records
  };
}

function formatMailboxSyncResultMessage(sync: Api.Crm.MailboxSyncNowResult['sync']) {
  if (sync.queued) {
    return 'Gmail 同步任务已入队';
  }

  return sync.reason === 'checkpoint_reinitialized' ? 'Gmail 同步检查点已重新初始化' : 'Gmail 同步检查点已更新';
}
