<script setup lang="ts">
import type { CrmSettingsOverviewItem, CrmSettingsOverviewKey } from './shared';

defineProps<{
  activeKey: CrmSettingsOverviewKey;
  items: CrmSettingsOverviewItem[];
  loading?: boolean;
}>();

const emit = defineEmits<{
  select: [key: CrmSettingsOverviewKey];
}>();

const iconMap: Record<CrmSettingsOverviewKey, string> = {
  mailboxConnection: 'material-symbols:alternate-email-rounded',
  safetyBlock: 'material-symbols:shield-lock-outline-rounded',
  sendPace: 'material-symbols:send-outline-rounded',
  syncHealth: 'material-symbols:sync-problem-rounded',
  writingProfile: 'material-symbols:contract-edit-outline-rounded'
};

/** Emits the selected settings entry so the page keeps a single navigation source. */
function handleSelect(key: CrmSettingsOverviewKey) {
  emit('select', key);
}
</script>

<template>
  <NSpin :show="loading">
    <NGrid responsive="screen" :x-gap="12" :y-gap="12" cols="1 s:2 l:5">
      <NGi v-for="item in items" :key="item.key">
        <button
          type="button"
          class="card-wrapper overview-card"
          :class="{ 'overview-card--active': activeKey === item.key }"
          :aria-pressed="activeKey === item.key"
          @click="handleSelect(item.key)"
        >
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
        </button>
      </NGi>
    </NGrid>
  </NSpin>
</template>

<style scoped>
.overview-card {
  width: 100%;
  min-height: 128px;
  padding: 14px 16px;
  border: 1px solid transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  outline: none;
  appearance: none;
  transition:
    border-color 0.2s var(--n-bezier),
    box-shadow 0.2s var(--n-bezier),
    transform 0.2s var(--n-bezier);
}

.overview-card:hover {
  border-color: var(--n-border-color);
  transform: translateY(-1px);
}

.overview-card.overview-card--active {
  border-color: rgb(var(--primary-color, 100 108 255));
  box-shadow:
    0 0 0 1px rgb(var(--primary-color, 100 108 255)),
    0 8px 18px rgb(var(--primary-color, 100 108 255) / 0.12);
}

.overview-card.overview-card--active .overview-label,
.overview-card.overview-card--active .overview-value {
  color: rgb(var(--primary-color, 100 108 255));
}

.overview-card:focus-visible {
  outline: 2px solid rgb(var(--primary-color, 100 108 255));
  outline-offset: 2px;
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
