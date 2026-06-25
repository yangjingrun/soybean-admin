<script setup lang="ts">
import { computed, h, reactive, shallowRef, watch } from 'vue';
import { NButton, NPopconfirm, NSpace, NTag, useMessage } from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import LeadInboxPanel from './LeadInboxPanel.vue';
import {
  buildLeadEmailProgressView,
  createDefaultLeadNoteForm,
  createDefaultLeadStatusForm,
  buildLeadAccountUpdatePayload,
  canCreateSequenceFromLeadAccountContact,
  formatArchivedFingerprintTypeLabel,
  formatLeadDate,
  formatLeadProgressTime,
  formatLeadText,
  formatLeadTimelineTitle,
  getArchivedFingerprintMatchEvents,
  getLeadTimelineItemType,
  getLeadNextAction,
  leadEnrichmentProviderLabelMap,
  leadEnrichmentStatusLabelMap,
  leadEnrichmentStatusTagTypeMap,
  leadEmailStatusLabelMap,
  leadEmailStatusTagTypeMap,
  leadStatusLabelMap,
  leadStatusOptions,
  leadStatusTagTypeMap,
  leadTimelineEventLabelMap,
  readArchivedFingerprintMatches,
  type LeadCommunicationTab
} from './shared';

const props = defineProps<{
  show: boolean;
  activeTab?: LeadCommunicationTab;
  activeContactId?: string | null;
  detail: Api.Crm.LeadDetail | null;
  loading?: boolean;
  accountSubmitting?: boolean;
  contactDeletingId?: string | null;
  contactSubmitting?: boolean;
  noteSubmitting?: boolean;
  statusSubmitting?: boolean;
  verifyingContactIds?: string[];
  refreshingEnrichmentProvider?: Api.Crm.LeadEnrichmentProvider | null;
}>();

const emit = defineEmits<{
  createSequence: [contact: Api.Crm.LeadContact];
  createContact: [payload: Api.Crm.LeadContactCreatePayload, done?: (success: boolean) => void];
  deleteContact: [contact: Api.Crm.LeadContact];
  refreshEnrichment: [provider: Api.Crm.LeadEnrichmentProvider];
  'update:show': [show: boolean];
  reload: [];
  submitAccount: [payload: Api.Crm.LeadAccountUpdatePayload, done?: (success: boolean) => void];
  submitNote: [payload: Api.Crm.LeadNotePayload];
  submitStatus: [payload: Api.Crm.LeadStatusPayload];
  'update:activeTab': [tab: LeadCommunicationTab];
  updateContact: [contactId: string, payload: Api.Crm.LeadContactUpdatePayload, done?: (success: boolean) => void];
  verifyContactEmail: [contact: Api.Crm.LeadContact];
}>();

const message = useMessage();

interface LeadAccountFormModel {
  name: string;
  normalizedName: string;
  websiteUrl: string;
  country: string;
  city: string;
  address: string;
  timeZone: string;
  customerType: string;
}

interface LeadContactFormModel {
  fullName: string;
  title: string;
  email: string;
}

interface CommunicationMetric {
  key: string;
  label: string;
  value: string;
  description: string;
  tagType?: NaiveUI.ThemeColor;
}

interface ScheduleDigest {
  firstSentTime: string;
  replyTime: string;
  stopReason: string;
}

const modalVisible = computed({
  get: () => props.show,
  set: value => emit('update:show', value)
});
const activeTabModel = computed({
  get: () => props.activeTab ?? 'overview',
  set: value => emit('update:activeTab', value as LeadCommunicationTab)
});

const noteForm = reactive(createDefaultLeadNoteForm());
const statusForm = reactive(createDefaultLeadStatusForm());
const accountForm = reactive<LeadAccountFormModel>({
  name: '',
  normalizedName: '',
  websiteUrl: '',
  country: '',
  city: '',
  address: '',
  timeZone: '',
  customerType: ''
});
const accountEditing = shallowRef(false);
const contactModalVisible = shallowRef(false);
const contactEditingId = shallowRef<string | null>(null);
const contactForm = reactive<LeadContactFormModel>({
  fullName: '',
  title: '',
  email: ''
});

const account = computed(() => props.detail?.account ?? null);
const contacts = computed(() => props.detail?.contacts ?? []);
const enrichmentHistories = computed(() => props.detail?.enrichmentHistories ?? []);
const timelineEvents = computed(() => props.detail?.timelineEvents ?? []);
const primaryContact = computed(() => contacts.value[0] ?? null);
const selectedContactId = shallowRef<string | null>(null);
const selectedContact = computed(
  () => contacts.value.find(contact => contact.id === selectedContactId.value) ?? primaryContact.value
);
const selectedContactProgress = computed(() =>
  selectedContact.value ? buildLeadEmailProgressView(selectedContact.value) : null
);
const canCreateSequenceFromSelectedContact = computed(() =>
  Boolean(
    account.value &&
    selectedContact.value &&
    canCreateSequenceFromLeadAccountContact(account.value, selectedContact.value)
  )
);
const nextAction = computed(() => (account.value ? getLeadNextAction(account.value.status) : null));
const latestHunterHistory = computed(
  () => enrichmentHistories.value.find(history => history.provider === 'hunter') ?? null
);
const canRefreshHunter = computed(() => Boolean(account.value?.domain || account.value?.websiteUrl));
const archivedMatchGroups = computed(() =>
  getArchivedFingerprintMatchEvents(timelineEvents.value).map(event => ({
    event,
    matches: readArchivedFingerprintMatches(event)
  }))
);

