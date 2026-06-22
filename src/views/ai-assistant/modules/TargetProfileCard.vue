<script setup lang="ts">
import { computed } from 'vue';
import type { AssistantCapacitySummary } from './shared';

const props = defineProps<{
  capacitySummary: AssistantCapacitySummary;
  sendPreference: Api.Crm.SendPreference | null;
  loading?: boolean;
}>();

const emit = defineEmits<{
  refresh: [];
  goCrmLeads: [];
  goSequences: [];
}>();

const quotaItems = computed(() => [
  {
    key: 'dailyLimit',
    label: '每日上限',
    value: props.capacitySummary.dailyLimit
  },
  {
    key: 'recommended',
    label: '今日推荐',
    value: props.capacitySummary.recommendedCount
  },
  {
    key: 'following',
    label: '跟进中',
    value: props.capacitySummary.followingCount
  },
  {
    key: 'replied',
    label: '有回复',
    value: props.capacitySummary.repliedCount
  },
  {
    key: 'needsData',
    label: '待补全',
    value: props.capacitySummary.needsDataCount
  }
]);
</script>

<template>
  <NCard :bordered="false" size="small" class="card-wrapper">
    <NSpin :show="loading">
      <div class="target-profile">
        <div class="target-main">
          <div>
            <div class="target-title">AI 开发助手</div>
            <div class="target-desc">目标：每天挑出少量可开发客户，人工确认后进入开发信跟进。</div>
          </div>

          <NSpace :size="8">
            <NButton size="small" :loading="loading" @click="emit('refresh')">刷新</NButton>
            <NButton size="small" @click="emit('goCrmLeads')">客户库</NButton>
            <NButton size="small" type="primary" @click="emit('goSequences')">跟进</NButton>
          </NSpace>
        </div>

        <NGrid :cols="24" :x-gap="8" :y-gap="8" responsive="screen">
          <NGi v-for="item in quotaItems" :key="item.key" span="24 s:12 m:6 l:4">
            <div class="quota-item">
              <span class="quota-label">{{ item.label }}</span>
              <span class="quota-value">{{ item.value }}</span>
            </div>
          </NGi>
        </NGrid>

        <div class="preference-line">
          <span>跟进信占比 {{ sendPreference ? `${sendPreference.followUpSharePercent}%` : '-' }}</span>
          <span>组织上限 {{ sendPreference?.ownerDailySendLimitMax ?? '-' }}</span>
        </div>
      </div>
    </NSpin>
  </NCard>
</template>

<style scoped>
.target-profile {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.target-main {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.target-title {
  color: var(--n-text-color);
  font-size: 18px;
  font-weight: 600;
}

.target-desc,
.preference-line,
.quota-label {
  color: var(--n-text-color-3);
  font-size: 13px;
}

.quota-item {
  display: flex;
  min-height: 58px;
  flex-direction: column;
  justify-content: center;
  border: 1px solid var(--n-border-color);
  border-radius: 6px;
  padding: 8px 10px;
}

.quota-value {
  color: var(--n-text-color);
  font-size: 20px;
  font-weight: 600;
  line-height: 1.25;
}

.preference-line {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
</style>
