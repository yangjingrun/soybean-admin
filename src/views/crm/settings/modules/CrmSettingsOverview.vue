<script setup lang="ts">
import type { CrmSettingsOverviewItem, CrmSettingsOverviewKey } from './shared';

defineProps<{
  items: CrmSettingsOverviewItem[];
  loading?: boolean;
}>();

const iconMap: Record<CrmSettingsOverviewKey, string> = {
  mailboxConnection: 'material-symbols:alternate-email-rounded',
  sendPace: 'material-symbols:send-outline-rounded',
  syncHealth: 'material-symbols:sync-problem-rounded',
  writingProfile: 'material-symbols:contract-edit-outline-rounded'
};
</script>

<template>
  <NSpin :show="loading">
    <NGrid responsive="screen" :x-gap="12" :y-gap="12" cols="1 s:2 l:4">
      <NGi v-for="item in items" :key="item.key">
        <NCard :bordered="false" size="small" class="card-wrapper overview-card">
          <div class="overview-card-header">
            <div class="overview-title">
              <div class="overview-icon">
                <SvgIcon :icon="iconMap[item.key]" />
              </div>
              <NText strong class="overview-label">{{ item.label }}</NText>
            </div>
            <NTag :bordered="false" size="small" :type="item.tagType">{{ item.statusLabel }}</NTag>
          </div>

          <div class="overview-value">{{ item.value }}</div>
          <NText depth="3" class="overview-desc">{{ item.description }}</NText>
        </NCard>
      </NGi>
    </NGrid>
  </NSpin>
</template>

<style scoped>
.overview-card {
  min-height: 128px;
}

.overview-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.overview-title {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
}

.overview-icon {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  color: var(--n-primary-color);
  background: color-mix(in srgb, var(--n-primary-color) 10%, transparent);
  font-size: 16px;
}

.overview-label {
  min-width: 0;
  font-size: 14px;
  line-height: 1.3;
}

.overview-value {
  margin-top: 16px;
  color: var(--n-text-color);
  font-size: 22px;
  font-weight: 700;
  line-height: 1.2;
}

.overview-desc {
  display: block;
  margin-top: 8px;
  font-size: 12px;
  line-height: 1.5;
}
</style>
