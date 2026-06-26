import { shallowRef } from 'vue';
import { useMessage } from 'naive-ui';
import { notifyCrmWorkbenchChanged } from '@/hooks/business/crm-workbench-refresh';
import {
  approveCrmMessageDraft,
  fetchCrmMessageDraftVersions,
  fetchCrmSequenceReviewItem,
  generateCrmNextSequenceDraft,
  regenerateCrmMessageAiDraft,
  resumeCrmSequenceEnrollment,
  retryCrmFirstMessageSend,
  returnCrmFirstMessageToEdit,
  restoreCrmMessageDraftVersion,
  startCrmFirstMessageSend,
  stopCrmSequenceEnrollment,
  updateCrmMessageDraft
} from '@/service/api';
import {
  canRegenerateAiDraft,
  canGenerateNextSequenceDraft,
  canOperateSelectedSequenceDraft,
  canResumeSequence,
  canRetryFirstMessageSend,
  canReturnFirstMessageToEdit,
  getPendingReviewMessage,
  shouldQueueFirstMessageAfterApproval,
  type DraftReviewApprovePayload,
  type DraftReviewSavePayload
} from './shared';

interface UseDraftReviewFlowOptions {
  loadSequences: () => Promise<void>;
  onCreatedReviewItem?: () => void;
}

