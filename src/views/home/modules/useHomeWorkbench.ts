import { computed, onMounted, onUnmounted, shallowRef } from 'vue';
import { useRouter } from 'vue-router';
import { fetchCrmWorkbenchOverview } from '@/service/api';
import {
  buildWorkbenchMetricCards,
  buildWorkbenchRecommendation,
  buildWorkbenchTodoItems,
  buildWorkbenchTrendOption,
  formatWorkbenchUpdatedAt,
  shouldPollWorkbench,
  type WorkbenchRouteTarget
} from './shared';

const pollingIntervalMs = 5000;

/** Manage today's personal CRM workbench data, polling and route actions. */
export function useHomeWorkbench() {
  const router = useRouter();
  const overview = shallowRef<Api.Crm.WorkbenchOverview | null>(null);
  const loading = shallowRef(false);
  const refreshing = shallowRef(false);
  const errorMessage = shallowRef('');
  let latestRequestId = 0;
  let pollingTimer: number | null = null;

  const recommendation = computed(() => buildWorkbenchRecommendation(overview.value));
  const metricCards = computed(() => buildWorkbenchMetricCards(overview.value));
  const todoItems = computed(() => buildWorkbenchTodoItems(overview.value));
  const trendOption = computed(() => buildWorkbenchTrendOption(overview.value?.trend ?? []));
  const lastUpdatedText = computed(() => formatWorkbenchUpdatedAt(overview.value?.generatedAt));

  onMounted(() => {
    void loadOverview();
  });

  onUnmounted(() => {
    stopPolling();
  });

  async function loadOverview() {
    await requestOverview('initial');
  }

  async function refreshOverview() {
    await requestOverview('refresh');
  }

  /** Navigate to the matching CRM module with the workbench filter context. */
  async function handleNavigate(target: WorkbenchRouteTarget) {
    if (!target.routePath) {
      await refreshOverview();
      return;
    }

    await router.push({
      path: target.routePath,
      query: target.query
    });
  }

  async function requestOverview(mode: 'initial' | 'refresh' | 'poll') {
    const requestId = latestRequestId + 1;
    latestRequestId = requestId;
    if (mode === 'initial') loading.value = true;
    if (mode === 'refresh') refreshing.value = true;

    try {
      const { data, error } = await fetchCrmWorkbenchOverview();

      if (error || requestId !== latestRequestId) {
        if (error && mode !== 'poll') errorMessage.value = '今日工作台加载失败';
        return;
      }

      errorMessage.value = '';
      overview.value = data;
      syncPolling();
    } finally {
      if (requestId === latestRequestId) {
        if (mode === 'initial') loading.value = false;
        if (mode === 'refresh') refreshing.value = false;
      }
    }
  }

  function syncPolling() {
    if (!shouldPollWorkbench(overview.value)) {
      stopPolling();
      return;
    }

    if (pollingTimer) return;

    pollingTimer = window.setInterval(() => {
      void requestOverview('poll');
    }, pollingIntervalMs);
  }

  function stopPolling() {
    if (!pollingTimer) return;

    window.clearInterval(pollingTimer);
    pollingTimer = null;
  }

  return {
    overview,
    loading,
    refreshing,
    errorMessage,
    recommendation,
    metricCards,
    todoItems,
    trendOption,
    lastUpdatedText,
    loadOverview,
    refreshOverview,
    handleNavigate
  };
}