function canCreateSequenceFromDetailContact(contact: Api.Crm.LeadContact) {
  return account.value ? canCreateSequenceFromLeadAccountContact(account.value, contact) : false;
}
const archivedMatchCount = computed(() =>
  archivedMatchGroups.value.reduce((total, group) => total + group.matches.length, 0)
);
const contactModalTitle = computed(() => (contactEditingId.value ? '编辑联系人' : '新增联系人'));
const selectedContactTimelineEvents = computed(() => {
  const contactId = selectedContact.value?.id;

  if (!contactId) return [];

  return timelineEvents.value.filter(event => event.contactId === contactId);
});
const communicationHealth = computed(() => {
  const status = account.value?.status;

  if (!status) return { label: '-', type: 'default' as const };
  if (['invalid', 'blocked'].includes(status)) return { label: '需处理', type: 'error' as const };
  if (['missing_contact', 'email_verification_pending', 'manual_review_pending'].includes(status)) {
    return { label: '待补齐', type: 'warning' as const };
  }
  if (status === 'replied_pending') return { label: '待回复', type: 'info' as const };
  if (status === 'archived' || status === 'paused') return { label: '已暂停', type: 'default' as const };

  return { label: '正常', type: 'success' as const };
});
const statusMetrics = computed<CommunicationMetric[]>(() => [
  {
    key: 'action',
    label: '当前动作',
    value: nextAction.value?.label ?? '-',
    description: nextAction.value?.description ?? ''
  },
  {
    key: 'contact',
    label: '主联系人',
    value: selectedContact.value?.fullName || selectedContact.value?.maskedEmail || '-',
    description: selectedContact.value?.title || selectedContact.value?.maskedEmail || ''
  },
  {
    key: 'latest',
    label: '邮箱进度',
    value: selectedContactProgress.value?.label ?? '首封待生成',
    description: selectedContactProgress.value?.timeText ?? ''
  },
  {
    key: 'health',
    label: '触达健康',
    value: communicationHealth.value.label,
    tagType: communicationHealth.value.type,
    description: ''
  }
]);
const sequenceSummary = computed(() => {
  const progress = selectedContactProgress.value;

  if (progress)
    return `${selectedContact.value?.fullName || selectedContact.value?.maskedEmail || '当前联系人'}：${progress.label}${progress.timeText === '-' ? '' : ` · ${progress.timeText}`}`;

  const status = account.value?.status;

  if (status === 'sequence_running') return '客户正在开发信序列中，建议查看邮件任务确认当前待发送邮件和调度。';
  if (status === 'replied_pending') return '客户已经回复，后续未发送邮件应已停止，优先处理回复。';
  if (status === 'ready') return '客户已可触达，可以从联系人创建开发信任务。';
  if (status === 'followed_up') return '客户已完成阶段性跟进，可结合邮件往来判断后续动作。';
  if (status === 'archived') return '客户已暂不开发，不会继续进入发送队列。';

  return nextAction.value?.description ?? '暂无开发信进度。';
});
const scheduleDigest = computed<ScheduleDigest>(() => {
  const contact = selectedContact.value;
  const events = selectedContactTimelineEvents.value;
  const firstSentEvent = findEarliestTimelineEvent(events, event => event.eventType === 'message_sent');
  const replyEvent = findLatestTimelineEvent(events, event =>
    ['customer_replied', 'customer_reply_received', 'customer_unsubscribed', 'email_bounced'].includes(event.eventType)
  );
  const stoppedEvent = findLatestTimelineEvent(events, event => event.eventType === 'sequence_stopped');
  const firstSentAt =
    firstSentEvent?.createdAt ??
    (contact?.emailProgressStatus === 'sent' && contact.emailProgressStepIndex === 1 ? contact.emailProgressAt : null);

  return {
    firstSentTime: firstSentAt ? formatLeadDate(firstSentAt) : '-',
    replyTime: replyEvent?.createdAt
      ? formatLeadDate(replyEvent.createdAt)
      : contact?.emailProgressStatus === 'replied'
        ? formatLeadProgressTime(contact.emailProgressAt)
        : '-',
    stopReason: resolveScheduleStopReason({ contact, replyEvent, stoppedEvent })
  };
});

/** Find the newest timeline event that matches a business predicate. */
function findLatestTimelineEvent(
  events: Api.Crm.LeadTimelineEvent[],
  predicate: (event: Api.Crm.LeadTimelineEvent) => boolean
) {
  return events
    .filter(predicate)
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())[0];
}

/** Find the oldest timeline event that matches a business predicate. */
function findEarliestTimelineEvent(
  events: Api.Crm.LeadTimelineEvent[],
  predicate: (event: Api.Crm.LeadTimelineEvent) => boolean
) {
  return events
    .filter(predicate)
    .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime())[0];
}

