import { computed, onMounted, reactive, shallowRef } from 'vue';
import { useRoute } from 'vue-router';
import { useMessage } from 'naive-ui';
import {
  approveCrmMessageDraft,
  createCrmSequenceReviewItem,
  fetchCrmAccountDetail,
  fetchCrmAccounts,
  fetchCrmMailboxes,
  fetchCrmProductLines,
  fetchCrmSequencePolicies,
  fetchCrmSequenceReviewItem,
  fetchCrmSequenceReviewItems,
  generateCrmNextSequenceDraft,
  startCrmFirstMessageSend,
  stopCrmSequenceEnrollment,
  updateCrmMessageDraft
} from '@/service/api';
import {
  buildSequenceReviewSearchParams,
  canGenerateNextSequenceDraft,
  createDefaultSequenceCreateForm,
  createDefaultSequenceFilterModel,
  getPendingReviewMessage,
  normalizeSequenceCreatePayload,
  type DraftReviewApprovePayload,
  type DraftReviewSavePayload
} from './shared';

/** Manage sequence review list, creation resources and draft drawer operations. */
export function useEmailSequenceTable() {
  const message = useMessage();
  const route = useRoute();
  const records = shallowRef<Api.Crm.SequenceReviewItem[]>([]);
  const accountOptions = shallowRef<Api.Crm.LeadRecord[]>([]);
  const contactOptions = shallowRef<Api.Crm.LeadContact[]>([]);
  const mailboxOptions = shallowRef<Api.Crm.MailboxRecord[]>([]);
  const productLineOptions = shallowRef<Api.Crm.ProductLineRecord[]>([]);
  const sequencePolicyOptions = shallowRef<Api.Crm.SequencePolicyRecord[]>([]);
  const currentItem = shallowRef<Api.Crm.SequenceReviewItem | null>(null);
  const loading = shallowRef(false);
  const createResourceLoading = shallowRef(false);
  const contactLoading = shallowRef(false);
  const createVisible = shallowRef(false);
  const createSubmitting = shallowRef(false);
  const drawerVisible = shallowRef(false);
  const drawerLoading = shallowRef(false);
  const draftSaving = shallowRef(false);
  const draftApproving = shallowRef(false);
  const detailRefreshing = shallowRef(false);
  const nextDraftGenerating = shallowRef(false);
  const sendStarting = shallowRef(false);
  const sequenceStopping = shallowRef(false);
  const selectedEnrollmentId = shallowRef<string | null>(null);
  const selectedMessageId = shallowRef<string | null>(null);
  let latestListRequestId = 0;
  let latestDetailRequestId = 0;
  let latestDraftApproveRequestId = 0;
  let latestDraftSaveRequestId = 0;
  let latestNextDraftGenerateRequestId = 0;
  let latestResourceRequestId = 0;
  let latestContactRequestId = 0;

  const pagination = reactive({
    current: 1,
    size: 10,
    total: 0
  });
  const filterModel = reactive<Api.Crm.SequenceReviewFilterModel>(createDefaultSequenceFilterModel());
  const createForm = reactive<Api.Crm.SequenceReviewCreateFormModel>(createDefaultSequenceCreateForm());

  const accountSelectOptions = computed(() =>
    accountOptions.value.map(account => ({
      label: `${account.name}${account.domain ? ` · ${account.domain}` : ''}`,
      value: account.id
    }))
  );
  const contactSelectOptions = computed(() =>
    contactOptions.value.map(contact => ({
      label: `${contact.fullName || contact.title || contact.maskedEmail} · ${contact.maskedEmail}`,
      value: contact.id
    }))
  );
  const mailboxSelectOptions = computed(() =>
    mailboxOptions.value.map(mailbox => ({
      label: mailbox.maskedEmail,
      value: mailbox.id
    }))
  );
  const productLineSelectOptions = computed(() =>
    productLineOptions.value.map(productLine => ({
      label: productLine.name,
      value: productLine.id
    }))
  );
  const sequencePolicySelectOptions = computed(() =>
    sequencePolicyOptions.value.map(policy => ({
      label: `${policy.name}${policy.isDefault ? ' · 默认' : ''}`,
      value: policy.id
    }))
  );
  const resourceLoading = computed(() => createResourceLoading.value || contactLoading.value);

  onMounted(() => {
    void loadSequences();

    const accountId = getRouteQueryString(route.query.accountId);
    const contactId = getRouteQueryString(route.query.contactId);

    if (accountId && contactId) {
      void openCreateModalWithSelection(accountId, contactId);
      return;
    }

    void loadCreateResources();
  });

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
    } finally {
      if (requestId === latestListRequestId) {
        loading.value = false;
      }
    }
  }

  async function loadCreateResources() {
    const requestId = latestResourceRequestId + 1;
    latestResourceRequestId = requestId;
    createResourceLoading.value = true;

    try {
      const [accounts, mailboxes, productLines, sequencePolicies] = await Promise.all([
        fetchCrmAccounts({ current: 1, size: 100 }),
        fetchCrmMailboxes({ current: 1, size: 100, status: 'active' }),
        fetchCrmProductLines({ current: 1, size: 100, status: 'active' }),
        fetchCrmSequencePolicies({ current: 1, size: 100, status: 'active' })
      ]);

      if (requestId !== latestResourceRequestId) {
        return;
      }

      if (!accounts.error) accountOptions.value = accounts.data.records;
      if (!mailboxes.error) mailboxOptions.value = mailboxes.data.records;
      if (!productLines.error) productLineOptions.value = productLines.data.records;
      if (!sequencePolicies.error) sequencePolicyOptions.value = sequencePolicies.data.records;
    } finally {
      if (requestId === latestResourceRequestId) {
        createResourceLoading.value = false;
      }
    }
  }

  /** Load contacts for the selected account and reset stale contact selection. */
  async function handleAccountChange(accountId: string | null) {
    createForm.accountId = accountId;
    createForm.contactId = null;

    await loadAccountContacts(accountId);
  }

  function openCreateModal() {
    Object.assign(createForm, createDefaultSequenceCreateForm());
    contactOptions.value = [];
    createVisible.value = true;
    void loadCreateResources();
  }

  async function openCreateModalWithSelection(accountId: string, contactId: string) {
    Object.assign(createForm, {
      ...createDefaultSequenceCreateForm(),
      accountId,
      contactId
    });
    contactOptions.value = [];
    createVisible.value = true;
    await Promise.all([loadCreateResources(), loadAccountContacts(accountId, contactId)]);
  }

  function handleCreateVisibleUpdate(show: boolean) {
    createVisible.value = show;

    if (!show) {
      Object.assign(createForm, createDefaultSequenceCreateForm());
      contactOptions.value = [];
    }
  }

  /** Load contacts for one account and optionally keep a known contact selected from route prefill. */
  async function loadAccountContacts(accountId: string | null, preferredContactId?: string) {
    contactOptions.value = [];

    if (!accountId) {
      return;
    }

    const requestId = latestContactRequestId + 1;
    latestContactRequestId = requestId;
    contactLoading.value = true;

    try {
      const { data, error } = await fetchCrmAccountDetail(accountId);

      if (error || requestId !== latestContactRequestId) {
        return;
      }

      contactOptions.value = data.contacts;
      const matchedPreferredContactId =
        preferredContactId && data.contacts.some(contact => contact.id === preferredContactId)
          ? preferredContactId
          : null;
      createForm.contactId = matchedPreferredContactId
        ? matchedPreferredContactId
        : data.contacts.some(contact => contact.id === createForm.contactId)
          ? createForm.contactId
          : null;
    } finally {
      if (requestId === latestContactRequestId) {
        contactLoading.value = false;
      }
    }
  }

  async function handleCreateReviewItem() {
    if (!createForm.accountId || !createForm.contactId) {
      message.warning('请选择线索和联系人');
      return;
    }

    createSubmitting.value = true;

    try {
      const { data, error } = await createCrmSequenceReviewItem(normalizeSequenceCreatePayload(createForm));

      if (error) {
        return;
      }

      message.success('首封草稿已生成');
      createVisible.value = false;
      currentItem.value = data.item;
      selectedEnrollmentId.value = data.item.enrollment.id;
      selectedMessageId.value = data.item.firstMessage?.id ?? null;
      drawerVisible.value = true;
      pagination.current = 1;
      await loadSequences();
    } finally {
      createSubmitting.value = false;
    }
  }

  async function openDraftDrawer(row: Api.Crm.SequenceReviewItem) {
    latestDraftApproveRequestId += 1;
    latestDraftSaveRequestId += 1;
    selectedEnrollmentId.value = row.enrollment.id;
    selectedMessageId.value = getPendingReviewMessage(row.messages)?.id ?? row.firstMessage?.id ?? null;
    currentItem.value = null;
    drawerVisible.value = true;
    await loadSequenceDetail(row.enrollment.id);
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
      await loadSequences();
    } finally {
      if (requestId === latestDraftSaveRequestId) {
        draftSaving.value = false;
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
      currentItem.value = replaceReviewMessage(
        {
          ...currentItem.value,
          enrollment: data.enrollment
        },
        data.message
      );
      await loadSequenceDetail(data.enrollment.id);
      await loadSequences();
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
      currentItem.value = replaceReviewMessage(
        {
          ...currentItem.value,
          enrollment: data.enrollment
        },
        data.message
      );
      selectedMessageId.value = data.message.id;
      await loadSequenceDetail(data.enrollment.id);
      await loadSequences();
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
      currentItem.value = replaceReviewMessage(
        {
          ...currentItem.value,
          account: data.account,
          enrollment: data.enrollment
        },
        data.message
      );
      await loadSequenceDetail(data.enrollment.id);
      await loadSequences();
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
      await loadSequences();
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
      await loadSequences();
    } finally {
      sequenceStopping.value = false;
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

  function handleDrawerVisibleUpdate(show: boolean) {
    drawerVisible.value = show;

    if (!show) {
      latestDetailRequestId += 1;
      latestDraftApproveRequestId += 1;
      latestDraftSaveRequestId += 1;
      latestNextDraftGenerateRequestId += 1;
      selectedEnrollmentId.value = null;
      selectedMessageId.value = null;
      currentItem.value = null;
    }
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

  return {
    accountSelectOptions,
    contactSelectOptions,
    createForm,
    createSubmitting,
    createVisible,
    currentItem,
    detailRefreshing,
    draftApproving,
    draftSaving,
    drawerLoading,
    drawerVisible,
    filterModel,
    handleAccountChange,
    handleApproveDraft,
    handleCreateReviewItem,
    handleCreateVisibleUpdate,
    handleDrawerVisibleUpdate,
    handleGenerateNextDraft,
    handlePageSizeUpdate,
    handlePageUpdate,
    handleReset,
    handleRefreshCurrentSequence,
    handleSaveDraft,
    handleSearch,
    handleStartSend,
    handleStopSequence,
    loadCreateResources,
    loadSequences,
    loading,
    mailboxSelectOptions,
    nextDraftGenerating,
    openCreateModal,
    openDraftDrawer,
    pagination,
    productLineSelectOptions,
    records,
    resourceLoading,
    sendStarting,
    sequencePolicySelectOptions,
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

function getRouteQueryString(value: unknown) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return '';
}