/** Manage the draft review drawer and all selected-message async guards. */
export function useDraftReviewFlow(options: UseDraftReviewFlowOptions) {
  const message = useMessage();
  const currentItem = shallowRef<Api.Crm.SequenceReviewItem | null>(null);
  const draftVersions = shallowRef<Api.Crm.MessageDraftVersionRecord[]>([]);
  const drawerVisible = shallowRef(false);
  const drawerLoading = shallowRef(false);
  const draftSaving = shallowRef(false);
  const draftApproving = shallowRef(false);
  const draftRegenerating = shallowRef(false);
  const draftVersionLoading = shallowRef(false);
  const draftVersionRestoring = shallowRef(false);
  const detailRefreshing = shallowRef(false);
  const nextDraftGenerating = shallowRef(false);
  const returnEditing = shallowRef(false);
  const sequenceResuming = shallowRef(false);
  const sendStarting = shallowRef(false);
  const sendRetrying = shallowRef(false);
  const sequenceStopping = shallowRef(false);
  const selectedEnrollmentId = shallowRef<string | null>(null);
  const selectedMessageId = shallowRef<string | null>(null);
  let latestDetailRequestId = 0;
  let latestDraftApproveRequestId = 0;
  let latestDraftSaveRequestId = 0;
  let latestDraftVersionRequestId = 0;
  let latestDraftVersionRestoreRequestId = 0;
  let latestNextDraftGenerateRequestId = 0;
  let latestDraftRegenerateRequestId = 0;
  let latestReturnEditRequestId = 0;
  let latestResumeRequestId = 0;
  let latestRetrySendRequestId = 0;

  function openCreatedReviewItem(item: Api.Crm.SequenceReviewItem) {
    currentItem.value = item;
    selectedEnrollmentId.value = item.enrollment.id;
    selectedMessageId.value = item.firstMessage?.id ?? null;
    drawerVisible.value = true;
    options.onCreatedReviewItem?.();
  }

  async function openDraftDrawer(row: Api.Crm.SequenceReviewItem) {
    latestDraftApproveRequestId += 1;
    latestDraftSaveRequestId += 1;
    latestDraftVersionRequestId += 1;
    latestDraftVersionRestoreRequestId += 1;
    selectedEnrollmentId.value = row.enrollment.id;
    selectedMessageId.value = getPendingReviewMessage(row.messages)?.id ?? row.firstMessage?.id ?? null;
    currentItem.value = null;
    draftVersions.value = [];
    drawerVisible.value = true;
    await loadSequenceDetail(row.enrollment.id);
  }

  /** Opens one sequence directly from a route focus query and selects the target message. */
  async function openFocusedSequence(enrollmentId: string, messageId: string) {
    latestDraftApproveRequestId += 1;
    latestDraftSaveRequestId += 1;
    latestDraftVersionRequestId += 1;
    latestDraftVersionRestoreRequestId += 1;
    selectedEnrollmentId.value = enrollmentId;
    selectedMessageId.value = messageId;
    currentItem.value = null;
    draftVersions.value = [];
    drawerVisible.value = true;
    await loadSequenceDetail(enrollmentId);
  }

  async function loadSequenceDetail(id: string) {
    const requestId = latestDetailRequestId + 1;
    latestDetailRequestId = requestId;
    drawerLoading.value = true;

    try {
      const { data, error } = await fetchCrmSequenceReviewItem(id);

      if (error || requestId !== latestDetailRequestId) {
        return;
      }

      if (selectedEnrollmentId.value !== data.enrollment.id) {
        return;
      }

      currentItem.value = data;
      selectedMessageId.value =
        data.messages.find(reviewMessage => reviewMessage.id === selectedMessageId.value)?.id ??
        data.firstMessage?.id ??
        null;
      if (selectedMessageId.value) {
        void loadDraftVersions(selectedMessageId.value);
      }
    } finally {
      if (requestId === latestDetailRequestId) {
        drawerLoading.value = false;
      }
    }
  }

  async function handleSaveDraft(payload: DraftReviewSavePayload) {
    const { messageId } = payload;

    if (!messageId || !currentItem.value) {
      return;
    }

    const enrollmentId = currentItem.value.enrollment.id;
    const targetMessage = currentItem.value.messages.find(messageRecord => messageRecord.id === messageId);

    if (!canOperateSelectedSequenceDraft(currentItem.value, targetMessage ?? null)) {
      return;
    }

    selectedMessageId.value = messageId;
    const requestId = latestDraftSaveRequestId + 1;
    latestDraftSaveRequestId = requestId;
    draftSaving.value = true;

    try {
      const { data, error } = await updateCrmMessageDraft(messageId, payload.draft);

      if (error || requestId !== latestDraftSaveRequestId) {
        return;
      }

      if (selectedEnrollmentId.value !== enrollmentId || selectedMessageId.value !== messageId || !currentItem.value) {
        return;
      }

      message.success('开发信修改已保存');
      currentItem.value = replaceReviewMessage(currentItem.value, data.message);
      await loadDraftVersions(messageId);
      await options.loadSequences();
    } finally {
      if (requestId === latestDraftSaveRequestId) {
        draftSaving.value = false;
      }
    }
  }

  /** Load saved draft versions for one selected owner message. */
  async function loadDraftVersions(messageId: string | null) {
    draftVersions.value = [];

    if (!messageId) {
      return;
    }

    const requestId = latestDraftVersionRequestId + 1;
    latestDraftVersionRequestId = requestId;
    draftVersionLoading.value = true;

    try {
      const { data, error } = await fetchCrmMessageDraftVersions(messageId);

      if (error || requestId !== latestDraftVersionRequestId) {
        return;
      }

      if (selectedMessageId.value !== messageId) {
        return;
      }

      draftVersions.value = data.versions;
    } finally {
      if (requestId === latestDraftVersionRequestId) {
        draftVersionLoading.value = false;
      }
    }
  }

  async function handleRestoreDraftVersion(payload: { messageId: string; versionId: string }) {
    const enrollmentId = selectedEnrollmentId.value;

    if (!enrollmentId || !currentItem.value) {
      return;
    }

    const targetMessage = currentItem.value.messages.find(messageRecord => messageRecord.id === payload.messageId);

    if (!canOperateSelectedSequenceDraft(currentItem.value, targetMessage ?? null)) {
      return;
    }

    selectedMessageId.value = payload.messageId;
    const requestId = latestDraftVersionRestoreRequestId + 1;
    latestDraftVersionRestoreRequestId = requestId;
    draftVersionRestoring.value = true;

    try {
      const { data, error } = await restoreCrmMessageDraftVersion(payload.messageId, payload.versionId);

      if (error || requestId !== latestDraftVersionRestoreRequestId) {
        return;
      }

      if (
        selectedEnrollmentId.value !== enrollmentId ||
        selectedMessageId.value !== payload.messageId ||
        !currentItem.value
      ) {
        return;
      }

      message.success('草稿历史版本已恢复');
      currentItem.value = replaceReviewMessage(currentItem.value, data.message);
      await loadDraftVersions(payload.messageId);
      await options.loadSequences();
    } finally {
      if (requestId === latestDraftVersionRestoreRequestId) {
        draftVersionRestoring.value = false;
      }
    }
  }

  async function handleApproveDraft(payload: DraftReviewApprovePayload) {
    const { messageId } = payload;

    if (!messageId || !currentItem.value) {
      return;
    }

    const enrollmentId = currentItem.value.enrollment.id;
    const targetMessage = currentItem.value.messages.find(messageRecord => messageRecord.id === messageId);

    if (!canOperateSelectedSequenceDraft(currentItem.value, targetMessage ?? null)) {
      return;
    }

    selectedMessageId.value = messageId;
    const requestId = latestDraftApproveRequestId + 1;
    latestDraftApproveRequestId = requestId;
    draftApproving.value = true;

    try {
      const { data, error } = await approveCrmMessageDraft(messageId);

      if (error || requestId !== latestDraftApproveRequestId) {
        return;
      }

      if (selectedEnrollmentId.value !== enrollmentId || selectedMessageId.value !== messageId || !currentItem.value) {
        return;
      }

      const approvedItem = replaceReviewMessage(
        {
          ...currentItem.value,
          enrollment: data.enrollment
        },
        data.message
      );

      if (shouldQueueFirstMessageAfterApproval(data.enrollment, data.message)) {
        const startResult = await startCrmFirstMessageSend(data.enrollment.id);

        if (startResult.error || requestId !== latestDraftApproveRequestId) {
          return;
        }

        if (
          selectedEnrollmentId.value !== enrollmentId ||
          selectedMessageId.value !== messageId ||
          !currentItem.value
        ) {
          return;
        }

        message.success('开发信已确认，并等待发送');
        notifyCrmWorkbenchChanged();
        currentItem.value = replaceReviewMessage(
          {
            ...approvedItem,
            account: startResult.data.account,
            enrollment: startResult.data.enrollment
          },
          startResult.data.message
        );
        await loadSequenceDetail(startResult.data.enrollment.id);
        await options.loadSequences();
        return;
      }

      message.success(data.message.status === 'queued' ? '开发信已确认，并等待发送' : '开发信已确认');
      notifyCrmWorkbenchChanged();
      currentItem.value = approvedItem;
      await loadSequenceDetail(data.enrollment.id);
      await options.loadSequences();
    } finally {
      if (requestId === latestDraftApproveRequestId) {
        draftApproving.value = false;
      }
    }
  }

  async function handleRegenerateAiDraft() {
    const messageId = selectedMessageId.value;
    const item = currentItem.value;

    if (!messageId || !item) {
      return;
    }

    const targetMessage = item.messages.find(messageRecord => messageRecord.id === messageId) ?? null;

    if (!canRegenerateAiDraft(item, targetMessage)) {
      return;
    }

    const enrollmentId = item.enrollment.id;
    const requestId = latestDraftRegenerateRequestId + 1;
    latestDraftRegenerateRequestId = requestId;
    draftRegenerating.value = true;

    try {
      const { data, error } = await regenerateCrmMessageAiDraft(messageId);

      if (error || requestId !== latestDraftRegenerateRequestId) {
        return;
      }

      if (selectedEnrollmentId.value !== enrollmentId || selectedMessageId.value !== messageId || !currentItem.value) {
        return;
      }

      message.success('开发信已重新生成');
      notifyCrmWorkbenchChanged();
      currentItem.value = replaceReviewMessage(currentItem.value, data.message);
      await loadDraftVersions(messageId);
      await options.loadSequences();
    } finally {
      if (requestId === latestDraftRegenerateRequestId) {
        draftRegenerating.value = false;
      }
    }
  }

  async function handleGenerateNextDraft() {
    const enrollmentId = selectedEnrollmentId.value;
    const messageId = selectedMessageId.value;

    if (!enrollmentId || !messageId || !currentItem.value || !canGenerateNextSequenceDraft(currentItem.value)) {
      return;
    }

    const requestId = latestNextDraftGenerateRequestId + 1;
    latestNextDraftGenerateRequestId = requestId;
    nextDraftGenerating.value = true;

    try {
      const { data, error } = await generateCrmNextSequenceDraft(enrollmentId);

      if (error || requestId !== latestNextDraftGenerateRequestId) {
        return;
      }

      if (selectedEnrollmentId.value !== enrollmentId || selectedMessageId.value !== messageId || !currentItem.value) {
        return;
      }

      message.success(`第 ${data.message.stepIndex} 封开发信已生成`);
      notifyCrmWorkbenchChanged();
      currentItem.value = replaceReviewMessage(
        {
          ...currentItem.value,
          enrollment: data.enrollment
        },
        data.message
      );
      selectedMessageId.value = data.message.id;
      await loadSequenceDetail(data.enrollment.id);
      await options.loadSequences();
    } finally {
      if (requestId === latestNextDraftGenerateRequestId) {
        nextDraftGenerating.value = false;
      }
    }
  }

  async function handleStartSend() {
    const enrollmentId = selectedEnrollmentId.value;
    const messageId = selectedMessageId.value;

    if (!enrollmentId || !messageId || !currentItem.value) {
      return;
    }

    sendStarting.value = true;

    try {
      const { data, error } = await startCrmFirstMessageSend(enrollmentId);

      if (error) {
        return;
      }

      if (selectedEnrollmentId.value !== enrollmentId || selectedMessageId.value !== messageId || !currentItem.value) {
        return;
      }

      message.success('首封开发信已安排发送');
      notifyCrmWorkbenchChanged();
      currentItem.value = replaceReviewMessage(
        {
          ...currentItem.value,
          account: data.account,
          enrollment: data.enrollment
        },
        data.message
      );
      await loadSequenceDetail(data.enrollment.id);
      await options.loadSequences();
    } finally {
      sendStarting.value = false;
    }
  }

  async function handleReturnFirstMessageToEdit() {
    const enrollmentId = selectedEnrollmentId.value;
    const messageId = selectedMessageId.value;
    const item = currentItem.value;

    if (!enrollmentId || !messageId || !item) {
      return;
    }

    const targetMessage = item.messages.find(messageRecord => messageRecord.id === messageId) ?? null;

    if (!canReturnFirstMessageToEdit(item, targetMessage)) {
      return;
    }

    const requestId = latestReturnEditRequestId + 1;
    latestReturnEditRequestId = requestId;
    returnEditing.value = true;

    try {
      const { data, error } = await returnCrmFirstMessageToEdit(enrollmentId);

      if (error || requestId !== latestReturnEditRequestId) {
        return;
      }

      if (selectedEnrollmentId.value !== enrollmentId || !currentItem.value) {
        return;
      }

      message.success('开发信已退回，可修改后再发送');
      notifyCrmWorkbenchChanged();
      selectedMessageId.value = data.message.id;
      currentItem.value = replaceReviewMessage(
        {
          ...currentItem.value,
          account: data.account,
          enrollment: data.enrollment
        },
        data.message
      );
      await loadSequenceDetail(data.enrollment.id);
      await options.loadSequences();
    } finally {
      if (requestId === latestReturnEditRequestId) {
        returnEditing.value = false;
      }
    }
  }

  async function handleResumeSequence() {
    const enrollmentId = selectedEnrollmentId.value;
    const item = currentItem.value;

    if (!enrollmentId || !item || !canResumeSequence(item)) {
      return;
    }

    const requestId = latestResumeRequestId + 1;
    latestResumeRequestId = requestId;
    sequenceResuming.value = true;

    try {
      const { data, error } = await resumeCrmSequenceEnrollment(enrollmentId);

      if (error || requestId !== latestResumeRequestId) {
        return;
      }

      if (selectedEnrollmentId.value !== enrollmentId || !currentItem.value) {
        return;
      }

      message.success('开发信任务已恢复');
      notifyCrmWorkbenchChanged();
      currentItem.value = data.message
        ? replaceReviewMessage(
            {
              ...currentItem.value,
              account: data.account,
              enrollment: data.enrollment
            },
            data.message
          )
        : {
            ...currentItem.value,
            account: data.account,
            enrollment: data.enrollment
          };
      if (data.message) {
        selectedMessageId.value = data.message.id;
      }
      await loadSequenceDetail(data.enrollment.id);
      await options.loadSequences();
    } finally {
      if (requestId === latestResumeRequestId) {
        sequenceResuming.value = false;
      }
    }
  }

  async function handleRetryFirstMessageSend() {
    const enrollmentId = selectedEnrollmentId.value;
    const messageId = selectedMessageId.value;
    const item = currentItem.value;

    if (!enrollmentId || !messageId || !item) {
      return;
    }

    const targetMessage = item.messages.find(messageRecord => messageRecord.id === messageId) ?? null;

    if (!canRetryFirstMessageSend(item, targetMessage)) {
      return;
    }

    const requestId = latestRetrySendRequestId + 1;
    latestRetrySendRequestId = requestId;
    sendRetrying.value = true;

    try {
      const { data, error } = await retryCrmFirstMessageSend(enrollmentId);

      if (error || requestId !== latestRetrySendRequestId) {
        return;
      }

      if (selectedEnrollmentId.value !== enrollmentId || !currentItem.value) {
        return;
      }

      message.success('开发信已重新等待发送');
      notifyCrmWorkbenchChanged();
      selectedMessageId.value = data.message.id;
      currentItem.value = replaceReviewMessage(
        {
          ...currentItem.value,
          account: data.account,
          enrollment: data.enrollment
        },
        data.message
      );
      await loadSequenceDetail(data.enrollment.id);
      await options.loadSequences();
    } finally {
      if (requestId === latestRetrySendRequestId) {
        sendRetrying.value = false;
      }
    }
  }

  async function handleRefreshCurrentSequence() {
    const enrollmentId = selectedEnrollmentId.value;

    if (!enrollmentId) {
      return;
    }

    detailRefreshing.value = true;

    try {
      await loadSequenceDetail(enrollmentId);
      await options.loadSequences();
    } finally {
      detailRefreshing.value = false;
    }
  }

  async function handleStopSequence() {
    const enrollmentId = selectedEnrollmentId.value;

    if (!enrollmentId || !currentItem.value) {
      return;
    }

    sequenceStopping.value = true;

    try {
      const { data, error } = await stopCrmSequenceEnrollment(enrollmentId);

      if (error) {
        return;
      }

      if (selectedEnrollmentId.value !== enrollmentId || !currentItem.value) {
        return;
      }

      message.success('开发任务已停止');
      notifyCrmWorkbenchChanged();
      currentItem.value = data.message
        ? replaceReviewMessage(
            {
              ...currentItem.value,
              account: data.account,
              enrollment: data.enrollment
            },
            data.message
          )
        : {
            ...currentItem.value,
            account: data.account,
            enrollment: data.enrollment
          };
      await loadSequenceDetail(data.enrollment.id);
      await options.loadSequences();
    } finally {
      sequenceStopping.value = false;
    }
  }

  function handleDrawerVisibleUpdate(show: boolean) {
    drawerVisible.value = show;

    if (!show) {
      latestDetailRequestId += 1;
      latestDraftApproveRequestId += 1;
      latestDraftSaveRequestId += 1;
      latestDraftVersionRequestId += 1;
      latestDraftVersionRestoreRequestId += 1;
      latestNextDraftGenerateRequestId += 1;
      latestDraftRegenerateRequestId += 1;
      latestReturnEditRequestId += 1;
      latestResumeRequestId += 1;
      latestRetrySendRequestId += 1;
      selectedEnrollmentId.value = null;
      selectedMessageId.value = null;
      currentItem.value = null;
      draftVersions.value = [];
    }
  }

  return {
    currentItem,
    detailRefreshing,
    draftApproving,
    draftRegenerating,
    draftSaving,
    draftVersionLoading,
    draftVersionRestoring,
    draftVersions,
    drawerLoading,
    drawerVisible,
    handleApproveDraft,
    handleDrawerVisibleUpdate,
    handleGenerateNextDraft,
    handleRegenerateAiDraft,
    handleResumeSequence,
    handleRetryFirstMessageSend,
    handleRefreshCurrentSequence,
    handleReturnFirstMessageToEdit,
    handleRestoreDraftVersion,
    handleSaveDraft,
    handleStartSend,
    handleStopSequence,
    loadDraftVersions,
    nextDraftGenerating,
    returnEditing,
    sequenceResuming,
    openCreatedReviewItem,
    openDraftDrawer,
    openFocusedSequence,
    sendStarting,
    sendRetrying,
    sequenceStopping
  };
}

/** Replace one message inside a review item while keeping firstMessage compatible with old callers. */
function replaceReviewMessage(
  item: Api.Crm.SequenceReviewItem,
  message: Api.Crm.MessageRecord
): Api.Crm.SequenceReviewItem {
  const hasMessage = item.messages.some(current => current.id === message.id);
  const messages = (
    hasMessage
      ? item.messages.map(current => (current.id === message.id ? message : current))
      : [...item.messages, message]
  ).sort((left, right) => left.stepIndex - right.stepIndex || left.createdAt.localeCompare(right.createdAt));

  return {
    ...item,
    firstMessage: message.stepIndex === 1 ? message : item.firstMessage,
    messages
  };
}
