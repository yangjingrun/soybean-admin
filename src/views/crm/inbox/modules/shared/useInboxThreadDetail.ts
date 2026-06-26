import { computed, onMounted, shallowRef, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useMessage } from 'naive-ui';
import { notifyCrmWorkbenchChanged } from '@/hooks/business/crm-workbench-refresh';
import {
  confirmCrmInboxMessageUnsubscribe,
  fetchCrmInboxThreadDetail,
  polishCrmInboxReplyDraft,
  replyCrmInboxThread,
  saveCrmInboxReplyDraft,
  updateCrmInboxThreadStatus
} from '@/service/api';
import type { InboxReplyPolishSnapshot } from '../shared';
import {
  buildInboxReplySubmitPayload,
  canRestoreInboxReplyPolishSnapshot,
  createInboxReplyPolishSnapshot
} from '../shared';

/** Manage one CRM inbox thread detail page and its reply actions. */
export function useInboxThreadDetail() {
  const route = useRoute();
  const router = useRouter();
  const message = useMessage();
  const currentDetail = shallowRef<Api.Crm.InboxThreadDetail | null>(null);
  const detailLoading = shallowRef(false);
  const replyTopic = shallowRef('');
  const replyBody = shallowRef('');
  const replyPolishUndoSnapshot = shallowRef<InboxReplyPolishSnapshot | null>(null);
  const draftPolishing = shallowRef(false);
  const draftSaving = shallowRef(false);
  const replySending = shallowRef(false);
  const unsubscribeConfirming = shallowRef(false);
  const selectedThreadId = shallowRef<string | null>(getRouteParamString(route.params.id));
  let latestDetailRequestId = 0;

  const canRestorePolishSnapshot = computed(() =>
    canRestoreInboxReplyPolishSnapshot(replyPolishUndoSnapshot.value, selectedThreadId.value)
  );

  onMounted(() => {
    void loadRouteThreadDetail();
  });

  watch(
    () => route.params.id,
    () => {
      void loadRouteThreadDetail();
    }
  );

  async function loadRouteThreadDetail() {
    const threadId = getRouteParamString(route.params.id);

    selectedThreadId.value = threadId || null;
    currentDetail.value = null;
    replyTopic.value = '';
    replyBody.value = '';
    replyPolishUndoSnapshot.value = null;

    if (!threadId) {
      return;
    }

    await loadThreadDetail(threadId, { markHandledOnOpen: true });
  }

  /** Load the current thread detail and ignore stale route switches. */
  async function loadThreadDetail(id = selectedThreadId.value, options: { markHandledOnOpen?: boolean } = {}) {
    if (!id) {
      return;
    }

    const requestId = latestDetailRequestId + 1;
    latestDetailRequestId = requestId;
    detailLoading.value = true;

    try {
      const { data, error } = await fetchCrmInboxThreadDetail(id);

      if (error || requestId !== latestDetailRequestId || selectedThreadId.value !== id) {
        return;
      }

      currentDetail.value = data;
      syncReplyDraftFromDetail(data);
      replyPolishUndoSnapshot.value = null;

      if (options.markHandledOnOpen) {
        await markPendingThreadHandledOnOpen(data);
      }
    } finally {
      if (requestId === latestDetailRequestId) {
        detailLoading.value = false;
      }
    }
  }

  /** Opening a pending detail page means the owner has handled this reply. */
  async function markPendingThreadHandledOnOpen(detail: Api.Crm.InboxThreadDetail) {
    if (detail.thread.status !== 'pending') {
      return;
    }

    const threadId = detail.thread.id;
    const { data, error } = await updateCrmInboxThreadStatus(threadId, {
      status: 'handled'
    });

    if (error || selectedThreadId.value !== threadId || !currentDetail.value) {
      return;
    }

    notifyCrmWorkbenchChanged();
    currentDetail.value = {
      ...currentDetail.value,
      account: data.account,
      thread: data.thread
    };
  }

  /** Sync editable draft inputs from the owner-visible backend reply draft. */
  function syncReplyDraftFromDetail(detail: Api.Crm.InboxThreadDetail) {
    replyTopic.value = detail.replyDraft?.topic ?? '';
    replyBody.value = detail.replyDraft?.bodyText ?? '';
  }

  /** Ask AI to polish the user's reply topic into a local draft without sending Gmail. */
  async function handlePolishReplyDraft() {
    const threadId = selectedThreadId.value;
    const topic = replyTopic.value.trim();

    if (!threadId || draftPolishing.value) {
      return;
    }

    if (!currentDetail.value?.canOperate) {
      message.warning('当前账号不可润色该回复草稿');
      return;
    }

    if (!topic) {
      message.warning('请先填写回复主题或要点');
      return;
    }

    const undoSnapshot = createInboxReplyPolishSnapshot({
      threadId,
      topic: replyTopic.value,
      bodyText: replyBody.value
    });

    draftPolishing.value = true;
    try {
      const { data, error } = await polishCrmInboxReplyDraft(threadId, {
        topic
      });

      if (error || selectedThreadId.value !== threadId) {
        return;
      }

      message.success('AI 润色回复草稿已生成');
      currentDetail.value = data;
      syncReplyDraftFromDetail(data);
      replyPolishUndoSnapshot.value = undoSnapshot;
    } finally {
      draftPolishing.value = false;
    }
  }

  /** Restore the local draft fields to the state before the latest AI polish. */
  function handleRestorePolishSnapshot() {
    const snapshot = replyPolishUndoSnapshot.value;

    if (!snapshot || !canRestoreInboxReplyPolishSnapshot(snapshot, selectedThreadId.value)) {
      return;
    }

    replyTopic.value = snapshot.topic;
    replyBody.value = snapshot.bodyText;
    replyPolishUndoSnapshot.value = null;
    message.success('已撤回到润色前草稿');
  }

  /** Save the locally edited reply draft without triggering Gmail sending. */
  async function handleSaveReplyDraft() {
    const threadId = selectedThreadId.value;
    const topic = replyTopic.value.trim();
    const bodyText = replyBody.value.trim();

    if (!threadId || draftSaving.value) {
      return;
    }

    if (!currentDetail.value?.canOperate) {
      message.warning('当前账号不可保存该回复草稿');
      return;
    }

    if (!topic) {
      message.warning('请先填写回复主题或要点');
      return;
    }

    if (!bodyText) {
      message.warning('回复草稿正文不能为空');
      return;
    }

    draftSaving.value = true;
    try {
      const { data, error } = await saveCrmInboxReplyDraft(threadId, {
        topic,
        bodyText
      });

      if (error || selectedThreadId.value !== threadId) {
        return;
      }

      message.success('回复草稿已保存');
      currentDetail.value = data;
      syncReplyDraftFromDetail(data);
      replyPolishUndoSnapshot.value = null;
    } finally {
      draftSaving.value = false;
    }
  }

  /** Send the current reply body through the bound mailbox, then refresh the detail page. */
  async function handleSendReply() {
    const threadId = selectedThreadId.value;

    if (!threadId || replySending.value) {
      return;
    }

    const replyPayloadResult = buildInboxReplySubmitPayload({
      canOperate: Boolean(currentDetail.value?.canOperate),
      topic: replyTopic.value,
      bodyText: replyBody.value
    });

    if (!replyPayloadResult.ok) {
      message.warning(replyPayloadResult.message);
      return;
    }

    replySending.value = true;
    try {
      const { error } = await replyCrmInboxThread(threadId, replyPayloadResult.payload);

      if (error || selectedThreadId.value !== threadId) {
        return;
      }

      message.success('回复已发送');
      notifyCrmWorkbenchChanged();
      replyPolishUndoSnapshot.value = null;
      await loadThreadDetail(threadId);
    } finally {
      replySending.value = false;
    }
  }

  /** Confirm a weak unsubscribe signal before applying blacklist side effects. */
  async function handleConfirmUnsubscribe(messageId: string) {
    const threadId = selectedThreadId.value;

    if (!threadId || unsubscribeConfirming.value) {
      return;
    }

    if (!currentDetail.value?.canOperate) {
      message.warning('当前账号不可确认不再联系');
      return;
    }

    unsubscribeConfirming.value = true;
    try {
      const { data, error } = await confirmCrmInboxMessageUnsubscribe(messageId);

      if (error || selectedThreadId.value !== threadId) {
        return;
      }

      message.success('已加入不再联系名单');
      notifyCrmWorkbenchChanged();
      currentDetail.value = data;
      syncReplyDraftFromDetail(data);
    } finally {
      unsubscribeConfirming.value = false;
    }
  }

  async function handleBack() {
    await router.push('/crm/inbox');
  }

  return {
    canRestorePolishSnapshot,
    currentDetail,
    detailLoading,
    draftPolishing,
    draftSaving,
    handleBack,
    handleConfirmUnsubscribe,
    handlePolishReplyDraft,
    handleRestorePolishSnapshot,
    handleSaveReplyDraft,
    handleSendReply,
    loadThreadDetail,
    replyBody,
    replySending,
    replyTopic,
    unsubscribeConfirming
  };
}

function getRouteParamString(value: unknown) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return '';
}