/** Resolve the user-facing stop reason without exposing internal queue rules. */
function resolveScheduleStopReason(input: {
  contact: Api.Crm.LeadContact | null;
  replyEvent?: Api.Crm.LeadTimelineEvent;
  stoppedEvent?: Api.Crm.LeadTimelineEvent;
}) {
  if (input.replyEvent?.eventType === 'customer_unsubscribed') return '客户退订，已停止后续发送';
  if (input.replyEvent?.eventType === 'email_bounced') return '邮件退信，已停止后续发送';
  if (input.replyEvent) return '客户已回复，已停止后续发送';
  if (input.stoppedEvent) return '人工停止开发信序列';
  if (input.contact?.emailStatus === 'unsubscribed') return '客户退订，已停止后续发送';
  if (input.contact?.emailProgressStatus === 'skipped') return '后续邮件已跳过';
  if (input.contact?.emailProgressStatus === 'replied') return '客户已回复，已停止后续发送';

  return '未触发停止';
}

/** Check whether the current contact already has an email verification request in flight. */
function isContactVerifying(contactId: string) {
  return props.verifyingContactIds?.includes(contactId) ?? false;
}

/** Check whether a provider refresh request is currently running. */
function isEnrichmentRefreshing(provider: Api.Crm.LeadEnrichmentProvider) {
  return props.refreshingEnrichmentProvider === provider;
}

function isContactDeleting(contactId: string) {
  return props.contactDeletingId === contactId;
}

const contactColumns = computed<DataTableColumns<Api.Crm.LeadContact>>(() => [
  {
    key: 'contact',
    title: '联系人',
    minWidth: 180,
    render: row =>
      h('div', { class: 'lead-contact-cell' }, [
        h('span', { class: 'lead-primary-text' }, row.fullName || '-'),
        h('span', { class: 'lead-secondary-text' }, row.title || '-')
      ])
  },
  {
    key: 'email',
    title: '邮箱',
    minWidth: 220,
    render: row => row.maskedEmail || row.email
  },
  {
    key: 'emailStatus',
    title: '邮箱状态',
    width: 110,
    render: row =>
      h(
        NTag,
        {
          bordered: false,
          size: 'small',
          type: leadEmailStatusTagTypeMap[row.emailStatus]
        },
        { default: () => leadEmailStatusLabelMap[row.emailStatus] }
      )
  },
  {
    key: 'emailProgress',
    title: '邮箱进度',
    minWidth: 180,
    render: row => {
      const progress = buildLeadEmailProgressView(row);

      return h('div', { class: 'lead-contact-cell' }, [
        h(
          NTag,
          {
            bordered: false,
            size: 'small',
            type: progress.tagType
          },
          { default: () => progress.label }
        ),
        h('span', { class: 'lead-secondary-text' }, progress.timeText)
      ]);
    }
  },
  {
    key: 'operate',
    title: '操作',
    width: 150,
    fixed: 'right',
    render: row =>
      h(
        NSpace,
        {
          size: 8,
          justify: 'center'
        },
        {
          default: () => [
            h(
              NButton,
              {
                size: 'small',
                text: true,
                type: 'info',
                disabled: props.contactSubmitting,
                onClick: () => handleStartEditContact(row)
              },
              { default: () => '编辑' }
            ),
            h(
              NPopconfirm,
              {
                onPositiveClick: () => emit('deleteContact', row)
              },
              {
                trigger: () =>
                  h(
                    NButton,
                    {
                      size: 'small',
                      text: true,
                      type: 'error',
                      loading: isContactDeleting(row.id),
                      disabled: isContactDeleting(row.id) || props.contactSubmitting
                    },
                    { default: () => '删除' }
                  ),
                default: () => '确认删除这个联系人吗？'
              }
            ),
            h(
              NButton,
              {
                size: 'small',
                text: true,
                type: 'primary',
                loading: isContactVerifying(row.id),
                disabled: isContactVerifying(row.id),
                onClick: () => emit('verifyContactEmail', row)
              },
              { default: () => '验证' }
            ),
            h(
              NButton,
              {
                size: 'small',
                text: true,
                type: 'success',
                disabled: !canCreateSequenceFromDetailContact(row),
                onClick: () => emit('createSequence', row)
              },
              { default: () => '开发信' }
            )
          ]
        }
      )
  }
]);

watch(
  [() => props.activeContactId, () => contacts.value.map(contact => contact.id).join(',')],
  ([activeContactId]) => {
    selectedContactId.value =
      activeContactId && contacts.value.some(contact => contact.id === activeContactId)
        ? activeContactId
        : (contacts.value[0]?.id ?? null);
  },
  { immediate: true }
);

watch(
  () => props.detail?.account,
  value => {
    Object.assign(accountForm, {
      name: value?.name ?? '',
      normalizedName: value?.normalizedName ?? '',
      websiteUrl: value?.websiteUrl ?? '',
      country: value?.country ?? '',
      city: value?.city ?? '',
      address: value?.address ?? '',
      timeZone: value?.timeZone ?? '',
      customerType: value?.customerType ?? ''
    });
  },
  { immediate: true }
);

