import { computed, onMounted, shallowRef } from 'vue';
import { useMessage } from 'naive-ui';
import {
  fetchCrmAiDraftTasks,
  fetchCrmMailboxes,
  fetchCrmSequenceReviewItems,
  fetchSystemLogs,
  reconcileCrmSendQueue
} from '@/service/api';
import { useAuthStore } from '@/store/modules/auth';
import {
  buildOperationLogSummaryRows,
  collectOperationQueueRows,
  collectRecentCrmOperationLogs,
  isActiveAiDraftTask,
  summarizeMailboxSyncHealth
} from './shared';

const OPERATIONS_PAGE_SIZE = 50;
const OPERATION_LOG_PAGE_SIZE = 20;

/** Load the CRM records needed by the read-only operations overview. */
export function useCrmOperationsPanel() {
  const message = useMessage();
  const authStore = useAuthStore();
  const loading = shallowRef(false);
  const sendQueueReconciling = shallowRef(false);
  const sendQueueReconcileResult = shallowRef<Api.Crm.SendQueueReconcileResult | null>(null);
  const mailboxes = shallowRef<Api.Crm.MailboxRecord[]>([]);
  const operationLogs = shallowRef<Api.SystemLog.SystemLogRecord[]>([]);
  const sequenceItems = shallowRef<Api.Crm.SequenceReviewItem[]>([]);
  const aiDraftTasks = shallowRef<Api.Crm.AiDraftTaskRecord[]>([]);
  let latestRequestId = 0;

  const isSuperAdmin = computed(() => authStore.userInfo.roles.includes('R_SUPER'));
  const logRows = computed(() => collectRecentCrmOperationLogs(operationLogs.value));
  const queueRows = computed(() => collectOperationQueueRows(sequenceItems.value));
  const activeAiDraftTaskCount = computed(() => aiDraftTasks.value.filter(isActiveAiDraftTask).length);
  const mailboxHealth = computed(() => summarizeMailboxSyncHealth(mailboxes.value));
  const operationSummaryRows = computed(() =>
    buildOperationLogSummaryRows({
      aiDraftTasks: aiDraftTasks.value,
      logs: operationLogs.value,
      mailboxes: mailboxes.value,
      queueRows: queueRows.value
    })
  );

  onMounted(() => {
    void loadOperations();
  });

  /** Refresh mailbox sync health and recent queued or failed messages together. */
  async function loadOperations() {
    const requestId = latestRequestId + 1;
    latestRequestId = requestId;
    loading.value = true;

    try {
      const [mailboxResult, sequenceResult, aiDraftTaskResult, logResult] = await Promise.all([
        fetchCrmMailboxes({ current: 1, size: OPERATIONS_PAGE_SIZE }),
        fetchCrmSequenceReviewItems({ current: 1, size: OPERATIONS_PAGE_SIZE }),
        fetchCrmAiDraftTasks({ current: 1, size: OPERATIONS_PAGE_SIZE }),
        isSuperAdmin.value
          ? fetchSystemLogs({ current: 1, size: OPERATION_LOG_PAGE_SIZE, module: 'crm' })
          : Promise.resolve(null)
      ]);

      if (
        mailboxResult.error ||
        sequenceResult.error ||
        aiDraftTaskResult.error ||
        logResult?.error ||
        requestId !== latestRequestId
      ) {
        return;
      }

      aiDraftTasks.value = aiDraftTaskResult.data.records;
      mailboxes.value = mailboxResult.data.records;
      operationLogs.value = logResult?.data.records ?? [];
      sequenceItems.value = sequenceResult.data.records;
    } finally {
      if (requestId === latestRequestId) {
        loading.value = false;
      }
    }
  }

  /** Repair queued messages whose BullMQ job has already disappeared. */
  async function handleReconcileSendQueue() {
    if (!isSuperAdmin.value || sendQueueReconciling.value) {
      return;
    }

    sendQueueReconciling.value = true;
    try {
      const { data, error } = await reconcileCrmSendQueue();

      if (error) {
        return;
      }

      sendQueueReconcileResult.value = data;
      message.success(`发送队列修复完成：修复 ${data.repairedCount} 条`);
      await loadOperations();
    } finally {
      sendQueueReconciling.value = false;
    }
  }

  return {
    activeAiDraftTaskCount,
    aiDraftTasks,
    handleReconcileSendQueue,
    isSuperAdmin,
    loadOperations,
    logRows,
    loading,
    mailboxHealth,
    mailboxes,
    operationSummaryRows,
    queueRows,
    sendQueueReconcileResult,
    sendQueueReconciling
  };
}
