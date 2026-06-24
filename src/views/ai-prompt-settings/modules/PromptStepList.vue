<script setup lang="ts">
import { computed } from 'vue';
import { groupPromptWorkbenchSteps, resolvePromptStepStatus } from './shared';

const props = defineProps<{
  steps: Api.AiGateway.AiPromptStepSummary[];
  selectedPromptKey: string;
  loading?: boolean;
}>();

const emit = defineEmits<{
  reload: [];
  select: [promptKey: string];
}>();

const groupedSteps = computed(() =>
  groupPromptWorkbenchSteps(props.steps).map(group => ({
    ...group,
    steps: group.steps.map(step => ({
      ...step,
      statusView: resolvePromptStepStatus(step)
    }))
  }))
);
const stepCount = computed(() => props.steps.length);
</script>

<template>
  <NCard :bordered="false" class="card-wrapper prompt-step-panel">
    <div class="prompt-step-panel__header">
      <div>
        <NText strong>内置业务步骤</NText>
        <p class="prompt-step-panel__subtitle">{{ stepCount }} 个提示词节点</p>
      </div>
      <NButton size="tiny" quaternary :loading="loading" @click="emit('reload')">刷新</NButton>
    </div>

    <NScrollbar class="prompt-step-panel__scroll">
      <div class="prompt-step-list">
        <div v-for="group in groupedSteps" :key="group.key" class="prompt-step-group">
          <div class="prompt-step-group__title">{{ group.title }}</div>
          <button
            v-for="step in group.steps"
            :key="step.promptKey"
            type="button"
            class="prompt-step-row"
            :class="{ 'prompt-step-row--active': step.promptKey === selectedPromptKey }"
            @click="emit('select', step.promptKey)"
          >
            <span class="prompt-step-row__marker" />
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
      </div>
    </NScrollbar>
  </NCard>
</template>

<style scoped>
.prompt-step-panel {
  height: calc(100vh - 168px);
  overflow: hidden;
}

.prompt-step-panel :deep(.n-card__content) {
  display: flex;
  box-sizing: border-box;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
}

.prompt-step-panel__header {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.prompt-step-panel__subtitle {
  margin: 3px 0 0;
  color: var(--prompt-workbench-subtle);
  font-size: 12px;
  line-height: 1.4;
}

.prompt-step-panel__scroll {
  height: 100%;
  min-height: 0;
  flex: 1;
}

.prompt-step-list {
  display: grid;
  gap: 12px;
}

.prompt-step-group {
  display: grid;
  gap: 6px;
}

.prompt-step-group__title {
  padding: 2px 4px;
  color: var(--prompt-workbench-subtle);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.4;
}

.prompt-step-row {
  display: grid;
  grid-template-columns: 3px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 8px 10px 0;
  border: 1px solid transparent;
  border-radius: 6px;
  color: var(--n-text-color);
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition:
    background-color 0.2s,
    border-color 0.2s;
}

.prompt-step-row:hover {
  background: var(--prompt-workbench-muted);
}

.prompt-step-row--active {
  border-color: rgba(var(--primary-color), 0.28);
  background: rgb(var(--primary-50-color));
}

.prompt-step-row__marker {
  align-self: stretch;
  border-radius: 999px;
  background: transparent;
}

.prompt-step-row--active .prompt-step-row__marker {
  background: var(--prompt-workbench-primary);
}

.prompt-step-row__main {
  display: grid;
  min-width: 0;
  gap: 4px;
}

.prompt-step-row__title {
  color: var(--prompt-workbench-ink);
  font-weight: 600;
  line-height: 1.35;
}

.prompt-step-row__key {
  overflow: hidden;
  color: var(--prompt-workbench-subtle);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.prompt-step-row__meta {
  grid-column: 2;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 6px;
  min-width: 0;
}

@media (max-width: 1280px) {
  .prompt-step-panel {
    height: auto;
    overflow: visible;
  }

  .prompt-step-panel :deep(.n-card__content) {
    display: block;
    height: auto;
    overflow: visible;
  }

  .prompt-step-panel__scroll {
    height: auto;
    min-height: auto;
  }
}
</style>
