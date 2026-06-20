<script setup lang="ts">
import type { WorkbenchRecommendation } from './shared';

defineProps<{
  recommendation: WorkbenchRecommendation;
  loading: boolean;
  refreshing: boolean;
  lastUpdatedText: string;
}>();

defineEmits<{
  navigate: [target: WorkbenchRecommendation];
  refresh: [];
}>();
</script>

<template>
  <section class="workbench-header">
    <div class="workbench-header__main">
      <NAvatar round :size="48" class="workbench-header__icon">
        <SvgIcon :icon="recommendation.icon" />
      </NAvatar>
      <div class="workbench-header__copy">
        <div class="workbench-header__eyebrow">今日工作台</div>
        <h1>{{ recommendation.title }}</h1>
        <p>{{ recommendation.description }}</p>
      </div>
    </div>
    <div class="workbench-header__actions">
      <NText depth="3" class="workbench-header__updated">更新 {{ lastUpdatedText }}</NText>
      <NSpace :size="8">
        <NButton secondary :loading="refreshing" @click="$emit('refresh')">
          <template #icon>
            <SvgIcon icon="mdi:refresh" />
          </template>
        </NButton>
        <NButton type="primary" :loading="loading" @click="$emit('navigate', recommendation)">
          <template #icon>
            <SvgIcon icon="mdi:arrow-right" />
          </template>
          {{ recommendation.actionText }}
        </NButton>
      </NSpace>
    </div>
  </section>
</template>

<style scoped>
.workbench-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 20px;
  border: 1px solid rgb(226 232 240);
  border-radius: 8px;
  background: #fff;
}

.workbench-header__main {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 14px;
}

.workbench-header__icon {
  flex: 0 0 auto;
  color: #2563eb;
  background: #eff6ff;
}

.workbench-header__copy {
  min-width: 0;
}

.workbench-header__eyebrow {
  margin-bottom: 4px;
  color: #64748b;
  font-size: 13px;
}

.workbench-header h1 {
  margin: 0;
  color: #0f172a;
  font-size: 24px;
  font-weight: 650;
  line-height: 1.3;
}

.workbench-header p {
  margin: 6px 0 0;
  color: #475569;
  font-size: 14px;
  line-height: 1.5;
}

.workbench-header__actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 12px;
}

.workbench-header__updated {
  white-space: nowrap;
}

@media (max-width: 720px) {
  .workbench-header {
    align-items: stretch;
    flex-direction: column;
  }

  .workbench-header__actions {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