watch(
  () => props.detail?.account.status,
  status => {
    Object.assign(statusForm, createDefaultLeadStatusForm(status));
  },
  { immediate: true }
);

watch(
  () => props.detail?.timelineEvents.length,
  () => {
    Object.assign(noteForm, createDefaultLeadNoteForm());
  }
);

/** Submit a manual timeline note after trimming user input. */
function handleSubmitNote() {
  const content = noteForm.content.trim();

  if (!content) {
    message.warning('请输入备注内容');
    return;
  }

  emit('submitNote', { content });
}

/** Submit the selected status and optional remark to the parent action layer. */
function handleSubmitStatus() {
  if (!statusForm.status) {
    message.warning('请选择客户状态');
    return;
  }

  const remark = statusForm.remark.trim();

  emit('submitStatus', {
    status: statusForm.status,
    ...(remark ? { remark } : {})
  });
}

function handleStartEditAccount() {
  if (!account.value) {
    return;
  }

  Object.assign(accountForm, {
    name: account.value.name ?? '',
    normalizedName: account.value.normalizedName ?? '',
    websiteUrl: account.value.websiteUrl ?? '',
    country: account.value.country ?? '',
    city: account.value.city ?? '',
    address: account.value.address ?? '',
    timeZone: account.value.timeZone ?? '',
    customerType: account.value.customerType ?? ''
  });
  accountEditing.value = true;
}

function handleCancelEditAccount() {
  accountEditing.value = false;
  Object.assign(accountForm, {
    name: account.value?.name ?? '',
    normalizedName: account.value?.normalizedName ?? '',
    websiteUrl: account.value?.websiteUrl ?? '',
    country: account.value?.country ?? '',
    city: account.value?.city ?? '',
    address: account.value?.address ?? '',
    timeZone: account.value?.timeZone ?? '',
    customerType: account.value?.customerType ?? ''
  });
}

function handleSubmitAccount() {
  const name = accountForm.name.trim();
  const normalizedName = accountForm.normalizedName.trim();

  if (!name) {
    message.warning('请输入客户名称');
    return;
  }

  if (!normalizedName) {
    message.warning('请输入标准名');
    return;
  }

  emit(
    'submitAccount',
    buildLeadAccountUpdatePayload({
      name,
      normalizedName,
      websiteUrl: accountForm.websiteUrl,
      country: accountForm.country,
      city: accountForm.city,
      address: accountForm.address,
      timeZone: accountForm.timeZone === (account.value?.timeZone ?? '') ? undefined : accountForm.timeZone,
      customerType: accountForm.customerType
    }),
    success => {
      if (success) {
        accountEditing.value = false;
      }
    }
  );
}

function resetContactForm() {
  Object.assign(contactForm, {
    fullName: '',
    title: '',
    email: ''
  });
}

function handleStartCreateContact() {
  contactEditingId.value = null;
  resetContactForm();
  contactModalVisible.value = true;
}

function handleStartEditContact(contact: Api.Crm.LeadContact) {
  contactEditingId.value = contact.id;
  Object.assign(contactForm, {
    fullName: contact.fullName ?? '',
    title: contact.title ?? '',
    email: contact.email
  });
  contactModalVisible.value = true;
}

function handleCloseContactModal() {
  contactModalVisible.value = false;
  contactEditingId.value = null;
  resetContactForm();
}

function handleSubmitContact() {
  const email = contactForm.email.trim();

  if (!email) {
    message.warning('请输入联系人邮箱');
    return;
  }

  const payload = {
    fullName: contactForm.fullName.trim(),
    title: contactForm.title.trim(),
    email
  };

  if (contactEditingId.value) {
    emit('updateContact', contactEditingId.value, payload, success => {
      if (success) {
        handleCloseContactModal();
      }
    });
    return;
  }

  emit('createContact', payload, success => {
    if (success) {
      handleCloseContactModal();
    }
  });
}

function handleSelectCommunicationContact(contactId: string) {
  selectedContactId.value = contactId;
}
</script>

