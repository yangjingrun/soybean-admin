<script setup lang="ts">
import type { WorkbenchMetricCard } from './shared';

defineProps<{
  cards: WorkbenchMetricCard[];
  loading: boolean;
}>();

defineEmits<{
  navigate: [target: WorkbenchMetricCard];
}>();
</script>

<template>
  <NGrid cols="1 s:2 l:4" responsive="screen" :x-gap="16" :y-gap="16">
    <NGi v-for="card in cards" :key="card.key">
      <button class="metric-card" :class="`metric-card--${card.accent}`" type="button" @click="$emit('navigate', card)">
        <span class="metric-card__top">
          <span class="metric-card__icon">
            <SvgIcon :icon="card.icon" />
          </span>
          <span class="metric-card__title">{{ card.title }}</span>
        </span>
        <NSkeleton v-if="loading" text :repeat="2" />
        <template v-else>
          <span class="metric-card__value">{{ card.value }}</span>
          <span class="metric-card__desc">{{ card.description }}</span>
        </template>
      </button>
    </NGi>
  </NGrid>
</template>

<style scoped>
.metric-card {
  display: flex;
  align-items: flex-start;
  flex-direction: column;
  width: 100%;
  min-height: 132px;
  padding: 16px;
  border: 1px solid rgb(226 232 240);
  border-left-width: 4px;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  text-align: left;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.2s ease;
}

.metric-card:hover {
  border-color: rgb(148 163 184);
  box-shadow: 0 8px 24px rgb(15 23 42 / 8%);
  transform: translateY(-1px);
}

.metric-card__top {
  display: flex;
  align-items: center;
  width: 100%;
  min-width: 0;
  gap: 8px;
}

.metric-card__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  font-size: 18px;
}

.metric-card__title {
  overflow: hidden;
  color: #475569;
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.metric-card__value {
  margin-top: 14px;
  color: #0f172a;
  font-size: 32px;
  font-weight: 700;
  line-height: 1;
}

.metric-card__desc {
  margin-top: 12px;
  color: #64748b;
  font-size: 13px;
  line-height: 1.45;
}

.metric-card--blue {
  border-left-color: #2563eb;
}

.metric-card--blue .metric-card__icon {
  color: #2563eb;
  background: #eff6ff;
}

.metric-card--green {
  border-left-color: #059669;
}

.metric-card--green .metric-card__icon {
  color: #059669;
  background: #ecfdf5;
}

.metric-card--amber {
  border-left-color: #d97706;
}

.metric-card--amber .metric-card__icon {
  color: #d97706;
  background: #fffbeb;
}

.metric-card--red {
  border-left-color: #dc2626;
}

.metric-card--red .metric-card__icon {
  color: #dc2626;
  background: #fef2f2;
}
</style>
