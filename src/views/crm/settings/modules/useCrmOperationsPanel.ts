import { computed, onMounted, shallowRef } from 'vue';
import { fetchCrmMailboxes, fetchCrmSequenceReviewItems } from '@/service/api';
import { collectOperationQueueRows, summarizeMailboxSyncHealth } from './shared';

const OPERATIONS_PAGE_SIZE = 50;

/** Load the CRM records needed by the read-only operations overview. */
export function useCrmOperationsPanel() {
  const loading = shallowRef(false);
  const mailboxes = shallowRef<Api.Crm.MailboxRecord[]>([]);
  const sequenceItems = shallowRef<Api.Crm.SequenceReviewItem[]>([]);
  let latestRequestId = 0;

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
      const [mailboxResult, sequenceResult] = await Promise.all([
        fetchCrmMailboxes({ current: 1, size: OPERATIONS_PAGE_SIZE }),
        fetchCrmSequenceReviewItems({ current: 1, size: OPERATIONS_PAGE_SIZE })
      ]);

      if (mailboxResult.error || sequenceResult.error || requestId !== latestRequestId) {
        return;
      }

      mailboxes.value = mailboxResult.data.records;
      sequenceItems.value = sequenceResult.data.records;
    } finally {
      if (requestId === latestRequestId) {
        loading.value = false;
      }
    }
  }

  return {
    loadOperations,
    loading,
    mailboxHealth,
    mailboxes,
    queueRows
  };
}
