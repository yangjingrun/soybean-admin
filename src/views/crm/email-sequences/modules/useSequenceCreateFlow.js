import { computed, reactive, shallowRef } from 'vue';
import { useMessage } from 'naive-ui';
import { notifyCrmWorkbenchChanged } from '@/hooks/business/crm-workbench-refresh';
import {
  createCrmFirstOutreachAiDraftTask,
  fetchCrmAccountDetail,
  fetchCrmAccounts,
  fetchCrmMailboxes,
  fetchCrmProductLines,
  fetchCrmSequencePolicies
} from '@/service/api';
import { isMailboxAvailableForSequence } from '../../settings/modules/shared';
import { createDefaultSequenceCreateForm } from './shared';
/** Manage the create-first-draft modal resources and account/contact prefill flow. */
export function useSequenceCreateFlow(options) {
  const message = useMessage();
  const accountOptions = shallowRef([]);
  const contactOptions = shallowRef([]);
  const mailboxOptions = shallowRef([]);
  const productLineOptions = shallowRef([]);
  const sequencePolicyOptions = shallowRef([]);
  const createResourceLoading = shallowRef(false);
  const contactLoading = shallowRef(false);
  const createVisible = shallowRef(false);
  const createSubmitting = shallowRef(false);
  const createForm = reactive(createDefaultSequenceCreateForm());
  let latestResourceRequestId = 0;
  let latestContactRequestId = 0;
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
    mailboxOptions.value
      .filter(mailbox => isMailboxAvailableForSequence(mailbox))
      .map(mailbox => ({
        label: mailbox.maskedEmail,
        value: mailbox.id
      }))
  );
  const productLineSelectOptions = computed(() =>
    productLineOptions.value.map(productLine => ({
      label: productLine.name,
      value: productLine.id,
      aiWritingConfig: productLine.aiWritingConfig
    }))
  );
  const sequencePolicySelectOptions = computed(() =>
    sequencePolicyOptions.value.map(policy => ({
      label: `${policy.name}${policy.isDefault ? ' · 默认' : ''}`,
      value: policy.id
    }))
  );
  const resourceLoading = computed(() => createResourceLoading.value || contactLoading.value);
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
  async function handleAccountChange(accountId) {
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
  async function openCreateModalWithSelection(accountId, contactId) {
    Object.assign(createForm, {
      ...createDefaultSequenceCreateForm(),
      accountId,
      contactId
    });
    contactOptions.value = [];
    createVisible.value = true;
    await Promise.all([loadCreateResources(), loadAccountContacts(accountId, contactId)]);
  }
  function handleCreateVisibleUpdate(show) {
    createVisible.value = show;
    if (!show) {
      Object.assign(createForm, createDefaultSequenceCreateForm());
      contactOptions.value = [];
    }
  }
  /** Load contacts for one account and optionally keep a known contact selected from route prefill. */
  async function loadAccountContacts(accountId, preferredContactId) {
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
      message.warning('请选择客户和联系人');
      return;
    }
    if (!createForm.mailboxId) {
      message.warning('请选择发送邮箱');
      return;
    }
    createSubmitting.value = true;
    try {
      const { error } = await createCrmFirstOutreachAiDraftTask({
        targets: [
          {
            accountId: createForm.accountId,
            contactId: createForm.contactId
          }
        ],
        ...(createForm.productLineId ? { productLineId: createForm.productLineId } : {}),
        mailboxId: createForm.mailboxId,
        ...(createForm.policyId ? { policyId: createForm.policyId } : {})
      });
      if (error) {
        return;
      }
      message.success('已提交后台生成，完成后会进入发送计划');
      notifyCrmWorkbenchChanged();
      createVisible.value = false;
      await options.onSubmitted();
    } finally {
      createSubmitting.value = false;
    }
  }
  return {
    accountSelectOptions,
    contactSelectOptions,
    createForm,
    createSubmitting,
    createVisible,
    handleAccountChange,
    handleCreateReviewItem,
    handleCreateVisibleUpdate,
    loadCreateResources,
    mailboxSelectOptions,
    openCreateModal,
    openCreateModalWithSelection,
    productLineSelectOptions,
    resourceLoading,
    sequencePolicySelectOptions
  };
}
