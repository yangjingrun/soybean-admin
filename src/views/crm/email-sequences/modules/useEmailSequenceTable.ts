import { computed, onMounted, reactive, shallowRef } from 'vue';
import { useMessage } from 'naive-ui';
import {
  approveCrmMessageDraft,
  createCrmSequenceReviewItem,
  fetchCrmAccountDetail,
  fetchCrmAccounts,
  fetchCrmMailboxes,
  fetchCrmProductLines,
  fetchCrmSequenceReviewItem,
  fetchCrmSequenceReviewItems,
  startCrmFirstMessageSend,
  stopCrmSequenceEnrollment,
  updateCrmMessageDraft
} from '@/service/api';
import {
  buildSequenceReviewSearchParams,
  createDefaultSequenceCreateForm,
  createDefaultSequenceFilterModel,
  normalizeSequenceCreatePayload
} from './shared';

/** Manage first-email review list, creation resources and draft drawer operations. */
export function useEmailSequenceTable() {
  const message = useMessage();
  const records = shallowRef<Api.Crm.SequenceReviewItem[]>([]);
  const accountOptions = shallowRef<Api.Crm.LeadRecord[]>([]);
  const contactOptions = shallowRef<Api.Crm.LeadContact[]>([]);
  const mailboxOptions = shallowRef<Api.Crm.MailboxRecord[]>([]);
  const productLineOptions = shallowRef<Api.Crm.ProductLineRecord[]>([]);
  const currentItem = shallowRef<Api.Crm.SequenceReviewItem | null>(null);
  const loading = shallowRef(false);
  const resourceLoading = shallowRef(false);
  const createVisible = shallowRef(false);
  const createSubmitting = shallowRef(false);
  const drawerVisible = shallowRef(false);
  const drawerLoading = shallowRef(false);
  const draftSaving = shallowRef(false);
  const draftApproving = shallowRef(false);
  const detailRefreshing = shallowRef(false);
  const sendStarting = shallowRef(false);
  const sequenceStopping = shallowRef(false);
  const selectedEnrollmentId = shallowRef<string | null>(null);
  const selectedMessageId = shallowRef<string | null>(null);
  let latestListRequestId = 0;
  let latestDetailRequestId = 0;
  let latestResourceRequestId = 0;

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

  onMounted(() => {
    void Promise.all([loadSequences(), loadCreateResources()]);
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
    resourceLoading.value = true;

    try {
      const [accounts, mailboxes, productLines] = await Promise.all([
        fetchCrmAccounts({ current: 1, size: 100 }),
        fetchCrmMailboxes({ current: 1, size: 100, status: 'active' }),
        fetchCrmProductLines({ current: 1, size: 100, status: 'active' })
      ]);

      if (requestId !== latestResourceRequestId) {
        return;
      }

      if (!accounts.error) accountOptions.value = accounts.data.records;
      if (!mailboxes.error) mailboxOptions.value = mailboxes.data.records;
      if (!productLines.error) productLineOptions.value = productLines.data.records;
    } finally {
      if (requestId === latestResourceRequestId) {
        resourceLoading.value = false;
      }
    }
  }

  /** Load contacts for the selected account and reset stale contact selection. */
  async function handleAccountChange(accountId: string | null) {
    createForm.accountId = accountId;
    createForm.contactId = null;
    contactOptions.value = [];

    if (!accountId) {
      return;
    }

    const requestId = latestResourceRequestId + 1;
    latestResourceRequestId = requestId;
    resourceLoading.value = true;

    try {
      const { data, error } = await fetchCrmAccountDetail(accountId);

      if (error || requestId !== latestResourceRequestId) {
        return;
      }

      contactOptions.value = data.contacts;
    } finally {
      if (requestId === latestResourceRequestId) {
        resourceLoading.value = false;
      }
    }
  }

  function openCreateModal() {
    Object.assign(createForm, createDefaultSequenceCreateForm());
    contactOptions.value = [];
    createVisible.value = true;
    void loadCreateResources();
  }

  function handleCreateVisibleUpdate(show: boolean) {
    createVisible.value = show;

    if (!show) {
      Object.assign(createForm, createDefaultSequenceCreateForm());
      contactOptions.value = [];
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
    selectedEnrollmentId.value = row.enrollment.id;
    selectedMessageId.value = row.firstMessage?.id ?? null;
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
      selectedMessageId.value = data.firstMessage?.id ?? null;
    } finally {
      if (requestId === latestDetailRequestId) {
        drawerLoading.value = false;
      }
    }
  }

  async function handleSaveDraft(payload: Api.Crm.MessageDraftPayload) {
    const messageId = selectedMessageId.value;

    if (!messageId || !currentItem.value) {
      return;
    }

    const enrollmentId = currentItem.value.enrollment.id;
    draftSaving.value = true;

    try {
      const { data, error } = await updateCrmMessageDraft(messageId, payload);

      if (error) {
        return;
      }

      if (selectedEnrollmentId.value !== enrollmentId || selectedMessageId.value !== messageId || !currentItem.value) {
        return;
      }

      message.success('草稿已保存');
      currentItem.value = {
        ...currentItem.value,
        firstMessage: data.message
      };
      await loadSequences();
    } finally {
      draftSaving.value = false;
    }
  }

  async function handleApproveDraft() {
    const messageId = selectedMessageId.value;

    if (!messageId || !currentItem.value) {
      return;
    }

    const enrollmentId = currentItem.value.enrollment.id;
    draftApproving.value = true;

    try {
      const { data, error } = await approveCrmMessageDraft(messageId);

      if (error) {
        return;
      }

      if (selectedEnrollmentId.value !== enrollmentId || selectedMessageId.value !== messageId || !currentItem.value) {
        return;
      }

      message.success('草稿已确认，等待后续发送队列接入');
      currentItem.value = {
        ...currentItem.value,
        enrollment: data.enrollment,
        firstMessage: data.message
      };
      await loadSequenceDetail(data.enrollment.id);
      await loadSequences();
    } finally {
      draftApproving.value = false;
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
      currentItem.value = {
        ...currentItem.value,
        account: data.account,
        enrollment: data.enrollment,
        firstMessage: data.message
      };
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
      currentItem.value = {
        ...currentItem.value,
        account: data.account,
        enrollment: data.enrollment,
        firstMessage: data.message ?? currentItem.value.firstMessage
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
    openCreateModal,
    openDraftDrawer,
    pagination,
    productLineSelectOptions,
    records,
    resourceLoading,
    sendStarting,
    sequenceStopping
  };
}
