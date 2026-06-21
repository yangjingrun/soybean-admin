<script setup lang="ts">
import { computed } from 'vue';
import { resolvePromptStepStatus } from './shared';

const props = defineProps<{
  steps: Api.AiGateway.AiPromptStepSummary[];
  selectedPromptKey: string;
  loading?: boolean;
}>();

const emit = defineEmits<{
  reload: [];
  select: [promptKey: string];
}>();

const displaySteps = computed(() =>
  props.steps.map(step => ({
    ...step,
    statusView: resolvePromptStepStatus(step)
  }))
);
</script>

<template>
  <NCard :bordered="false" class="card-wrapper prompt-step-panel">
    <div class="prompt-step-panel__header">
      <NText strong>内置业务步骤</NText>
      <NButton size="small" quaternary :loading="loading" @click="emit('reload')">重新加载</NButton>
    </div>

    <NScrollbar class="prompt-step-panel__scroll">
      <div class="prompt-step-list">
        <button
          v-for="step in displaySteps"
          :key="step.promptKey"
          type="button"
          class="prompt-step-row"
          :class="{ 'prompt-step-row--active': step.promptKey === selectedPromptKey }"
          @click="emit('select', step.promptKey)"
        >
          <span class="prompt-step-row__main">
            <span class="prompt-step-row__title">{{ step.title }}</span>
            <span class="prompt-step-row__key">{{ step.promptKey }}</span>
          </span>
          <span class="prompt-step-row__meta">
            <NTag size="small" :bordered="false">{{ step.channel }}</NTag>
            <NTag size="small" :type="step.statusView.type" :bordered="false">
              {{ step.statusView.label }}
            </NTag>
          </span>
        </button>
      </div>
    </NScrollbar>
  </NCard>
</template>

<style scoped>
.prompt-step-panel {
  height: 100%;
}

.prompt-step-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.prompt-step-panel__scroll {
  max-height: calc(100vh - 260px);
}

.prompt-step-list {
  display: grid;
  gap: 4px;
}

.prompt-step-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 12px;
  border: 1px solid transparent;
  border-radius: 8px;
  color: var(--n-text-color);
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition:
    background-color 0.2s,
    border-color 0.2s;
}

.prompt-step-row:hover,
.prompt-step-row--active {
  border-color: var(--n-primary-color);
  background: var(--n-primary-color-suppl);
}

.prompt-step-row__main {
  display: grid;
  min-width: 0;
  gap: 4px;
}

.prompt-step-row__title {
  font-weight: 600;
}

.prompt-step-row__key {
  overflow: hidden;
  color: var(--n-text-color-3);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.prompt-step-row__meta {
  display: flex;
  align-items: center;
  gap: 6px;
}
</style>
