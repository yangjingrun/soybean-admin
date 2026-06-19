<script setup lang="ts">
import type { CrmSettingsOverviewItem, CrmSettingsOverviewKey } from './shared';

defineProps<{
  items: CrmSettingsOverviewItem[];
  loading?: boolean;
}>();

const iconMap: Record<CrmSettingsOverviewKey, string> = {
  attention: 'material-symbols:warning-outline-rounded',
  mailbox: 'material-symbols:alternate-email-rounded',
  sendRule: 'material-symbols:send-outline-rounded',
  template: 'material-symbols:contract-edit-outline-rounded'
};
</script>

<template>
  <NSpin :show="loading">
    <NGrid responsive="screen" :x-gap="12" :y-gap="12" cols="1 s:2 l:4">
      <NGi v-for="item in items" :key="item.key">
        <NCard :bordered="false" size="small" class="card-wrapper overview-card">
          <div class="overview-card-header">
            <div class="overview-icon">
              <SvgIcon :icon="iconMap[item.key]" />
            </div>
            <NTag :bordered="false" size="small" :type="item.tagType">{{ item.label }}</NTag>
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
  min-height: 132px;
}

.overview-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.overview-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  color: var(--n-primary-color);
  background: color-mix(in srgb, var(--n-primary-color) 10%, transparent);
  font-size: 18px;
}

.overview-value {
  margin-top: 18px;
  color: var(--n-text-color);
  font-size: 24px;
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
