import { computed, onMounted, provide, reactive, shallowRef, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useMessage } from 'naive-ui';
import { notifyCrmWorkbenchChanged } from '@/hooks/business/crm-workbench-refresh';
import {
  batchApproveCrmMessageDrafts,
  batchGenerateCrmNextSequenceDrafts,
  batchStopCrmSequenceEnrollments,
  fetchCrmSequenceReviewItems
} from '@/service/api';
import {
  buildSequenceBatchResultDisplayItems,
  buildSequenceReviewSearchParams,
  canApproveSequenceDraftInBatch,
  canGenerateNextSequenceDraft,
  createDefaultSequenceFilterModel,
  formatSequenceBatchResultText,
  getStoppableSequenceIds,
  sequenceBatchResultDisplayKey,
  type SequenceBatchResultDisplayItem
} from './shared';
import { useDraftReviewFlow } from './useDraftReviewFlow';
import { useEmailSequenceAiDraftTask } from './useEmailSequenceAiDraftTask';
import { useSequenceCreateFlow } from './useSequenceCreateFlow';

/** Manage sequence review list, batch operations and page-level flow composition. */
export function useEmailSequenceTable() {
  const message = useMessage();
  const route = useRoute();
  const records = shallowRef<Api.Crm.SequenceReviewItem[]>([]);
  const checkedRowKeys = shallowRef<string[]>([]);
  const batchNextDraftResultDisplays = shallowRef<SequenceBatchResultDisplayItem[]>([]);
  const loading = shallowRef(false);
  const batchDraftApproving = shallowRef(false);
  const batchNextDraftGenerating = shallowRef(false);
  const batchSequenceStopping = shallowRef(false);
  let latestListRequestId = 0;

  const pagination = reactive({
    current: 1,
    size: 10,
    total: 0
  });
  const filterModel = reactive<Api.Crm.SequenceReviewFilterModel>(createDefaultSequenceFilterModel());

  const checkedRows = computed(() => {
    const checkedSet = new Set(checkedRowKeys.value);

    return records.value.filter(record => checkedSet.has(record.enrollment.id));
  });
  const draftReviewFlow = useDraftReviewFlow({
    loadSequences
  });
  const createFlow = useSequenceCreateFlow({
    async onCreated(item) {
      draftReviewFlow.openCreatedReviewItem(item);
      pagination.current = 1;
      await loadSequences();
    }
  });
  const {
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
  } = useEmailSequenceAiDraftTask({
    checkedRows,
    clearSelection: () => {
      checkedRowKeys.value = [];
    },
    loadSequences
  });

  provide(sequenceBatchResultDisplayKey, batchNextDraftResultDisplays);

  onMounted(() => {
    applyRouteFilters();
    void loadSequences();
    void loadCurrentAiDraftTask();

    const accountId = getRouteQueryString(route.query.accountId);
    const contactId = getRouteQueryString(route.query.contactId);

    if (accountId && contactId) {
      void createFlow.openCreateModalWithSelection(accountId, contactId);
      return;
    }

    void createFlow.loadCreateResources();
  });

  watch(
    () => route.query,
    () => {
      if (route.name !== 'crm_email-sequences') return;

      applyRouteFilters();
      pagination.current = 1;
      void loadSequences();
    }
  );

  function applyRouteFilters() {
    const status = getRouteQueryString(route.query.status);
    const todoType = getRouteQueryString(route.query.todoType);
    const messageStatus = getRouteQueryString(route.query.messageStatus);
    const dateScope = getRouteQueryString(route.query.dateScope);

    filterModel.status = null;
    filterModel.todoType = null;
    filterModel.messageStatus = null;
    filterModel.dateScope = null;

    if (isSequenceEnrollmentStatus(status)) filterModel.status = status;
    if (isSequenceReviewTodoType(todoType)) filterModel.todoType = todoType;
    if (isMessageStatus(messageStatus)) filterModel.messageStatus = messageStatus;
    if (dateScope === 'today') filterModel.dateScope = dateScope;
  }

  /** Load review items with backend pagination and ignore stale responses. */
  async function loadSequences() {
    const requestId = latestListRequestId + 1;
    latestListRequestId = requestId;
    loading.value = true;

    try {
      const { data, error } = await fetchCrmSequenceReviewItems(
        buildSequenceReviewSearchParams({
          current: pagination.current,
          size: pagination.size,
          filterModel
        })
      );

      if (error || requestId !== latestListRequestId) {
        return;
      }

      records.value = data.records;
      pagination.current = data.current;
      pagination.size = data.size;
      pagination.total = data.total;
      checkedRowKeys.value = checkedRowKeys.value.filter(id =>
        data.records.some(record => record.enrollment.id === id)
      );
    } finally {
      if (requestId === latestListRequestId) {
        loading.value = false;
      }
    }
  }

  async function handleBatchGenerateNextDrafts() {
    const executableRows = checkedRows.value.filter(canGenerateNextSequenceDraft);
    const ids = executableRows.map(item => item.enrollment.id);

    if (ids.length === 0) {
      message.warning('当前选中开发信任务没有可生成下一封的记录');
      return;
    }

    batchNextDraftResultDisplays.value = [];
    batchNextDraftGenerating.value = true;

    try {
      const { data, error } = await batchGenerateCrmNextSequenceDrafts({ ids });

      if (error) {
        return;
      }

      batchNextDraftResultDisplays.value = buildSequenceBatchResultDisplayItems(data);
      const resultText = formatSequenceBatchResultText('批量生成下一封草稿', data);
      if (data.failedCount > 0) {
        message.warning(resultText);
      } else {
        message.success(resultText);
      }
      notifyCrmWorkbenchChanged();
      checkedRowKeys.value = [];
      await loadSequences();
    } finally {
      batchNextDraftGenerating.value = false;
    }
  }

  async function handleBatchApproveDrafts() {
    const executableRows = checkedRows.value.filter(canApproveSequenceDraftInBatch);
    const ids = executableRows.map(item => item.enrollment.id);

    if (ids.length === 0) {
      message.warning('当前选中开发信任务没有可确认的开发信');
      return;
    }

    batchNextDraftResultDisplays.value = [];
    batchDraftApproving.value = true;

    try {
      const { data, error } = await batchApproveCrmMessageDrafts({ ids });

      if (error) {
        return;
      }

      const resultText = formatSequenceBatchResultText('批量确认草稿', data);
      if (data.failedCount > 0) {
        message.warning(resultText);
      } else {
        message.success(resultText);
      }
      notifyCrmWorkbenchChanged();
      checkedRowKeys.value = [];
      await loadSequences();
    } finally {
      batchDraftApproving.value = false;
    }
  }

  async function handleBatchStopSequences() {
    const ids = getStoppableSequenceIds(checkedRows.value);

    if (ids.length === 0) {
      message.warning('当前选中开发信任务没有可停止的记录');
      return;
    }

    batchNextDraftResultDisplays.value = [];
    batchSequenceStopping.value = true;

    try {
      const { data, error } = await batchStopCrmSequenceEnrollments({ ids });

      if (error) {
        return;
      }

      const resultText = formatSequenceBatchResultText('批量停止跟进', data);
      if (data.failedCount > 0) {
        message.warning(resultText);
      } else {
        message.success(resultText);
      }
      notifyCrmWorkbenchChanged();
      checkedRowKeys.value = [];
      await loadSequences();
    } finally {
      batchSequenceStopping.value = false;
    }
  }

  function handleSearch() {
    pagination.current = 1;
    void loadSequences();
  }

  function handleReset() {
    Object.assign(filterModel, createDefaultSequenceFilterModel());
    pagination.current = 1;
    void loadSequences();
  }

  function handlePageUpdate(page: number) {
    pagination.current = page;
    void loadSequences();
  }

  function handlePageSizeUpdate(pageSize: number) {
    pagination.size = pageSize;
    pagination.current = 1;
    void loadSequences();
  }

  function handleCheckedRowKeysUpdate(keys: Array<string | number>) {
    checkedRowKeys.value = keys.map(String);
  }

  return {
    accountSelectOptions: createFlow.accountSelectOptions,
    aiDraftTaskCancelling,
    aiDraftTaskCreating,
    aiDraftTaskDetail,
    aiDraftTaskDrawerVisible,
    aiDraftTaskLoading,
    aiDraftTaskReading,
    aiDraftTaskRetrying,
    batchDraftApproving,
    batchNextDraftGenerating,
    batchSequenceStopping,
    checkedRowKeys,
    contactSelectOptions: createFlow.contactSelectOptions,
    createForm: createFlow.createForm,
    createSubmitting: createFlow.createSubmitting,
    createVisible: createFlow.createVisible,
    currentItem: draftReviewFlow.currentItem,
    detailRefreshing: draftReviewFlow.detailRefreshing,
    draftApproving: draftReviewFlow.draftApproving,
    draftSaving: draftReviewFlow.draftSaving,
    draftVersionLoading: draftReviewFlow.draftVersionLoading,
    draftVersionRestoring: draftReviewFlow.draftVersionRestoring,
    draftVersions: draftReviewFlow.draftVersions,
    drawerLoading: draftReviewFlow.drawerLoading,
    drawerVisible: draftReviewFlow.drawerVisible,
    filterModel,
    handleAccountChange: createFlow.handleAccountChange,
    handleApproveDraft: draftReviewFlow.handleApproveDraft,
    handleBatchApproveDrafts,
    handleBatchGenerateNextDrafts,
    handleBatchStopSequences,
    handleAiDraftTaskDrawerVisibleUpdate,
    handleCancelAiDraftTask,
    handleCheckedRowKeysUpdate,
    handleCreateAiDraftTask,
    handleCreateReviewItem: createFlow.handleCreateReviewItem,
    handleCreateVisibleUpdate: createFlow.handleCreateVisibleUpdate,
    handleDrawerVisibleUpdate: draftReviewFlow.handleDrawerVisibleUpdate,
    handleGenerateNextDraft: draftReviewFlow.handleGenerateNextDraft,
    handlePageSizeUpdate,
    handlePageUpdate,
    handleReset,
    handleRefreshCurrentSequence: draftReviewFlow.handleRefreshCurrentSequence,
    handleReadAiDraftTask,
    handleRetryAiDraftTask,
    handleRestoreDraftVersion: draftReviewFlow.handleRestoreDraftVersion,
    handleSaveDraft: draftReviewFlow.handleSaveDraft,
    handleSearch,
    handleStartSend: draftReviewFlow.handleStartSend,
    handleStopSequence: draftReviewFlow.handleStopSequence,
    loadCreateResources: createFlow.loadCreateResources,
    loadCurrentAiDraftTask,
    loadDraftVersions: draftReviewFlow.loadDraftVersions,
    loadSequences,
    loading,
    mailboxSelectOptions: createFlow.mailboxSelectOptions,
    nextDraftGenerating: draftReviewFlow.nextDraftGenerating,
    openCreateModal: createFlow.openCreateModal,
    openDraftDrawer: draftReviewFlow.openDraftDrawer,
    pagination,
    productLineSelectOptions: createFlow.productLineSelectOptions,
    records,
    refreshAiDraftTaskDetail,
    resourceLoading: createFlow.resourceLoading,
    sendStarting: draftReviewFlow.sendStarting,
    sequencePolicySelectOptions: createFlow.sequencePolicySelectOptions,
    sequenceStopping: draftReviewFlow.sequenceStopping
  };
}

function getRouteQueryString(value: unknown) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return '';
}

function isSequenceEnrollmentStatus(value: string): value is Api.Crm.SequenceEnrollmentStatus {
  return [
    'draft_review_pending',
    'ready_to_send',
    'sequence_running',
    'paused',
    'stopped',
    'replied',
    'archived'
  ].includes(value);
}

function isSequenceReviewTodoType(value: string): value is Api.Crm.SequenceReviewTodoType {
  return [
    'draft_review_pending',
    'follow_up_draft_review',
    'ready_to_start',
    'can_generate_next',
    'send_failed',
    'max_steps_reached'
  ].includes(value);
}

function isMessageStatus(value: string): value is Api.Crm.MessageStatus {
  return ['draft_pending_review', 'draft_ready', 'queued', 'sent', 'failed', 'skipped'].includes(value);
}
