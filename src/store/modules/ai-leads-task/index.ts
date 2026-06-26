import { computed, shallowRef } from 'vue';
import { defineStore } from 'pinia';
import { SetupStoreId } from '@/enum';
import {
  fetchPendingSystemNotifications,
  markSystemNotificationRead,
  markSystemNotificationShown
} from '@/service/api/system-notification';

export const aiLeadsTaskNotificationPollIntervalMs = 5000;

interface StartAiLeadsTaskNotificationPollingOptions {
  intervalMs?: number;
}

/** Store for polling AI leads task notifications without owning presentation UI. */
export const useAiLeadsTaskNotificationStore = defineStore(SetupStoreId.AiLeadsTaskNotification, () => {
  const notifications = shallowRef<Api.SystemNotification.SystemNotification[]>([]);
  const isPolling = shallowRef(false);
  const isFetching = shallowRef(false);
  const pollTimer = shallowRef<ReturnType<typeof setInterval> | null>(null);

  const pendingCount = computed(() => notifications.value.length);

  /** Fetches pending notifications and replaces the local queue. */
  async function fetchPending() {
    if (isFetching.value) {
      return notifications.value;
    }

    isFetching.value = true;

    try {
      const { data, error } = await fetchPendingSystemNotifications();

      if (error) {
        return notifications.value;
      }

      notifications.value = data;

      return data;
    } finally {
      isFetching.value = false;
    }
  }

  /** Starts polling pending notifications until stop is called. */
  function start(options: StartAiLeadsTaskNotificationPollingOptions = {}) {
    if (isPolling.value) {
      return;
    }

    isPolling.value = true;
    void fetchPending();
    pollTimer.value = setInterval(() => {
      void fetchPending();
    }, options.intervalMs ?? aiLeadsTaskNotificationPollIntervalMs);
  }

  /** Stops polling pending notifications. */
  function stop() {
    if (pollTimer.value) {
      clearInterval(pollTimer.value);
      pollTimer.value = null;
    }

    isPolling.value = false;
  }

  /** Marks a notification shown and removes it from the pending queue. */
  async function markShown(id: string) {
    const { data, error } = await markSystemNotificationShown(id);

    if (error) {
      return null;
    }

    removeNotification(id);

    return data;
  }

  /** Marks a notification read and removes it from the pending queue. */
  async function markRead(id: string) {
    const { data, error } = await markSystemNotificationRead(id);

    if (error) {
      return null;
    }

    removeNotification(id);

    return data;
  }

  function removeNotification(id: string) {
    notifications.value = notifications.value.filter(notification => notification.id !== id);
  }

  return {
    notifications,
    isPolling,
    isFetching,
    pollTimer,
    pendingCount,
    fetchPending,
    start,
    stop,
    markShown,
    markRead
  };
});
