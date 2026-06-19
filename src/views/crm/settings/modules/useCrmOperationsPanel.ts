import { computed, onMounted, shallowRef } from 'vue';
import { fetchCrmMailboxes, fetchCrmSequenceReviewItems, fetchSystemLogs } from '@/service/api';
import { useAuthStore } from '@/store/modules/auth';
import { collectOperationQueueRows, collectRecentCrmOperationLogs, summarizeMailboxSyncHealth } from './shared';

const OPERATIONS_PAGE_SIZE = 50;
const OPERATION_LOG_PAGE_SIZE = 20;

/** Load the CRM records needed by the read-only operations overview. */
export function useCrmOperationsPanel() {
  const authStore = useAuthStore();
  const loading = shallowRef(false);
  const mailboxes = shallowRef<Api.Crm.MailboxRecord[]>([]);
  const operationLogs = shallowRef<Api.SystemLog.SystemLogRecord[]>([]);
  const sequenceItems = shallowRef<Api.Crm.SequenceReviewItem[]>([]);
  let latestRequestId = 0;

  const isSuperAdmin = computed(() => authStore.userInfo.roles.includes('R_SUPER'));
  const logRows = computed(() => collectRecentCrmOperationLogs(operationLogs.value));
  const queueRows = computed(() => collectOperationQueueRows(sequenceItems.value));
  const mailboxHealth = computed(() => summarizeMailboxSyncHealth(mailboxes.value));

  onMounted(() => {
    void loadOperations();
  });

  /** Refresh mailbox sync health and recent queued or failed messages together. */
  async function loadOperations() {
    const requestId = latestRequestId + 1;
    latestRequestId = requestId;
    loading.value = true;

    try {
      const [mailboxResult, sequenceResult, logResult] = await Promise.all([
        fetchCrmMailboxes({ current: 1, size: OPERATIONS_PAGE_SIZE }),
        fetchCrmSequenceReviewItems({ current: 1, size: OPERATIONS_PAGE_SIZE }),
        isSuperAdmin.value
          ? fetchSystemLogs({ current: 1, size: OPERATION_LOG_PAGE_SIZE, module: 'crm' })
          : Promise.resolve(null)
      ]);

      if (mailboxResult.error || sequenceResult.error || logResult?.error || requestId !== latestRequestId) {
        return;
      }

      mailboxes.value = mailboxResult.data.records;
      operationLogs.value = logResult?.data.records ?? [];
      sequenceItems.value = sequenceResult.data.records;
    } finally {
      if (requestId === latestRequestId) {
        loading.value = false;
      }
    }
  }

  return {
    isSuperAdmin,
    loadOperations,
    logRows,
    loading,
    mailboxHealth,
    mailboxes,
    queueRows
  };
}
