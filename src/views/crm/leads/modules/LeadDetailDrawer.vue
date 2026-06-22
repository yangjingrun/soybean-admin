<script setup lang="ts">
import { computed, h, reactive, ref, watch } from 'vue';
import { NButton, NPopconfirm, NSpace, NTag, useMessage } from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import {
  createDefaultLeadNoteForm,
  createDefaultLeadStatusForm,
  formatArchivedFingerprintTypeLabel,
  formatLeadDate,
  formatLeadText,
  formatLeadTimelineTitle,
  getArchivedFingerprintMatchEvents,
  getLeadTimelineItemType,
  getWebsiteHref,
  leadEnrichmentProviderLabelMap,
  leadEnrichmentStatusLabelMap,
  leadEnrichmentStatusTagTypeMap,
  leadEmailStatusLabelMap,
  leadEmailStatusTagTypeMap,
  leadStatusLabelMap,
  leadStatusOptions,
  leadStatusTagTypeMap,
  leadTimelineEventLabelMap,
  readArchivedFingerprintMatches
} from './shared';

const props = defineProps<{
  show: boolean;
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
  updateContact: [contactId: string, payload: Api.Crm.LeadContactUpdatePayload, done?: (success: boolean) => void];
  verifyContactEmail: [contact: Api.Crm.LeadContact];
}>();

const message = useMessage();

interface LeadAccountFormModel {
  name: string;
  normalizedName: string;
  websiteUrl: string;
  country: string;
  customerType: string;
}

interface LeadContactFormModel {
  fullName: string;
  title: string;
  email: string;
}

const drawerVisible = computed({
  get: () => props.show,
  set: value => emit('update:show', value)
});

const noteForm = reactive(createDefaultLeadNoteForm());
const statusForm = reactive(createDefaultLeadStatusForm());
const accountForm = reactive<LeadAccountFormModel>({
  name: '',
  normalizedName: '',
  websiteUrl: '',
  country: '',
  customerType: ''
});
const accountEditing = ref(false);
const contactModalVisible = ref(false);
const contactEditingId = ref<string | null>(null);
const contactForm = reactive<LeadContactFormModel>({
  fullName: '',
  title: '',
  email: ''
});

const account = computed(() => props.detail?.account ?? null);
const contacts = computed(() => props.detail?.contacts ?? []);
const enrichmentHistories = computed(() => props.detail?.enrichmentHistories ?? []);
const timelineEvents = computed(() => props.detail?.timelineEvents ?? []);
const websiteHref = computed(() => (account.value?.websiteUrl ? getWebsiteHref(account.value.websiteUrl) : ''));
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
const archivedMatchCount = computed(() =>
  archivedMatchGroups.value.reduce((total, group) => total + group.matches.length, 0)
);
const contactModalTitle = computed(() => (contactEditingId.value ? '编辑联系人' : '新增联系人'));

/** Check whether the current contact already has an email verification request in flight. */
function isContactVerifying(contactId: string) {
  return props.verifyingContactIds?.includes(contactId) ?? false;
}

/** Check whether a provider refresh request is currently running. */
function isEnrichmentRefreshing(provider: Api.Crm.LeadEnrichmentProvider) {
  return props.refreshingEnrichmentProvider === provider;
}

/** Contacts that explicitly opted out or failed verification should not start new outreach from the drawer. */
function canCreateSequence(contact: Api.Crm.LeadContact) {
  return !['invalid', 'unreachable', 'unsubscribed'].includes(contact.emailStatus);
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
                disabled: !canCreateSequence(row),
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
  () => props.detail?.account,
  value => {
    Object.assign(accountForm, {
      name: value?.name ?? '',
      normalizedName: value?.normalizedName ?? '',
      websiteUrl: value?.websiteUrl ?? '',
      country: value?.country ?? '',
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
    {
      name,
      normalizedName,
      websiteUrl: accountForm.websiteUrl.trim(),
      country: accountForm.country.trim(),
      customerType: accountForm.customerType.trim()
    },
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
</script>

<template>
  <NDrawer v-model:show="drawerVisible" :width="720" placement="right">
    <NDrawerContent title="客户详情" closable>
      <NSpin :show="loading">
        <NSpace v-if="account" vertical :size="16">
          <div class="drawer-toolbar">
            <NButton size="tiny" :loading="loading" @click="emit('reload')">刷新</NButton>
          </div>

          <div class="lead-summary">
            <NSpace align="center" :size="8">
              <NTag :type="leadStatusTagTypeMap[account.status]" :bordered="false" size="small">
                {{ leadStatusLabelMap[account.status] }}
              </NTag>
              <span class="lead-summary-domain">{{ formatLeadText(account.domain) }}</span>
            </NSpace>
            <NInput v-if="accountEditing" v-model:value="accountForm.name" size="small" placeholder="输入客户名称" />
            <div v-else class="lead-summary-title">{{ account.name }}</div>
            <NInput
              v-if="accountEditing"
              v-model:value="accountForm.websiteUrl"
              size="small"
              placeholder="输入官网链接或域名"
            />
            <a
              v-else-if="account.websiteUrl"
              class="lead-summary-link"
              :href="websiteHref"
              target="_blank"
              rel="noopener noreferrer"
            >
              {{ account.websiteUrl }}
            </a>
            <span v-else class="lead-secondary-text">暂无官网</span>
          </div>

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

          <div class="drawer-section">
            <div class="section-title-row">
              <div class="section-title">账户信息</div>
              <NSpace :size="8">
                <NButton v-if="!accountEditing" size="small" secondary type="primary" @click="handleStartEditAccount">
                  编辑
                </NButton>
                <template v-else>
                  <NButton size="small" :disabled="accountSubmitting" @click="handleCancelEditAccount">取消</NButton>
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
              <NDescriptionsItem label="国家">
                <NInput
                  v-if="accountEditing"
                  v-model:value="accountForm.country"
                  size="small"
                  placeholder="输入国家/地区"
                />
                <span v-else>{{ formatLeadText(account.country) }}</span>
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
              :scroll-x="760"
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
        </NSpace>
        <NEmpty v-else description="请选择客户" />
      </NSpin>
    </NDrawerContent>
  </NDrawer>

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
.lead-summary,
.drawer-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.drawer-toolbar {
  display: flex;
  justify-content: flex-end;
}

.section-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.lead-summary {
  border-bottom: 1px solid var(--n-divider-color);
  padding-bottom: 14px;
}

.lead-summary-title {
  color: var(--n-text-color);
  font-size: 18px;
  font-weight: 600;
}

.lead-summary-domain,
.lead-secondary-text {
  color: var(--n-text-color-3);
  font-size: 12px;
}

.lead-summary-link {
  color: rgb(var(--primary-color));
  text-decoration: none;
}

.lead-summary-link:hover {
  text-decoration: underline;
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

.section-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
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
</style>
