import { computed, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useMessage } from 'naive-ui';
import { aiLeadsKeywordStrategyManagePermission, hasPermission } from '@soybean/shared';
import { useAuthStore } from '@/store/modules/auth';
import {
  createLeadSearchTask,
  deleteLeadKeywordHistory,
  discardLeadSearchTask,
  fetchLeadKeywordHistories,
  fetchCurrentLeadSearchTask,
  fetchLeadSearchTask,
  interruptLeadSearchTask,
  markLeadSearchTaskRead,
  optimizeLeadKeywords,
  resumeLeadSearchTask,
  retryLeadSearchTask,
  updateLeadKeywordHistory
} from '@/service/api';
import {
  canReturnToKeywordOptimizationStep,
  createLeadSearchProgressStateFromTask,
  createLeadSearchProgressState,
  getLeadSearchTaskActionState,
  isLeadSearchTaskPending,
  shouldClearSearchTaskAfterAction
} from './search-progress';
import type { LeadSearchProgressState, LeadSearchTaskAction } from './search-progress';
import { sortKeywordHistoryRecords } from './useAiLeadKeywordHistory';
import { createDefaultLeadSearchForm } from './useAiLeadKeywordOptimization';
import {
  createAiResultFromSearchTask,
  createStartingSearchProgressState,
  shouldRestoreSearchTaskAfterCreateRequestError
} from './useAiLeadSearchTask';
import {
  buildKeywordHistoryUpdatePayload,
  cloneKeywordPlan,
  createAiResultFromKeywordHistory,
  createKeywordOptimizationViewModel,
  formatAiFinishReason,
  formatKeywordOptimizationVisibleText,
  isValidTargetLeadCount,
  parseKeywordOptimizationPlan,
  resolveTargetLeadCountAfterOptimization
} from './shared';

type KeywordResultOrigin = 'none' | 'history' | 'generated' | 'task';

