import { shallowRef } from 'vue';
import { useMessage } from 'naive-ui';
import { notifyCrmWorkbenchChanged } from '@/hooks/business/crm-workbench-refresh';
import {
  approveCrmMessageDraft,
  fetchCrmMessageDraftVersions,
  fetchCrmSequenceReviewItem,
  generateCrmNextSequenceDraft,
  restoreCrmMessageDraftVersion,
  startCrmFirstMessageSend,
  stopCrmSequenceEnrollment,
  updateCrmMessageDraft
} from '@/service/api';
import { canGenerateNextSequenceDraft, getPendingReviewMessage } from './shared';
/** Manage the draft review drawer and all selected-message async guards. */
export function useDraftReviewFlow(options) {
  const message = useMessage();
  const currentItem = shallowRef(null);
  const draftVersions = shallowRef([]);
  const drawerVisible = shallowRef(false);
  const drawerLoading = shallowRef(false);
  const draftSaving = shallowRef(false);
  const draftApproving = shallowRef(false);
  const draftVersionLoading = shallowRef(false);
  const draftVersionRestoring = shallowRef(false);
  const detailRefreshing = shallowRef(false);
  const nextDraftGenerating = shallowRef(false);
  const sendStarting = shallowRef(false);
  const sequenceStopping = shallowRef(false);
  const selectedEnrollmentId = shallowRef(null);
  const selectedMessageId = shallowRef(null);
  let latestDetailRequestId = 0;
  let latestDraftApproveRequestId = 0;
  let latestDraftSaveRequestId = 0;
  let latestDraftVersionRequestId = 0;
  let latestDraftVersionRestoreRequestId = 0;
  let latestNextDraftGenerateRequestId = 0;
  function openCreatedReviewItem(item) {
    currentItem.value = item;
    selectedEnrollmentId.value = item.enrollment.id;
    selectedMessageId.value = item.firstMessage?.id ?? null;
    drawerVisible.value = true;
    options.onCreatedReviewItem?.();
  }
  async function openDraftDrawer(row) {
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
  async function loadSequenceDetail(id) {
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
  async function handleSaveDraft(payload) {
    const { messageId } = payload;
    if (!messageId || !currentItem.value) {
      return;
    }
    const enrollmentId = currentItem.value.enrollment.id;
    const targetMessage = currentItem.value.messages.find(messageRecord => messageRecord.id === messageId);
    if (targetMessage?.status !== 'draft_pending_review') {
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
      message.success('草稿已保存');
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
  async function loadDraftVersions(messageId) {
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
  async function handleRestoreDraftVersion(payload) {
    const enrollmentId = selectedEnrollmentId.value;
    if (!enrollmentId || !currentItem.value) {
      return;
    }
    const targetMessage = currentItem.value.messages.find(messageRecord => messageRecord.id === payload.messageId);
    if (targetMessage?.status !== 'draft_pending_review') {
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
  async function handleApproveDraft(payload) {
    const { messageId } = payload;
    if (!messageId || !currentItem.value) {
      return;
    }
    const enrollmentId = currentItem.value.enrollment.id;
    const targetMessage = currentItem.value.messages.find(messageRecord => messageRecord.id === messageId);
    if (targetMessage?.status !== 'draft_pending_review') {
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
      message.success(data.message.status === 'queued' ? '后续草稿已确认并进入发送队列' : '草稿已确认，等待启动发送');
      notifyCrmWorkbenchChanged();
      currentItem.value = replaceReviewMessage(
        {
          ...currentItem.value,
          enrollment: data.enrollment
        },
        data.message
      );
      await loadSequenceDetail(data.enrollment.id);
      await options.loadSequences();
    } finally {
      if (requestId === latestDraftApproveRequestId) {
        draftApproving.value = false;
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
      message.success(`第 ${data.message.stepIndex} 封草稿已生成`);
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
      message.success('首封开发信已进入发送队列');
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
      message.success('开发信序列已停止');
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
  function handleDrawerVisibleUpdate(show) {
    drawerVisible.value = show;
    if (!show) {
      latestDetailRequestId += 1;
      latestDraftApproveRequestId += 1;
      latestDraftSaveRequestId += 1;
      latestDraftVersionRequestId += 1;
      latestDraftVersionRestoreRequestId += 1;
      latestNextDraftGenerateRequestId += 1;
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
    draftSaving,
    draftVersionLoading,
    draftVersionRestoring,
    draftVersions,
    drawerLoading,
    drawerVisible,
    handleApproveDraft,
    handleDrawerVisibleUpdate,
    handleGenerateNextDraft,
    handleRefreshCurrentSequence,
    handleRestoreDraftVersion,
    handleSaveDraft,
    handleStartSend,
    handleStopSequence,
    loadDraftVersions,
    nextDraftGenerating,
    openCreatedReviewItem,
    openDraftDrawer,
    sendStarting,
    sequenceStopping
  };
}
/** Replace one message inside a review item while keeping firstMessage compatible with old callers. */
function replaceReviewMessage(item, message) {
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