<template>
  <NModal
    v-model:show="modalVisible"
    preset="card"
    class="customer-communication-modal"
    :bordered="false"
    :mask-closable="false"
    :segmented="{ content: true, footer: true }"
  >
    <template #header>
      <div class="communication-header">
        <div class="communication-heading">
          <NSpace align="center" :size="8" wrap>
            <span class="modal-title">客户沟通{{ account ? ` · ${account.name}` : '' }}</span>
            <NTag v-if="account" :type="leadStatusTagTypeMap[account.status]" :bordered="false" size="small">
              {{ leadStatusLabelMap[account.status] }}
            </NTag>
            <NTag v-if="contacts.length" type="info" :bordered="false" size="small">
              {{ contacts.length }} 个联系人
            </NTag>
            <NTag
              v-if="communicationHealth.label !== '-'"
              :type="communicationHealth.type"
              :bordered="false"
              size="small"
            >
              {{ communicationHealth.label }}
            </NTag>
          </NSpace>
          <div v-if="account" class="modal-subtitle">
            {{ formatLeadText(account.websiteUrl || account.domain) }} ·
            {{ formatLeadText(selectedContact?.maskedEmail) }} · {{ formatLeadText(account.city || account.country) }} ·
            {{ formatLeadText(account.timeZone) }}
          </div>
        </div>
        <NSpace align="center" :size="8">
          <NButton size="tiny" :loading="loading" @click="emit('reload')">刷新</NButton>
        </NSpace>
      </div>
    </template>

    <NSpin :show="loading">
      <NSpace v-if="account" vertical :size="14" class="communication-content">
        <div class="communication-metrics">
          <div v-for="metric in statusMetrics" :key="metric.key" class="communication-metric">
            <span class="metric-label">{{ metric.label }}</span>
            <NTag v-if="metric.tagType" :type="metric.tagType" :bordered="false" size="small">
              {{ metric.value }}
            </NTag>
            <span v-else class="metric-value">{{ metric.value }}</span>
            <span v-if="metric.description" class="metric-description">{{ metric.description }}</span>
          </div>
        </div>

        <NAlert v-if="account.status === 'replied_pending'" type="info" :bordered="false" title="客户已回复">
          后续未发送邮件会按当前 CRM 规则自动停止，优先到“邮件往来”处理回复。
        </NAlert>

        <NAlert v-if="archivedMatchGroups.length" type="warning" title="历史触达提醒" class="historical-touch-alert">
          <NSpace vertical :size="8">
            <div class="historical-touch-content">
              {{ archivedMatchGroups[0].event.content || '该客户命中过往暂不开发记录，请确认是否需要重新开发。' }}
            </div>
            <NTag v-if="archivedMatchCount" size="small" type="warning" :bordered="false">
              命中 {{ archivedMatchCount }} 条组织历史记录
            </NTag>
            <div v-for="group in archivedMatchGroups" :key="group.event.id" class="historical-match-list">
              <div
                v-for="match in group.matches"
                :key="`${group.event.id}-${match.fingerprintType}-${match.maskedValue}-${match.archivedAt}`"
                class="historical-match-item"
              >
                <NTag size="small" type="warning" :bordered="false">
                  {{ formatArchivedFingerprintTypeLabel(match.fingerprintType) }}
                </NTag>
                <span class="historical-match-value">{{ formatLeadText(match.maskedValue) }}</span>
                <span class="lead-secondary-text">暂不开发于 {{ formatLeadDate(match.archivedAt) }}</span>
                <span v-if="match.accountName" class="lead-secondary-text">原客户：{{ match.accountName }}</span>
              </div>
            </div>
          </NSpace>
        </NAlert>

        <NTabs v-model:value="activeTabModel" type="line" animated class="communication-tabs">
          <NTabPane name="overview" tab="总览">
            <div class="communication-tab-grid">
              <div class="drawer-section">
                <div class="section-title">当前状态</div>
                <NDescriptions :column="1" label-placement="left" bordered size="small">
                  <NDescriptionsItem label="当前动作">{{ nextAction?.label ?? '-' }}</NDescriptionsItem>
                  <NDescriptionsItem label="说明">{{ nextAction?.description ?? '-' }}</NDescriptionsItem>
                  <NDescriptionsItem label="主联系人">
                    {{ selectedContact?.fullName || selectedContact?.maskedEmail || '-' }}
                  </NDescriptionsItem>
                  <NDescriptionsItem label="邮箱状态">
                    <NTag
                      v-if="selectedContact"
                      :type="leadEmailStatusTagTypeMap[selectedContact.emailStatus]"
                      :bordered="false"
                      size="small"
                    >
                      {{ leadEmailStatusLabelMap[selectedContact.emailStatus] }}
                    </NTag>
                    <span v-else>-</span>
                  </NDescriptionsItem>
                  <NDescriptionsItem label="邮箱进度">
                    <NSpace v-if="selectedContactProgress" align="center" :size="8" wrap>
                      <NTag :type="selectedContactProgress.tagType" :bordered="false" size="small">
                        {{ selectedContactProgress.label }}
                      </NTag>
                      <span class="lead-secondary-text">{{ selectedContactProgress.timeText }}</span>
                    </NSpace>
                    <span v-else>-</span>
                  </NDescriptionsItem>
                </NDescriptions>
              </div>

              <div class="drawer-section">
                <div class="section-title">最近动态</div>
                <NTimeline v-if="timelineEvents.length">
                  <NTimelineItem
                    v-for="event in timelineEvents.slice(0, 5)"
                    :key="event.id"
                    :type="getLeadTimelineItemType(event)"
                    :title="formatLeadTimelineTitle(event)"
                    :content="event.content || leadTimelineEventLabelMap[event.eventType] || event.eventType"
                    :time="formatLeadDate(event.createdAt)"
                  />
                </NTimeline>
                <NEmpty v-else description="暂无动态" />
              </div>
            </div>
          </NTabPane>

          <NTabPane name="sequence" tab="开发信">
            <div class="communication-workspace">
              <div class="drawer-section">
                <div class="section-title">开发信进度</div>
                <NAlert type="info" :bordered="false">{{ sequenceSummary }}</NAlert>
                <NDescriptions :column="1" label-placement="left" bordered size="small">
                  <NDescriptionsItem label="客户状态">{{ leadStatusLabelMap[account.status] }}</NDescriptionsItem>
                  <NDescriptionsItem label="当前联系人">
                    {{ selectedContact?.fullName || selectedContact?.maskedEmail || '-' }}
                  </NDescriptionsItem>
                  <NDescriptionsItem label="联系人邮箱">
                    {{ formatLeadText(selectedContact?.maskedEmail) }}
                  </NDescriptionsItem>
                  <NDescriptionsItem label="邮箱进度">
                    <NSpace v-if="selectedContactProgress" align="center" :size="8" wrap>
                      <NTag :type="selectedContactProgress.tagType" :bordered="false" size="small">
                        {{ selectedContactProgress.label }}
                      </NTag>
                      <span class="lead-secondary-text">{{ selectedContactProgress.timeText }}</span>
                    </NSpace>
                    <span v-else>-</span>
                  </NDescriptionsItem>
                  <NDescriptionsItem label="最近更新时间">{{ formatLeadDate(account.updatedAt) }}</NDescriptionsItem>
                </NDescriptions>
              </div>
              <div class="drawer-section side-action-panel">
                <div class="section-title">操作</div>
                <NButton
                  type="primary"
                  secondary
                  :disabled="!canCreateSequenceFromSelectedContact"
                  @click="selectedContact && emit('createSequence', selectedContact)"
                >
                  创建开发信
                </NButton>
                <NText depth="3" class="section-subtitle">
                  精确的每封邮件正文、历史版本和确认发送动作会复用开发信任务页的详情能力。
                </NText>
              </div>
            </div>
          </NTabPane>

          <NTabPane name="inbox" tab="邮件往来">
            <LeadInboxPanel
              :account-id="account.id"
              :active="activeTabModel === 'inbox'"
              :contact-id="selectedContact?.id"
            />
          </NTabPane>

          <NTabPane name="schedule" tab="调度">
            <div class="communication-workspace schedule-workspace">
              <div class="drawer-section contact-selector-panel">
                <div class="section-title">联系人</div>
                <div class="contact-selector-list">
                  <button
                    v-for="contact in contacts"
                    :key="contact.id"
                    class="contact-selector-item"
                    :class="{ 'contact-selector-item--active': selectedContact?.id === contact.id }"
                    type="button"
                    @click="handleSelectCommunicationContact(contact.id)"
                  >
                    <span class="contact-selector-name">{{ contact.fullName || contact.maskedEmail }}</span>
                    <span class="lead-secondary-text">{{ contact.title || contact.maskedEmail }}</span>
                    <NTag :type="buildLeadEmailProgressView(contact).tagType" :bordered="false" size="small">
                      {{ buildLeadEmailProgressView(contact).label }}
                    </NTag>
                  </button>
                </div>
              </div>
              <div class="drawer-section">
                <div class="section-title">调度摘要</div>
                <NDescriptions :column="1" label-placement="left" bordered size="small">
                  <NDescriptionsItem label="第一封发送时间">{{ scheduleDigest.firstSentTime }}</NDescriptionsItem>
                  <NDescriptionsItem label="客户回复时间">{{ scheduleDigest.replyTime }}</NDescriptionsItem>
                  <NDescriptionsItem label="停止原因">{{ scheduleDigest.stopReason }}</NDescriptionsItem>
                </NDescriptions>
              </div>
            </div>
          </NTabPane>

          <NTabPane name="profile" tab="客户资料">
            <div class="profile-tab-content">
              <div class="drawer-section">
                <div class="section-title-row">
                  <div class="section-title">账户信息</div>
                  <NSpace :size="8">
                    <NButton
                      v-if="!accountEditing"
                      size="small"
                      secondary
                      type="primary"
                      @click="handleStartEditAccount"
                    >
                      编辑
                    </NButton>
                    <template v-else>
                      <NButton size="small" :disabled="accountSubmitting" @click="handleCancelEditAccount">
                        取消
                      </NButton>
                      <NButton size="small" type="primary" :loading="accountSubmitting" @click="handleSubmitAccount">
                        保存
                      </NButton>
                    </template>
                  </NSpace>
                </div>
                <NDescriptions :column="1" label-placement="left" bordered size="small">
                  <NDescriptionsItem label="标准名">
                    <NInput
                      v-if="accountEditing"
                      v-model:value="accountForm.normalizedName"
                      size="small"
                      placeholder="输入标准名"
                    />
                    <span v-else>{{ formatLeadText(account.normalizedName) }}</span>
                  </NDescriptionsItem>
                  <NDescriptionsItem label="地区/地址">
                    <div v-if="accountEditing" class="lead-location-editor">
                      <NInputGroup>
                        <NInput v-model:value="accountForm.country" size="small" placeholder="国家/地区" />
                        <NInput v-model:value="accountForm.city" size="small" placeholder="城市" />
                      </NInputGroup>
                      <NInput v-model:value="accountForm.address" size="small" placeholder="地址" />
                    </div>
                    <div v-else class="lead-location-view">
                      <span>{{ formatLeadText(account.country) }}</span>
                      <span v-if="account.city" class="lead-secondary-text">{{ account.city }}</span>
                      <span v-if="account.address" class="lead-secondary-text">{{ account.address }}</span>
                    </div>
                  </NDescriptionsItem>
                  <NDescriptionsItem label="时区">
                    <NInput
                      v-if="accountEditing"
                      v-model:value="accountForm.timeZone"
                      size="small"
                      placeholder="留空自动根据地区识别，如 Asia/Riyadh"
                    />
                    <span v-else>{{ formatLeadText(account.timeZone) }}</span>
                  </NDescriptionsItem>
                  <NDescriptionsItem label="客户类型">
                    <NInput
                      v-if="accountEditing"
                      v-model:value="accountForm.customerType"
                      size="small"
                      placeholder="输入客户类型"
                    />
                    <span v-else>{{ formatLeadText(account.customerType) }}</span>
                  </NDescriptionsItem>
                  <NDescriptionsItem label="来源任务">{{ formatLeadText(account.sourceTaskId) }}</NDescriptionsItem>
                  <NDescriptionsItem label="创建时间">{{ formatLeadDate(account.createdAt) }}</NDescriptionsItem>
                  <NDescriptionsItem label="更新时间">{{ formatLeadDate(account.updatedAt) }}</NDescriptionsItem>
                </NDescriptions>
              </div>

              <div class="drawer-section">
                <div class="section-title-row">
                  <div class="section-title">联系人获取</div>
                  <NButton
                    size="small"
                    type="primary"
                    secondary
                    :loading="isEnrichmentRefreshing('hunter')"
                    :disabled="!canRefreshHunter || isEnrichmentRefreshing('hunter')"
                    @click="emit('refreshEnrichment', 'hunter')"
                  >
                    重新获取联系人
                  </NButton>
                </div>
                <NDescriptions :column="1" label-placement="left" bordered size="small">
                  <NDescriptionsItem :label="leadEnrichmentProviderLabelMap.hunter">
                    <NSpace v-if="latestHunterHistory" align="center" :size="8" wrap>
                      <NTag
                        size="small"
                        :bordered="false"
                        :type="leadEnrichmentStatusTagTypeMap[latestHunterHistory.status]"
                      >
                        {{ leadEnrichmentStatusLabelMap[latestHunterHistory.status] }}
                      </NTag>
                      <span>{{ formatLeadDate(latestHunterHistory.lastAttemptedAt) }}</span>
                      <span v-if="latestHunterHistory.maskedEmail" class="lead-secondary-text">
                        {{ latestHunterHistory.maskedEmail }}
                      </span>
                    </NSpace>
                    <span v-else class="lead-secondary-text">暂无记录</span>
                  </NDescriptionsItem>
                </NDescriptions>
              </div>

              <div class="drawer-section">
                <div class="section-title">状态变更</div>
                <NForm :model="statusForm" label-placement="top" size="small">
                  <NFormItem label="状态">
                    <NSelect v-model:value="statusForm.status" :options="leadStatusOptions" placeholder="选择状态" />
                  </NFormItem>
                  <NFormItem label="备注">
                    <NInput
                      v-model:value="statusForm.remark"
                      type="textarea"
                      :autosize="{ minRows: 2, maxRows: 4 }"
                      placeholder="可选，记录本次状态变更原因"
                    />
                  </NFormItem>
                  <div class="form-actions">
                    <NButton size="small" type="primary" :loading="statusSubmitting" @click="handleSubmitStatus">
                      保存状态
                    </NButton>
                  </div>
                </NForm>
              </div>

              <div class="drawer-section">
                <div class="section-title-row">
                  <div class="section-title">联系人</div>
                  <NButton
                    size="small"
                    type="primary"
                    secondary
                    :disabled="contactSubmitting"
                    @click="handleStartCreateContact"
                  >
                    新增联系人
                  </NButton>
                </div>
                <NDataTable
                  :columns="contactColumns"
                  :data="contacts"
                  :row-key="row => row.id"
                  :scroll-x="940"
                  size="small"
                >
                  <template #empty>
                    <NEmpty description="暂无联系人" />
                  </template>
                </NDataTable>
              </div>

              <div class="drawer-section">
                <div class="section-title">新增备注</div>
                <NInput
                  v-model:value="noteForm.content"
                  type="textarea"
                  :autosize="{ minRows: 3, maxRows: 6 }"
                  placeholder="输入跟进备注"
                />
                <div class="form-actions">
                  <NButton size="small" type="primary" :loading="noteSubmitting" @click="handleSubmitNote">
                    添加备注
                  </NButton>
                </div>
              </div>

              <div class="drawer-section">
                <div class="section-title">时间线</div>
                <NTimeline v-if="timelineEvents.length">
                  <NTimelineItem
                    v-for="event in timelineEvents"
                    :key="event.id"
                    :type="getLeadTimelineItemType(event)"
                    :title="formatLeadTimelineTitle(event)"
                    :content="event.content || leadTimelineEventLabelMap[event.eventType] || event.eventType"
                    :time="formatLeadDate(event.createdAt)"
                  />
                </NTimeline>
                <NEmpty v-else description="暂无时间线" />
              </div>
            </div>
          </NTabPane>
        </NTabs>
      </NSpace>
      <NEmpty v-else description="请选择客户" />
    </NSpin>

    <template #footer>
      <NSpace justify="space-between" align="center" class="modal-footer">
        <NText depth="3">所有入口都会打开同一个客户沟通弹窗，并自动切换到对应视图。</NText>
        <NButton @click="modalVisible = false">关闭</NButton>
      </NSpace>
    </template>
  </NModal>

  <NModal v-model:show="contactModalVisible" preset="card" :title="contactModalTitle" class="lead-contact-modal">
    <NForm :model="contactForm" label-placement="top" size="small">
      <NGrid :cols="24" :x-gap="12" responsive="screen" item-responsive>
        <NGi span="24 m:12">
          <NFormItem label="联系人">
            <NInput v-model:value="contactForm.fullName" placeholder="输入联系人姓名" />
          </NFormItem>
        </NGi>
        <NGi span="24 m:12">
          <NFormItem label="职位">
            <NInput v-model:value="contactForm.title" placeholder="输入职位" />
          </NFormItem>
        </NGi>
        <NGi span="24">
          <NFormItem label="邮箱">
            <NInput v-model:value="contactForm.email" placeholder="name@example.com" />
          </NFormItem>
        </NGi>
      </NGrid>
    </NForm>

    <template #footer>
      <NSpace justify="end">
        <NButton :disabled="contactSubmitting" @click="handleCloseContactModal">取消</NButton>
        <NButton type="primary" :loading="contactSubmitting" @click="handleSubmitContact">保存</NButton>
      </NSpace>
    </template>
  </NModal>
