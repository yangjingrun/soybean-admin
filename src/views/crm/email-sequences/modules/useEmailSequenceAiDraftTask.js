import { onBeforeUnmount, shallowRef, watch } from 'vue';
import { useMessage } from 'naive-ui';
import { notifyCrmWorkbenchChanged } from '@/hooks/business/crm-workbench-refresh';
import {
  cancelCrmAiDraftTask,
  createCrmAiDraftTask,
  fetchCrmAiDraftTaskDetail,
  fetchCurrentCrmAiDraftTask,
  markCrmAiDraftTaskRead,
  retryFailedCrmAiDraftTask
} from '@/service/api';
import { canCreateAiDraftTaskForSequence } from './shared';
import { canApplyAiDraftTaskDetail, createAiDraftTaskPollingController } from './ai-draft-task-polling';
/** Manage CRM batch AI draft task lifecycle and live progress polling. */
export function useEmailSequenceAiDraftTask(options) {
  const message = useMessage();
  const aiDraftTaskDetail = shallowRef(null);
  const aiDraftTaskDrawerVisible = shallowRef(false);
  const aiDraftTaskLoading = shallowRef(false);
  const aiDraftTaskCreating = shallowRef(false);
  const aiDraftTaskRetrying = shallowRef(false);
  const aiDraftTaskCancelling = shallowRef(false);
  const aiDraftTaskReading = shallowRef(false);
  let latestAiDraftTaskRequestId = 0;
  const aiDraftTaskPolling = createAiDraftTaskPollingController({
    getDetail: () => aiDraftTaskDetail.value,
    intervalMs: 3000,
    isVisible: () => aiDraftTaskDrawerVisible.value,
    refresh: taskId => refreshAiDraftTaskDetail(taskId)
  });
  onBeforeUnmount(() => {
    aiDraftTaskPolling.dispose();
  });
  watch(
    [aiDraftTaskDrawerVisible, () => aiDraftTaskDetail.value?.task.status],
    () => {
      aiDraftTaskPolling.sync();
    },
    { immediate: true }
  );
  async function loadCurrentAiDraftTask() {
    const requestId = latestAiDraftTaskRequestId + 1;
    latestAiDraftTaskRequestId = requestId;
    aiDraftTaskLoading.value = true;
    try {
      const { data, error } = await fetchCurrentCrmAiDraftTask();
      if (error || requestId !== latestAiDraftTaskRequestId) {
        return;
      }
      aiDraftTaskDetail.value = data;
      aiDraftTaskDrawerVisible.value = Boolean(
        data && ['queued', 'running', 'failed', 'completed'].includes(data.task.status)
      );
    } finally {
      if (requestId === latestAiDraftTaskRequestId) {
        aiDraftTaskLoading.value = false;
      }
    }
  }
  async function refreshAiDraftTaskDetail(taskId = aiDraftTaskDetail.value?.task.id ?? null) {
    if (!taskId) {
      return;
    }
    const requestId = latestAiDraftTaskRequestId + 1;
    latestAiDraftTaskRequestId = requestId;
    aiDraftTaskLoading.value = true;
    try {
      const { data, error } = await fetchCrmAiDraftTaskDetail(taskId);
      if (error || requestId !== latestAiDraftTaskRequestId) {
        return;
      }
      if (!canApplyAiDraftTaskDetail(aiDraftTaskDetail.value, taskId)) {
        return;
      }
      aiDraftTaskDetail.value = data;
      aiDraftTaskDrawerVisible.value = true;
    } finally {
      if (requestId === latestAiDraftTaskRequestId) {
        aiDraftTaskLoading.value = false;
      }
    }
  }
  async function handleCreateAiDraftTask() {
    const executableRows = options.checkedRows.value.filter(canCreateAiDraftTaskForSequence);
    const ids = executableRows.map(item => item.enrollment.id);
    if (ids.length === 0) {
      message.warning('当前选中序列没有可 AI 生成草稿的记录');
      return;
    }
    aiDraftTaskCreating.value = true;
    try {
      const { data, error } = await createCrmAiDraftTask({ enrollmentIds: ids });
      if (error) {
        return;
      }
      aiDraftTaskDetail.value = data;
      aiDraftTaskDrawerVisible.value = true;
      options.clearSelection();
      message.success(data.task.pendingCount > 0 ? '批量 AI 草稿任务已创建' : '批量 AI 草稿任务已完成');
      notifyCrmWorkbenchChanged();
      await options.loadSequences();
    } finally {
      aiDraftTaskCreating.value = false;
    }
  }
  async function handleRetryAiDraftTask() {
    const taskId = aiDraftTaskDetail.value?.task.id;
    if (!taskId) {
      return;
    }
    aiDraftTaskRetrying.value = true;
    try {
      const { data, error } = await retryFailedCrmAiDraftTask(taskId);
      if (error) {
        return;
      }
      aiDraftTaskDetail.value = data;
      message.success('已重新排队可重试失败项');
      notifyCrmWorkbenchChanged();
    } finally {
      aiDraftTaskRetrying.value = false;
    }
  }
  async function handleCancelAiDraftTask() {
    const taskId = aiDraftTaskDetail.value?.task.id;
    if (!taskId) {
      return;
    }
    aiDraftTaskCancelling.value = true;
    try {
      const { data, error } = await cancelCrmAiDraftTask(taskId);
      if (error) {
        return;
      }
      aiDraftTaskDetail.value = data;
      message.success('批量 AI 草稿任务已取消');
      notifyCrmWorkbenchChanged();
      await options.loadSequences();
    } finally {
      aiDraftTaskCancelling.value = false;
    }
  }
  async function handleReadAiDraftTask() {
    const taskId = aiDraftTaskDetail.value?.task.id;
    if (!taskId) {
      aiDraftTaskDrawerVisible.value = false;
      return;
    }
    aiDraftTaskReading.value = true;
    try {
      const { error } = await markCrmAiDraftTaskRead(taskId);
      if (error) {
        return;
      }
      aiDraftTaskDrawerVisible.value = false;
      aiDraftTaskDetail.value = null;
      notifyCrmWorkbenchChanged();
      await options.loadSequences();
    } finally {
      aiDraftTaskReading.value = false;
    }
  }
  function handleAiDraftTaskDrawerVisibleUpdate(show) {
    aiDraftTaskDrawerVisible.value = show;
  }
  return {
    aiDraftTaskCancelling,
    aiDraftTaskCreating,
    aiDraftTaskDetail,
    aiDraftTaskDrawerVisible,
    aiDraftTaskLoading,
    aiDraftTaskReading,
    aiDraftTaskRetrying,
    handleAiDraftTaskDrawerVisibleUpdate,
    handleCancelAiDraftTask,
    handleCreateAiDraftTask,
    handleReadAiDraftTask,
    handleRetryAiDraftTask,
    loadCurrentAiDraftTask,
    refreshAiDraftTaskDetail
  };
}
