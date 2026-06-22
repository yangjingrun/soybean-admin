<script setup lang="ts">
import { computed } from 'vue';
import {
  buildAssistantRecommendationReason,
  getAssistantLeadAction,
  type AssistantQueueKey,
  type AssistantQueueView
} from './shared';
import { formatLeadDate, leadStatusLabelMap, leadStatusTagTypeMap } from '@/views/crm/leads/modules/shared';

const props = defineProps<{
  queueViews: AssistantQueueView[];
  activeQueueKey: AssistantQueueKey;
  loading?: boolean;
}>();

const emit = defineEmits<{
  'update:activeQueueKey': [key: AssistantQueueKey];
  view: [record: Api.Crm.LeadRecord];
  startFollowUp: [record: Api.Crm.LeadRecord];
  archive: [record: Api.Crm.LeadRecord];
  restore: [record: Api.Crm.LeadRecord];
  goInbox: [record: Api.Crm.LeadRecord];
}>();

const activeQueueView = computed(
  () => props.queueViews.find(view => view.key === props.activeQueueKey) ?? props.queueViews[0]
);

/** Keep tab updates typed to the assistant queue keys owned by shared.ts. */
function handleTabUpdate(value: string | number) {
  emit('update:activeQueueKey', value as AssistantQueueKey);
}

/** Surface one primary customer action based on the CRM account status. */
function handlePrimaryAction(record: Api.Crm.LeadRecord) {
  if (record.status === 'ready') {
    emit('startFollowUp', record);
    return;
  }

  if (record.status === 'archived') {
    emit('restore', record);
    return;
  }

  if (record.status === 'replied_pending') {
    emit('goInbox', record);
    return;
  }

  emit('view', record);
}

function getPrimaryActionLabel(record: Api.Crm.LeadRecord) {
  if (record.status === 'ready') return '开始跟进';
  if (record.status === 'archived') return '恢复';
  if (record.status === 'replied_pending') return '处理回复';

  return '详情';
}
</script>

<template>
  <NCard :bordered="false" size="small" class="card-wrapper" title="客户队列">
    <NSpin :show="loading">
      <NSpace vertical :size="12">
        <NTabs :value="activeQueueKey" type="line" animated @update:value="handleTabUpdate">
          <NTabPane v-for="view in queueViews" :key="view.key" :name="view.key">
            <template #tab>
              <span>{{ view.label }}</span>
              <NBadge :value="view.records.length" :max="99" type="default" class="queue-tab-badge" />
            </template>
          </NTabPane>
        </NTabs>

        <div v-if="activeQueueView" class="queue-description">
          {{ activeQueueView.description }}
        </div>

        <div v-if="activeQueueView?.records.length" class="customer-list">
          <div v-for="record in activeQueueView.records" :key="record.id" class="customer-item">
            <div class="customer-main">
              <div class="customer-title-row">
                <span class="customer-name">{{ record.name }}</span>
                <NTag :bordered="false" size="small" :type="leadStatusTagTypeMap[record.status]">
                  {{ leadStatusLabelMap[record.status] }}
                </NTag>
              </div>

              <div class="customer-meta">
                <span>{{ record.country || '国家未填' }}</span>
                <span>{{ record.customerType || '类型未填' }}</span>
                <span>{{ record.domain || '域名未填' }}</span>
              </div>

              <div class="customer-reason">{{ buildAssistantRecommendationReason(record) }}</div>

              <div class="customer-action-text">
                <NTag :bordered="false" size="small" :type="getAssistantLeadAction(record.status).type">
                  {{ getAssistantLeadAction(record.status).label }}
                </NTag>
                <span>{{ getAssistantLeadAction(record.status).description }}</span>
              </div>
            </div>

            <div class="customer-operate">
              <span class="updated-time">{{ formatLeadDate(record.updatedAt) }}</span>
              <NSpace :size="8" justify="end">
                <NButton size="small" type="primary" secondary @click="handlePrimaryAction(record)">
                  {{ getPrimaryActionLabel(record) }}
                </NButton>
                <NButton
                  v-if="record.status === 'ready'"
                  size="small"
                  type="warning"
                  secondary
                  @click="emit('archive', record)"
                >
                  暂不开发
                </NButton>
              </NSpace>
            </div>
          </div>
        </div>

        <NEmpty v-else description="当前队列暂无客户" />
      </NSpace>
    </NSpin>
  </NCard>
</template>

<style scoped>
.queue-tab-badge {
  margin-left: 6px;
}

.queue-description,
.customer-meta,
.customer-reason,
.customer-action-text,
.updated-time {
  color: var(--n-text-color-3);
  font-size: 13px;
}

.customer-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.customer-item {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  border: 1px solid var(--n-border-color);
  border-radius: 6px;
  padding: 12px;
}

.customer-main {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 7px;
}

.customer-title-row,
.customer-action-text {
  display: flex;
  align-items: center;
  gap: 8px;
}

.customer-name {
  overflow: hidden;
  color: var(--n-text-color);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.customer-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.customer-operate {
  display: flex;
  min-width: 160px;
  flex-direction: column;
  align-items: flex-end;
  justify-content: space-between;
  gap: 10px;
}

@media (max-width: 720px) {
  .customer-item {
    flex-direction: column;
  }

  .customer-operate {
    min-width: 0;
    align-items: flex-start;
  }
}
</style>
