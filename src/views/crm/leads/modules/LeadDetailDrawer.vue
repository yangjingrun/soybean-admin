<script setup lang="ts">
import { computed, h, reactive, watch } from 'vue';
import { NButton, NSpace, NTag, useMessage } from 'naive-ui';
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
  noteSubmitting?: boolean;
  statusSubmitting?: boolean;
  verifyingContactIds?: string[];
}>();

const emit = defineEmits<{
  createSequence: [contact: Api.Crm.LeadContact];
  'update:show': [show: boolean];
  reload: [];
  submitNote: [payload: Api.Crm.LeadNotePayload];
  submitStatus: [payload: Api.Crm.LeadStatusPayload];
  verifyContactEmail: [contact: Api.Crm.LeadContact];
}>();

const message = useMessage();

const drawerVisible = computed({
  get: () => props.show,
  set: value => emit('update:show', value)
});

const noteForm = reactive(createDefaultLeadNoteForm());
const statusForm = reactive(createDefaultLeadStatusForm());

const account = computed(() => props.detail?.account ?? null);
const contacts = computed(() => props.detail?.contacts ?? []);
const timelineEvents = computed(() => props.detail?.timelineEvents ?? []);
const websiteHref = computed(() => (account.value?.websiteUrl ? getWebsiteHref(account.value.websiteUrl) : ''));
const archivedMatchGroups = computed(() =>
  getArchivedFingerprintMatchEvents(timelineEvents.value).map(event => ({
    event,
    matches: readArchivedFingerprintMatches(event)
  }))
);
const archivedMatchCount = computed(() =>
  archivedMatchGroups.value.reduce((total, group) => total + group.matches.length, 0)
);

/** Check whether the current contact already has an email verification request in flight. */
function isContactVerifying(contactId: string) {
  return props.verifyingContactIds?.includes(contactId) ?? false;
}

/** Contacts that explicitly opted out or failed verification should not start new outreach from the drawer. */
function canCreateSequence(contact: Api.Crm.LeadContact) {
  return !['invalid', 'unreachable', 'unsubscribed'].includes(contact.emailStatus);
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
    message.warning('请选择线索状态');
    return;
  }

  const remark = statusForm.remark.trim();

  emit('submitStatus', {
    status: statusForm.status,
    ...(remark ? { remark } : {})
  });
}
</script>

<template>
  <NDrawer v-model:show="drawerVisible" :width="720" placement="right">
    <NDrawerContent title="线索详情" closable>
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
            <div class="lead-summary-title">{{ account.name }}</div>
            <a
              v-if="account.websiteUrl"
              class="lead-summary-link"
              :href="websiteHref"
              target="_blank"
              rel="noopener noreferrer"
            >
              {{ account.websiteUrl }}
            </a>
            <span v-else class="lead-secondary-text">暂无官网</span>
          </div>

          <NAlert
            v-if="archivedMatchGroups.length"
            type="warning"
            title="历史触达提醒"
            class="historical-touch-alert"
          >
            <NSpace vertical :size="8">
              <div class="historical-touch-content">
                {{ archivedMatchGroups[0].event.content || '该线索命中过往归档记录，请确认是否需要重新开发。' }}
              </div>
              <NTag v-if="archivedMatchCount" size="small" type="warning" :bordered="false">
                命中 {{ archivedMatchCount }} 条组织归档指纹
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
                  <span class="lead-secondary-text">归档于 {{ formatLeadDate(match.archivedAt) }}</span>
                  <span v-if="match.accountName" class="lead-secondary-text">原线索：{{ match.accountName }}</span>
                </div>
              </div>
            </NSpace>
          </NAlert>

          <div class="drawer-section">
            <div class="section-title">账户信息</div>
            <NDescriptions :column="1" label-placement="left" bordered size="small">
              <NDescriptionsItem label="标准名">{{ account.normalizedName }}</NDescriptionsItem>
              <NDescriptionsItem label="国家">{{ formatLeadText(account.country) }}</NDescriptionsItem>
              <NDescriptionsItem label="客户类型">{{ formatLeadText(account.customerType) }}</NDescriptionsItem>
              <NDescriptionsItem label="来源任务">{{ formatLeadText(account.sourceTaskId) }}</NDescriptionsItem>
              <NDescriptionsItem label="创建时间">{{ formatLeadDate(account.createdAt) }}</NDescriptionsItem>
              <NDescriptionsItem label="更新时间">{{ formatLeadDate(account.updatedAt) }}</NDescriptionsItem>
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
            <div class="section-title">联系人</div>
            <NDataTable
              :columns="contactColumns"
              :data="contacts"
              :row-key="row => row.id"
              :scroll-x="620"
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
              <NButton size="small" type="primary" :loading="noteSubmitting" @click="handleSubmitNote">添加备注</NButton>
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
        <NEmpty v-else description="请选择线索" />
      </NSpin>
    </NDrawerContent>
  </NDrawer>
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
</style>
