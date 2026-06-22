<script setup lang="ts">
import { computed } from 'vue';
import { buildAssistantRecommendationReason, getAssistantLeadAction } from './shared';
import {
  formatLeadDate,
  formatLeadTimelineTitle,
  getLeadTimelineItemType,
  getWebsiteHref,
  leadEmailStatusLabelMap,
  leadEmailStatusTagTypeMap,
  leadStatusLabelMap,
  leadStatusTagTypeMap
} from '@/views/crm/leads/modules/shared';

const props = defineProps<{
  show: boolean;
  loading?: boolean;
  detail: Api.Crm.LeadDetail | null;
}>();

const emit = defineEmits<{
  'update:show': [show: boolean];
  startFollowUp: [record: Api.Crm.LeadRecord];
  archive: [record: Api.Crm.LeadRecord];
  restore: [record: Api.Crm.LeadRecord];
  refreshEnrichment: [];
  verifyContact: [contact: Api.Crm.LeadContact];
  goInbox: [];
  goSequences: [];
}>();

const drawerVisible = computed({
  get: () => props.show,
  set: value => emit('update:show', value)
});
const account = computed(() => props.detail?.account ?? null);
const contacts = computed(() => props.detail?.contacts ?? []);
const timelineEvents = computed(() => props.detail?.timelineEvents ?? []);
const websiteHref = computed(() => (account.value?.websiteUrl ? getWebsiteHref(account.value.websiteUrl) : ''));

/** Route the account-level CTA to the parent action layer. */
function handleAccountAction(record: Api.Crm.LeadRecord) {
  if (record.status === 'ready') {
    emit('startFollowUp', record);
    return;
  }

  if (record.status === 'archived') {
    emit('restore', record);
    return;
  }

  if (record.status === 'replied_pending') {
    emit('goInbox');
  }
}

function getAccountActionLabel(status: Api.Crm.CrmAccountStatus) {
  if (status === 'ready') return '开始跟进';
  if (status === 'archived') return '恢复';
  if (status === 'replied_pending') return '处理回复';

  return getAssistantLeadAction(status).label;
}
</script>

<template>
  <NDrawer v-model:show="drawerVisible" width="560" placement="right">
    <NDrawerContent title="客户详情" closable>
      <NSpin :show="loading">
        <NSpace v-if="account" vertical :size="16">
          <div class="detail-header">
            <div class="detail-title-row">
              <div class="detail-title">{{ account.name }}</div>
              <NTag :bordered="false" size="small" :type="leadStatusTagTypeMap[account.status]">
                {{ leadStatusLabelMap[account.status] }}
              </NTag>
            </div>

            <div class="detail-meta">
              <span>{{ account.country || '国家未填' }}</span>
              <span>{{ account.customerType || '类型未填' }}</span>
              <a v-if="account.websiteUrl" :href="websiteHref" target="_blank" rel="noopener noreferrer">
                {{ account.domain || account.websiteUrl }}
              </a>
              <span v-else>{{ account.domain || '官网未填' }}</span>
            </div>

            <NSpace :size="8">
              <NButton
                v-if="['ready', 'archived', 'replied_pending'].includes(account.status)"
                size="small"
                type="primary"
                @click="handleAccountAction(account)"
              >
                {{ getAccountActionLabel(account.status) }}
              </NButton>
              <NButton v-if="account.status !== 'archived'" size="small" type="warning" secondary @click="emit('archive', account)">
                暂不开发
              </NButton>
              <NButton size="small" @click="emit('refreshEnrichment')">补全资料</NButton>
              <NButton size="small" @click="emit('goSequences')">跟进队列</NButton>
            </NSpace>
          </div>

          <div class="drawer-section">
            <div class="section-title">推荐原因</div>
            <div class="plain-text">{{ buildAssistantRecommendationReason(account) }}</div>
            <div class="next-action">
              <NTag :bordered="false" size="small" :type="getAssistantLeadAction(account.status).type">
                {{ getAssistantLeadAction(account.status).label }}
              </NTag>
              <span>{{ getAssistantLeadAction(account.status).description }}</span>
            </div>
          </div>

          <div class="drawer-section">
            <div class="section-title">客户资料</div>
            <NDescriptions :column="1" size="small" label-placement="left" bordered>
              <NDescriptionsItem label="标准名">{{ account.normalizedName }}</NDescriptionsItem>
              <NDescriptionsItem label="域名">{{ account.domain || '-' }}</NDescriptionsItem>
              <NDescriptionsItem label="来源任务">{{ account.sourceTaskId || '-' }}</NDescriptionsItem>
              <NDescriptionsItem label="更新时间">{{ formatLeadDate(account.updatedAt) }}</NDescriptionsItem>
            </NDescriptions>
          </div>

          <div class="drawer-section">
            <div class="section-title">联系人</div>
            <div v-if="contacts.length" class="contact-list">
              <div v-for="contact in contacts" :key="contact.id" class="contact-row">
                <div class="contact-main">
                  <span class="contact-name">{{ contact.fullName || '-' }}</span>
                  <span class="contact-meta">{{ contact.title || '-' }}</span>
                  <span class="contact-meta">{{ contact.maskedEmail || contact.email }}</span>
                </div>
                <NSpace :size="8" align="center">
                  <NTag :bordered="false" size="small" :type="leadEmailStatusTagTypeMap[contact.emailStatus]">
                    {{ leadEmailStatusLabelMap[contact.emailStatus] }}
                  </NTag>
                  <NButton size="tiny" text type="primary" @click="emit('verifyContact', contact)">验证</NButton>
                </NSpace>
              </div>
            </div>
            <NEmpty v-else description="暂无联系人" />
          </div>

          <div class="drawer-section">
            <div class="section-title">时间线</div>
            <NTimeline v-if="timelineEvents.length">
              <NTimelineItem
                v-for="event in timelineEvents"
                :key="event.id"
                :type="getLeadTimelineItemType(event)"
                :title="formatLeadTimelineTitle(event)"
                :content="event.content || event.eventType"
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
</template>

<style scoped>
.detail-header,
.drawer-section,
.contact-main {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.detail-header {
  border-bottom: 1px solid var(--n-divider-color);
  padding-bottom: 14px;
}

.detail-title-row,
.detail-meta,
.next-action,
.contact-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.detail-title {
  color: var(--n-text-color);
  font-size: 18px;
  font-weight: 600;
}

.detail-meta,
.plain-text,
.next-action,
.contact-meta {
  color: var(--n-text-color-3);
  font-size: 13px;
}

.section-title {
  color: var(--n-text-color);
  font-weight: 600;
}

.contact-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.contact-row {
  justify-content: space-between;
  border: 1px solid var(--n-border-color);
  border-radius: 6px;
  padding: 10px;
}

.contact-name {
  color: var(--n-text-color);
  font-weight: 500;
}
</style>