export function useAiLeadPage() {
  const message = useMessage();
  const route = useRoute();
  const router = useRouter();
  const authStore = useAuthStore();
  const defaultTargetLeadCount = 20;
  const maxLeadSearchRepeatRounds = 2;
  const searchTaskPollIntervalMs = 3000;

  const searchTaskStatusTextMap: Record<Api.AiLeads.TaskStatus, string> = {
    queued: '排队中',
    running: '采集中',
    interrupted: '已中断',
    failed: '失败',
    completed: '已完成',
    discarded: '已放弃'
  };

  const searchTaskStatusTypeMap: Record<Api.AiLeads.TaskStatus, 'default' | 'info' | 'success' | 'warning' | 'error'> =
    {
      queued: 'warning',
      running: 'info',
      interrupted: 'warning',
      failed: 'error',
      completed: 'success',
      discarded: 'default'
    };

  const searchTaskActionSuccessTextMap: Record<LeadSearchTaskAction, string> = {
    interrupt: '采集任务已中断',
    resume: '采集任务已继续',
    retry: '采集任务已重试',
    discard: '采集任务已放弃',
    read: '本次结果已收起，可以开始新的采集'
  };

  const form = reactive(createDefaultLeadSearchForm(defaultTargetLeadCount));

  const isGenerating = shallowRef(false);
  const generatingRequestId = shallowRef(0);
  const isSearchTaskSubmitting = shallowRef(false);
  const isSearchTaskActionLoading = shallowRef(false);
  const isHistoryLoading = shallowRef(false);
  const isHistorySaving = shallowRef(false);
  const isHistoryDrawerVisible = shallowRef(false);
  const isEditingResult = shallowRef(false);
  const searchTaskPollTimer = shallowRef<ReturnType<typeof setInterval> | null>(null);
  const deletingKeywordHistoryId = shallowRef('');
  const aiResult = shallowRef<Api.AiGateway.AiTextResult | null>(null);
  const searchProgress = ref<LeadSearchProgressState>(createLeadSearchProgressState());
  const currentSearchTask = shallowRef<Api.AiLeads.TaskRecord | null>(null);
  const keywordQualityWarnings = ref<string[]>([]);
  const historyRecords = ref<Api.AiLeads.KeywordHistoryRecord[]>([]);
  const editableKeywordPlan = ref<Api.AiLeads.OptimizedKeywordPlan | null>(null);
  const editingKeywordPlanSnapshot = ref<Api.AiLeads.OptimizedKeywordPlan | null>(null);
  const selectedHistoryId = shallowRef('');
  const isTargetLeadCountTouched = shallowRef(false);
  const keywordResultOrigin = shallowRef<KeywordResultOrigin>('none');

  const canGenerate = computed(() => Boolean(form.requirement.trim()));
  const isTargetLeadCountValid = computed(() => isValidTargetLeadCount(form.targetLeadCount));
  const targetLeadCountValidationStatus = computed(() => (isTargetLeadCountValid.value ? undefined : 'error'));
  const targetLeadCountFeedback = computed(() =>
    isTargetLeadCountValid.value ? undefined : '请输入 1-200 的采集数量'
  );
  const canSaveHistory = computed(() =>
    Boolean(selectedHistoryId.value && editableKeywordPlan.value && form.requirement.trim())
  );
  const isHistoryDeleting = computed(() => Boolean(deletingKeywordHistoryId.value));
  const canManageKeywordStrategy = computed(() =>
    hasPermission(authStore.userInfo, aiLeadsKeywordStrategyManagePermission)
  );
  const isSearchTaskPending = computed(() => isLeadSearchTaskPending(currentSearchTask.value?.status));
  const isSearching = computed(() => isSearchTaskSubmitting.value || isSearchTaskPending.value);
  const isLeadWorkflowRunning = computed(
    () => isGenerating.value || isSearching.value || isSearchTaskActionLoading.value
  );
  const canCreateSearchTask = computed(() => {
    if (!currentSearchTask.value) {
      return true;
    }

    return (
      currentSearchTask.value.status === 'completed' ||
      currentSearchTask.value.status === 'discarded' ||
      currentSearchTask.value.status === 'interrupted' ||
      currentSearchTask.value.status === 'failed' ||
      Boolean(currentSearchTask.value.readAt)
    );
  });
  const isSearchTaskBlockingForm = computed(() => Boolean(currentSearchTask.value) && !canCreateSearchTask.value);
  const parsedAiKeywordPlan = computed(() => {
    if (!aiResult.value?.text) {
      return null;
    }

    try {
      return parseKeywordOptimizationPlan(aiResult.value.text);
    } catch {
      return null;
    }
  });
  const keywordOptimizationPlan = computed(() => editableKeywordPlan.value || parsedAiKeywordPlan.value);
  const hasKeywordPlan = computed(() => Boolean(keywordOptimizationPlan.value));
  const canSearchCustomers = computed(
    () =>
      canGenerate.value &&
      hasKeywordPlan.value &&
      isTargetLeadCountValid.value &&
      !isGenerating.value &&
      !isSearching.value &&
      !isSearchTaskActionLoading.value &&
      canCreateSearchTask.value
  );
  const canStartLeadWorkflow = computed(
    () =>
      canGenerate.value &&
      isTargetLeadCountValid.value &&
      !isLeadWorkflowRunning.value &&
      canCreateSearchTask.value &&
      !isHistorySaving.value &&
      !isHistoryDeleting.value
  );
  const canStopLeadWorkflow = computed(
    () => isGenerating.value || isLeadSearchTaskPending(currentSearchTask.value?.status)
  );
  const leadWorkflowStatusLabel = computed(() => {
    if (isGenerating.value) {
      return '正在分析需求';
    }

    if (isSearchTaskSubmitting.value || isLeadSearchTaskPending(currentSearchTask.value?.status)) {
      return '正在搜索客户';
    }

    return '';
  });
  const keywordOptimizationViewModel = computed(() =>
    keywordOptimizationPlan.value
      ? createKeywordOptimizationViewModel(keywordOptimizationPlan.value, canManageKeywordStrategy.value)
      : null
  );
  const aiFinishReasonLabel = computed(() => formatAiFinishReason(aiResult.value?.finishReason));
  const currentHistoryRecord = computed(
    () => historyRecords.value.find(record => record.id === selectedHistoryId.value) || null
  );
  const hasSearchProgress = computed(
    () =>
      Boolean(currentSearchTask.value) ||
      isSearching.value ||
      searchProgress.value.status !== 'idle' ||
      Boolean(searchProgress.value.result)
  );
  const isRestoredKeywordHistory = computed(
    () => keywordResultOrigin.value === 'history' && Boolean(currentHistoryRecord.value) && !hasSearchProgress.value
  );
  const canReturnToKeywordStep = computed(
    () =>
      canReturnToKeywordOptimizationStep(searchProgress.value, isSearching.value) &&
      (!currentSearchTask.value ||
        currentSearchTask.value.status === 'completed' ||
        currentSearchTask.value.status === 'discarded' ||
        Boolean(currentSearchTask.value.readAt))
  );
  const currentWorkflowStepLabel = computed(() =>
    hasSearchProgress.value ? '搜索采集' : isRestoredKeywordHistory.value ? '历史记录' : '关键词优化'
  );
  const searchTaskActionState = computed(() =>
    getLeadSearchTaskActionState(currentSearchTask.value?.status, currentSearchTask.value?.readAt)
  );
  const currentSearchTaskStatusLabel = computed(() =>
    currentSearchTask.value ? searchTaskStatusTextMap[currentSearchTask.value.status] : ''
  );
  const currentSearchTaskStatusType = computed(() =>
    currentSearchTask.value ? searchTaskStatusTypeMap[currentSearchTask.value.status] : 'default'
  );

  onMounted(() => {
    void initPage();
  });

  watch(
    () => normalizeRouteTaskId(route.query.taskId),
    taskId => {
      void restoreCurrentSearchTask(taskId);
    }
  );

  onBeforeUnmount(() => {
    stopSearchTaskPolling();
  });

  async function initPage() {
    await loadKeywordHistories();
    await restoreCurrentSearchTask(normalizeRouteTaskId(route.query.taskId));
  }

  /** Calls the AI leads keyword optimization workflow. */
  async function handleGenerate() {
    if (isSearchTaskBlockingForm.value) {
      message.warning('请先处理当前采集任务');
      return;
    }

    if (!(await prepareCompletedSearchTaskForNextWorkflow())) {
      return;
    }

    const requestId = generatingRequestId.value + 1;
    generatingRequestId.value = requestId;
    const targetLeadCount = form.targetLeadCount;
    const isTargetLeadCountManuallyEdited = isTargetLeadCountTouched.value;
    isGenerating.value = true;
    resetSearchProgress();

    try {
      const { data: result, error } = await optimizeLeadKeywords({
        requirement: form.requirement.trim(),
        leadSourceMode: form.leadSourceMode
      });

      if (error) {
        return;
      }

      if (requestId !== generatingRequestId.value) {
        return;
      }

      aiResult.value = result;
      keywordQualityWarnings.value = result.qualityWarnings ?? [];
      upsertHistoryRecord(result.historyRecord);
      applyKeywordHistoryRecord(result.historyRecord, { syncTargetLeadCount: false, origin: 'generated' });
      form.targetLeadCount = resolveTargetLeadCountAfterOptimization({
        currentValue: targetLeadCount,
        resolvedValue: result.historyRecord.keywordPlan.resolvedTargetLeadCount,
        isManuallyEdited: isTargetLeadCountManuallyEdited,
        defaultValue: defaultTargetLeadCount
      });
      isTargetLeadCountTouched.value = isTargetLeadCountManuallyEdited;
      message.success('生成完成');
    } finally {
      if (requestId === generatingRequestId.value) {
        isGenerating.value = false;
      }
    }
  }

  /** Stops showing the current keyword optimization request and ignores its late response. */
  function handleCancelGenerate() {
    if (!isGenerating.value) {
      return;
    }

    generatingRequestId.value += 1;
    isGenerating.value = false;
    message.info('已中断本次重新优化');
  }

  /** Starts the simplest lead workflow: reuse a matching strategy or optimize first, then collect. */
  async function handleStartLeadWorkflow() {
    if (!canGenerate.value) {
      message.warning('请先填写获客需求');
      return;
    }

    const targetLeadCount = getRequiredTargetLeadCount();
    if (!targetLeadCount) {
      message.warning('请输入 1-200 的采集数量');
      return;
    }

    if (isLeadWorkflowRunning.value) {
      return;
    }

    if (!(await discardRecoverableSearchTaskForNextWorkflow())) {
      return;
    }

    if (!(await prepareCompletedSearchTaskForNextWorkflow())) {
      return;
    }

    const reusableKeywordPlan = resolveReusableKeywordPlan();
    const workflowInput = reusableKeywordPlan
      ? { keywordPlan: reusableKeywordPlan, targetLeadCount }
      : await runKeywordOptimizationForWorkflow(targetLeadCount);

    if (!workflowInput) {
      return;
    }

    await createLeadSearchTaskWithPlan(workflowInput.keywordPlan, workflowInput.targetLeadCount);
  }

  /** Stops the visible one-click workflow, including the hidden optimization stage. */
  async function handleStopLeadWorkflow() {
    if (isGenerating.value) {
      generatingRequestId.value += 1;
      isGenerating.value = false;
      message.info('已停止本次获客');
      return;
    }

    const task = currentSearchTask.value;
    if (!task || isSearchTaskActionLoading.value) {
      return;
    }

    isSearchTaskActionLoading.value = true;

    try {
      const { data: interruptedTask, error: interruptError } =
        task.status === 'running' ? await interruptLeadSearchTask(task.id) : { data: task, error: null };

      if (interruptError) {
        await syncCurrentSearchTaskAfterRequestError();
        return;
      }

      const { error } = await discardLeadSearchTask(interruptedTask.id);

      if (error) {
        await syncCurrentSearchTaskAfterRequestError();
        return;
      }

      clearHandledSearchTaskContext('discard');
      message.info('已停止本次获客');
    } finally {
      isSearchTaskActionLoading.value = false;
    }
  }

  /** Clears a failed or interrupted task before starting a fresh one-click workflow. */
  async function discardRecoverableSearchTaskForNextWorkflow() {
    const task = currentSearchTask.value;

    if (!task || (task.status !== 'interrupted' && task.status !== 'failed')) {
      return true;
    }

    isSearchTaskActionLoading.value = true;

    try {
      const { error } = await discardLeadSearchTask(task.id);

      if (error) {
        await syncCurrentSearchTaskAfterRequestError();
        return false;
      }

      clearHandledSearchTaskContext('discard');
      return true;
    } finally {
      isSearchTaskActionLoading.value = false;
    }
  }

  /** Creates a background search task and restores its persisted progress state. */
  async function handleSearchCustomers() {
    if (isSearching.value) {
      return;
    }

    if (isGenerating.value) {
      message.warning('关键词生成中，请稍后再开始采集');
      return;
    }

    if (!hasKeywordPlan.value) {
      message.warning('请先优化关键词，再开始采集');
      return;
    }

    const keywordPlan = keywordOptimizationPlan.value;
    if (!keywordPlan) {
      message.warning('请先优化关键词，再开始采集');
      return;
    }

    const targetLeadCount = getRequiredTargetLeadCount();
    if (!targetLeadCount) {
      message.warning('请输入 1-200 的采集数量');
      return;
    }

    if (!(await prepareCompletedSearchTaskForNextWorkflow())) {
      return;
    }

    await createLeadSearchTaskWithPlan(keywordPlan, targetLeadCount);
  }

  async function createLeadSearchTaskWithPlan(keywordPlan: Api.AiLeads.OptimizedKeywordPlan, targetLeadCount: number) {
    isSearchTaskSubmitting.value = true;
    keywordQualityWarnings.value = [];
    searchProgress.value = createStartingSearchProgressState();

    try {
      const { data: task, error } = await createLeadSearchTask({
        requirement: form.requirement.trim(),
        targetLeadCount,
        keywordPlan: cloneKeywordPlan(keywordPlan)
      });

      if (error) {
        await syncCurrentSearchTaskAfterRequestError({
          clearWhenEmpty: true,
          shouldRestoreTask: shouldRestoreSearchTaskAfterCreateRequestError
        });
        return;
      }

      applySearchTaskRecord(task, { notifyStatusChange: false });
      message.success('采集任务已创建，后台执行中');
    } finally {
      isSearchTaskSubmitting.value = false;
    }
  }

  async function runKeywordOptimizationForWorkflow(targetLeadCount: number) {
    const requestId = generatingRequestId.value + 1;
    generatingRequestId.value = requestId;
    const isTargetLeadCountManuallyEdited = isTargetLeadCountTouched.value;
    isGenerating.value = true;
    resetSearchProgress();

    try {
      const { data: result, error } = await optimizeLeadKeywords({
        requirement: form.requirement.trim(),
        leadSourceMode: form.leadSourceMode
      });

      if (error || requestId !== generatingRequestId.value) {
        return null;
      }

      aiResult.value = result;
      keywordQualityWarnings.value = result.qualityWarnings ?? [];
      upsertHistoryRecord(result.historyRecord);
      applyKeywordHistoryRecord(result.historyRecord, { syncTargetLeadCount: false, origin: 'generated' });

      const resolvedTargetLeadCount = resolveTargetLeadCountAfterOptimization({
        currentValue: targetLeadCount,
        resolvedValue: result.historyRecord.keywordPlan.resolvedTargetLeadCount,
        isManuallyEdited: isTargetLeadCountManuallyEdited,
        defaultValue: defaultTargetLeadCount
      });
      form.targetLeadCount = resolvedTargetLeadCount;
      isTargetLeadCountTouched.value = isTargetLeadCountManuallyEdited;

      return {
        keywordPlan: cloneKeywordPlan(result.historyRecord.keywordPlan),
        targetLeadCount: resolvedTargetLeadCount ?? targetLeadCount
      };
    } finally {
      if (requestId === generatingRequestId.value) {
        isGenerating.value = false;
      }
    }
  }

  function resolveReusableKeywordPlan() {
    const keywordPlan = keywordOptimizationPlan.value;

    if (!keywordPlan || resolveLeadSourceMode(keywordPlan) !== form.leadSourceMode) {
      return null;
    }

    const currentRequirement = normalizeLeadRequirement(form.requirement);
    const reusableRequirement = currentHistoryRecord.value?.requirement || currentSearchTask.value?.requirement || '';

    return normalizeLeadRequirement(reusableRequirement) === currentRequirement ? cloneKeywordPlan(keywordPlan) : null;
  }

  async function handleSearchTaskAction(action: LeadSearchTaskAction) {
    const task = currentSearchTask.value;

    if (!task) {
      return;
    }

    isSearchTaskActionLoading.value = true;

    try {
      const { data: nextTask, error } = await runSearchTaskAction(action, task.id);

      if (error) {
        await syncCurrentSearchTaskAfterRequestError();
        return;
      }

      if (shouldClearSearchTaskAfterAction(action)) {
        clearHandledSearchTaskContext(action);
      } else {
        applySearchTaskRecord(nextTask, { notifyStatusChange: false });
      }

      message.success(searchTaskActionSuccessTextMap[action]);
    } finally {
      isSearchTaskActionLoading.value = false;
    }
  }

  async function handleClear() {
    if (isSearchTaskBlockingForm.value) {
      message.warning('请先处理当前采集任务');
      return;
    }

    if (!(await prepareCompletedSearchTaskForNextWorkflow())) {
      return;
    }

    resetSearchProgress();
    form.requirement = '';
    form.targetLeadCount = defaultTargetLeadCount;
    form.leadSourceMode = 'search';
    isTargetLeadCountTouched.value = false;
    aiResult.value = null;
    keywordQualityWarnings.value = [];
    editableKeywordPlan.value = null;
    editingKeywordPlanSnapshot.value = null;
    selectedHistoryId.value = '';
    keywordResultOrigin.value = 'none';
    isEditingResult.value = false;
  }

  async function handleCopyResult() {
    if (!aiResult.value?.text) {
      return;
    }

    const copyText =
      canManageKeywordStrategy.value || !keywordOptimizationViewModel.value
        ? aiResult.value.text
        : formatKeywordOptimizationVisibleText(keywordOptimizationViewModel.value);

    await navigator.clipboard.writeText(copyText);
    message.success('结果已复制');
  }

  /** Opens the CRM lead queue filtered to the completed AI collection task. */
  async function handleProcessCollectedLeads() {
    const task = currentSearchTask.value;

    if (!task?.id) {
      return;
    }

    if (!(await markCompletedTaskRead(task))) {
      return;
    }

    await router.push({
      path: '/crm/leads',
      query: { sourceTaskId: task.id }
    });
  }

  /** Restores the task that should keep showing when the user enters the page. */
  async function restoreCurrentSearchTask(taskId?: string) {
    const request = taskId ? fetchLeadSearchTask(taskId) : fetchCurrentLeadSearchTask();
    const { data: task, error } = await request;

    if (error || !task) {
      return;
    }

    applySearchTaskRecord(task, { notifyStatusChange: false });
  }

  /** Loads keyword histories and selects the newest one by default. */
  async function loadKeywordHistories() {
    isHistoryLoading.value = true;

    try {
      const { data: result, error } = await fetchLeadKeywordHistories({ size: 20 });

      if (error) {
        return;
      }

      historyRecords.value = result.records;
      if (!selectedHistoryId.value && result.records[0]) {
        applyKeywordHistoryRecord(result.records[0]);
      }
    } finally {
      isHistoryLoading.value = false;
    }
  }

  function handleSelectHistory(record: Api.AiLeads.KeywordHistoryRecord) {
    applyKeywordHistoryRecord(record);
    isHistoryDrawerVisible.value = false;
  }

  /** Deletes one history record and keeps the current selection in sync. */
  async function handleDeleteHistory(record: Api.AiLeads.KeywordHistoryRecord) {
    deletingKeywordHistoryId.value = record.id;

    try {
      const { error } = await deleteLeadKeywordHistory(record.id);

      if (error) {
        return;
      }

      const nextRecords = historyRecords.value.filter(item => item.id !== record.id);
      historyRecords.value = nextRecords;

      // 删除当前记录后，切到剩余最新记录；没有历史时清空当前结果。
      if (record.id === selectedHistoryId.value) {
        if (nextRecords[0]) {
          applyKeywordHistoryRecord(nextRecords[0]);
        } else {
          resetKeywordHistorySelection();
        }
      }

      message.success('删除完成');
    } finally {
      deletingKeywordHistoryId.value = '';
    }
  }

  async function handleDeleteCurrentHistory() {
    if (!currentHistoryRecord.value) {
      return;
    }

    await handleDeleteHistory(currentHistoryRecord.value);
  }

  function handleStartEdit() {
    if (!keywordOptimizationPlan.value) {
      return;
    }

    editingKeywordPlanSnapshot.value = cloneKeywordPlan(keywordOptimizationPlan.value);
    editableKeywordPlan.value = cloneKeywordPlan(keywordOptimizationPlan.value);
    isEditingResult.value = true;
  }

  function handleCancelEdit() {
    editableKeywordPlan.value = editingKeywordPlanSnapshot.value
      ? cloneKeywordPlan(editingKeywordPlanSnapshot.value)
      : null;
    editingKeywordPlanSnapshot.value = null;
    isEditingResult.value = false;
  }

  async function handleSaveHistory() {
    if (!selectedHistoryId.value || !editableKeywordPlan.value) {
      return;
    }

    isHistorySaving.value = true;

    try {
      const { data: record, error } = await updateLeadKeywordHistory(
        selectedHistoryId.value,
        buildKeywordHistoryUpdatePayload(form.requirement, editableKeywordPlan.value)
      );

      if (error) {
        return;
      }

      upsertHistoryRecord(record);
      applyKeywordHistoryRecord(record, {
        origin: keywordResultOrigin.value === 'generated' ? 'generated' : 'history'
      });
      message.success('保存完成');
    } finally {
      isHistorySaving.value = false;
    }
  }

  function applyKeywordHistoryRecord(
    record: Api.AiLeads.KeywordHistoryRecord,
    options: { syncTargetLeadCount?: boolean; origin?: Extract<KeywordResultOrigin, 'history' | 'generated'> } = {}
  ) {
    selectedHistoryId.value = record.id;
    keywordResultOrigin.value = options.origin ?? 'history';
    form.requirement = record.requirement;
    form.leadSourceMode = resolveLeadSourceMode(record.keywordPlan);
    if (options.syncTargetLeadCount !== false) {
      form.targetLeadCount = resolveTargetLeadCountAfterOptimization({
        currentValue: defaultTargetLeadCount,
        resolvedValue: record.keywordPlan.resolvedTargetLeadCount,
        isManuallyEdited: false,
        defaultValue: defaultTargetLeadCount
      });
      isTargetLeadCountTouched.value = false;
    }
    aiResult.value = createAiResultFromKeywordHistory(record);
    keywordQualityWarnings.value = [];
    editableKeywordPlan.value = cloneKeywordPlan(record.keywordPlan);
    editingKeywordPlanSnapshot.value = null;
    resetSearchProgress();
    isEditingResult.value = false;
  }

  function applySearchTaskRecord(task: Api.AiLeads.TaskRecord, options: { notifyStatusChange?: boolean } = {}) {
    const previousStatus = currentSearchTask.value?.status ?? null;

    currentSearchTask.value = task;
    form.requirement = task.requirement;
    form.targetLeadCount = task.targetLeadCount;
    form.leadSourceMode = resolveLeadSourceMode(task.keywordPlan);
    isTargetLeadCountTouched.value = false;
    aiResult.value = createAiResultFromSearchTask(task);
    keywordQualityWarnings.value = [];
    editableKeywordPlan.value = cloneKeywordPlan(task.keywordPlan);
    editingKeywordPlanSnapshot.value = null;
    searchProgress.value = createLeadSearchProgressStateFromTask(task);
    keywordResultOrigin.value = 'task';
    isEditingResult.value = false;

    if (isLeadSearchTaskPending(task.status)) {
      startSearchTaskPolling(task.id);
    } else {
      stopSearchTaskPolling();
    }

    if (options.notifyStatusChange !== false && previousStatus && previousStatus !== task.status) {
      notifySearchTaskStatusChange(task);
    }
  }

  function resetKeywordHistorySelection() {
    selectedHistoryId.value = '';
    isTargetLeadCountTouched.value = false;
    aiResult.value = null;
    keywordQualityWarnings.value = [];
    editableKeywordPlan.value = null;
    editingKeywordPlanSnapshot.value = null;
    keywordResultOrigin.value = 'none';
    resetSearchProgress();
    isEditingResult.value = false;
  }

  function upsertHistoryRecord(record: Api.AiLeads.KeywordHistoryRecord) {
    const nextRecords = historyRecords.value.filter(item => item.id !== record.id);

    historyRecords.value = sortKeywordHistoryRecords([record, ...nextRecords]);
  }

  /** Reads the required target lead count after form validation has passed. */
  function getRequiredTargetLeadCount() {
    return isTargetLeadCountValid.value ? form.targetLeadCount : null;
  }

  /** Tracks direct edits so AI optimization does not overwrite an explicit user count. */
  function handleTargetLeadCountUpdate(value: number | null) {
    isTargetLeadCountTouched.value = true;
    form.targetLeadCount = value;
  }

  /** Returns to the optimized keyword result while keeping the current keyword plan intact. */
  async function handleReturnToKeywordOptimization() {
    if (!(await prepareCompletedSearchTaskForNextWorkflow())) {
      return;
    }

    resetSearchProgress();
  }

  /** Marks a completed task read before the user leaves its result and starts another workflow. */
  async function prepareCompletedSearchTaskForNextWorkflow() {
    const task = currentSearchTask.value;

    if (task?.status !== 'completed') {
      return true;
    }

    if (!(await markCompletedTaskRead(task))) {
      return false;
    }

    resetSearchProgress();
    return true;
  }

  /** Marks one completed task read without clearing the visible result panel. */
  async function markCompletedTaskRead(task: Api.AiLeads.TaskRecord) {
    if (task.status !== 'completed' || task.readAt) {
      return true;
    }

    isSearchTaskActionLoading.value = true;

    try {
      const { error } = await markLeadSearchTaskRead(task.id);

      if (error) {
        await syncCurrentSearchTaskAfterRequestError();
        return false;
      }

      return true;
    } finally {
      isSearchTaskActionLoading.value = false;
    }
  }

  /** Clears previous local search progress and stops frontend polling. */
  function resetSearchProgress() {
    stopSearchTaskPolling();
    currentSearchTask.value = null;
    searchProgress.value = createLeadSearchProgressState();
  }

  /** Refreshes persisted task state after a failed request may have changed backend status. */
  async function syncCurrentSearchTaskAfterRequestError(
    options: { clearWhenEmpty?: boolean; shouldRestoreTask?: (task: Api.AiLeads.TaskRecord) => boolean } = {}
  ) {
    const { data: task, error } = await fetchCurrentLeadSearchTask();

    if (error) {
      if (options.clearWhenEmpty) {
        resetSearchProgress();
      }
      return;
    }

    if (task) {
      if (options.shouldRestoreTask && !options.shouldRestoreTask(task)) {
        resetSearchProgress();
        return;
      }

      applySearchTaskRecord(task, { notifyStatusChange: false });
      return;
    }

    if (options.clearWhenEmpty) {
      resetSearchProgress();
    }
  }

  /** Clears handled task state; read tasks require fresh keyword optimization before another collection. */
  function clearHandledSearchTaskContext(action: LeadSearchTaskAction) {
    resetSearchProgress();

    if (action !== 'read') {
      return;
    }

    aiResult.value = null;
    keywordQualityWarnings.value = [];
    editableKeywordPlan.value = null;
    editingKeywordPlanSnapshot.value = null;
    selectedHistoryId.value = '';
    keywordResultOrigin.value = 'none';
    isEditingResult.value = false;
  }

  function startSearchTaskPolling(taskId: string) {
    if (searchTaskPollTimer.value) {
      return;
    }

    searchTaskPollTimer.value = setInterval(() => {
      void refreshSearchTask(taskId);
    }, searchTaskPollIntervalMs);
  }

  function stopSearchTaskPolling() {
    if (!searchTaskPollTimer.value) {
      return;
    }

    clearInterval(searchTaskPollTimer.value);
    searchTaskPollTimer.value = null;
  }

  async function refreshSearchTask(taskId: string) {
    const { data: task, error } = await fetchLeadSearchTask(taskId);

    if (error) {
      return;
    }

    if (currentSearchTask.value?.id !== taskId) {
      return;
    }

    applySearchTaskRecord(task);
  }

  function runSearchTaskAction(action: LeadSearchTaskAction, taskId: string) {
    const actionMap = {
      interrupt: interruptLeadSearchTask,
      resume: resumeLeadSearchTask,
      retry: retryLeadSearchTask,
      discard: discardLeadSearchTask,
      read: markLeadSearchTaskRead
    };

    return actionMap[action](taskId);
  }

  function notifySearchTaskStatusChange(task: Api.AiLeads.TaskRecord) {
    if (task.status === 'completed') {
      message.success('搜索采集完成');
    }

    if (task.status === 'failed') {
      message.error(task.errorMessage || '搜索采集失败，请稍后重试');
    }
  }

  return {
    aiFinishReasonLabel,
    aiResult,
    canGenerate,
    canManageKeywordStrategy,
    canReturnToKeywordStep,
    canSaveHistory,
    canSearchCustomers,
    canStartLeadWorkflow,
    canStopLeadWorkflow,
    currentHistoryRecord,
    currentSearchTask,
    currentSearchTaskStatusLabel,
    currentSearchTaskStatusType,
    currentWorkflowStepLabel,
    deletingKeywordHistoryId,
    editableKeywordPlan,
    form,
    handleCancelEdit,
    handleClear,
    handleCancelGenerate,
    handleCopyResult,
    handleDeleteCurrentHistory,
    handleDeleteHistory,
    handleGenerate,
    handleProcessCollectedLeads,
    handleReturnToKeywordOptimization,
    handleSaveHistory,
    handleSearchCustomers,
    handleSearchTaskAction,
    handleSelectHistory,
    handleStartLeadWorkflow,
    handleStartEdit,
    handleStopLeadWorkflow,
    handleTargetLeadCountUpdate,
    hasSearchProgress,
    historyRecords,
    isEditingResult,
    isGenerating,
    isHistoryDeleting,
    isHistoryDrawerVisible,
    isHistoryLoading,
    isHistorySaving,
    isRestoredKeywordHistory,
    isSearchTaskActionLoading,
    isSearchTaskBlockingForm,
    isSearchTaskPending,
    isSearchTaskSubmitting,
    isSearching,
    isLeadWorkflowRunning,
    keywordOptimizationViewModel,
    keywordQualityWarnings,
    leadWorkflowStatusLabel,
    maxLeadSearchRepeatRounds,
    searchProgress,
    searchTaskActionState,
    selectedHistoryId,
    targetLeadCountFeedback,
    targetLeadCountValidationStatus
  };
}

function normalizeRouteTaskId(taskId: string | null | Array<string | null> | undefined) {
  if (Array.isArray(taskId)) {
    return taskId.find(Boolean) || undefined;
  }

  return taskId || undefined;
}

function normalizeLeadRequirement(requirement: string) {
  return requirement.trim().replace(/\s+/g, ' ');
}

function resolveLeadSourceMode(plan: Api.AiLeads.OptimizedKeywordPlan): Api.AiLeads.LeadSourceMode {
  const mapsCount = plan.serperMapsQueries?.length ?? 0;
  const searchCount = plan.serperSearchQueries?.length ?? 0;
  const placesCount = plan.serperPlacesQueries?.length ?? 0;

  return mapsCount > 0 && searchCount === 0 && placesCount === 0 ? 'maps' : 'search';
}