</template>

<style scoped>
.customer-communication-modal {
  width: min(1280px, calc(100vw - 32px));
  max-width: calc(100vw - 32px);
}

.communication-header,
.modal-footer,
.section-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
}

.communication-heading,
.communication-content,
.drawer-section,
.profile-tab-content,
.contact-selector-list,
.side-action-panel {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.communication-heading {
  gap: 6px;
}

.modal-title {
  color: var(--n-text-color);
  font-size: 18px;
  font-weight: 600;
  line-height: 1.35;
}

.modal-subtitle,
.section-subtitle,
.metric-description {
  color: var(--n-text-color-3);
  font-size: 12px;
  overflow-wrap: anywhere;
}

.communication-content {
  max-height: min(760px, calc(100vh - 220px));
  overflow: auto;
  padding-right: 2px;
}

.communication-metrics {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.communication-metric {
  display: flex;
  min-width: 0;
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
  background-color: var(--n-table-color);
  flex-direction: column;
  gap: 5px;
  padding: 10px 12px;
}

.metric-label {
  color: var(--n-text-color-3);
  font-size: 12px;
}

.metric-value {
  overflow: hidden;
  color: var(--n-text-color);
  font-size: 14px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.communication-tabs {
  min-width: 0;
}

.communication-tab-grid,
.communication-workspace {
  display: grid;
  gap: 14px;
  min-width: 0;
}

.communication-tab-grid {
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
}

.communication-workspace {
  grid-template-columns: minmax(0, 1fr) minmax(280px, 0.42fr);
}

.schedule-workspace {
  grid-template-columns: 240px minmax(0, 1fr);
}

.profile-tab-content {
  gap: 14px;
}

.contact-selector-list {
  gap: 8px;
}

.contact-selector-item {
  display: flex;
  width: 100%;
  min-width: 0;
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
  background: var(--n-color);
  cursor: pointer;
  flex-direction: column;
  gap: 5px;
  padding: 9px 10px;
  text-align: left;
}

.contact-selector-item--active {
  border-color: rgb(var(--primary-color));
  background: rgb(var(--primary-color) / 0.07);
}

.contact-selector-name {
  overflow: hidden;
  color: var(--n-text-color);
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.drawer-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.lead-secondary-text {
  color: var(--n-text-color-3);
  font-size: 12px;
}

.lead-location-editor,
.lead-location-view {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.lead-contact-modal {
  width: min(560px, calc(100vw - 32px));
}

.historical-touch-alert {
  margin-top: -4px;
}

.historical-touch-content {
  color: var(--n-text-color);
  font-size: 13px;
  line-height: 1.6;
}

.historical-match-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.historical-match-item {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.historical-match-value {
  color: var(--n-text-color);
  font-size: 13px;
  font-weight: 500;
}

.section-title {
  color: var(--n-text-color);
  font-size: 14px;
  font-weight: 600;
}

.lead-contact-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  line-height: 1.35;
}

.lead-primary-text {
  color: var(--n-text-color);
  font-weight: 500;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 960px) {
  .communication-metrics,
  .communication-tab-grid,
  .communication-workspace {
    grid-template-columns: 1fr;
  }

  .communication-content {
    max-height: calc(100vh - 210px);
  }
}
</style>
