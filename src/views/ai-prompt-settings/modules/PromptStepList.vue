<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue';
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

const filterKeyword = ref('');
const normalizedFilterKeyword = computed(() => filterKeyword.value.trim().toLowerCase());
const groupedSteps = computed(() =>
  groupPromptWorkbenchSteps(props.steps)
    .map(group => {
      const treeNodes = group.treeNodes
        .map(node => ({
          ...node,
          steps: node.steps
            .filter(step => isStepMatched(step, group.title, node.title))
            .map(step => ({
              ...step,
              displayTitle: formatStepTreeTitle(step),
              statusView: resolvePromptStepStatus(step)
            }))
        }))
        .filter(node => node.steps.length > 0);

      return {
        ...group,
        steps: treeNodes.flatMap(node => node.steps),
        treeNodes
      };
    })
    .filter(group => group.steps.length > 0)
);
const stepCount = computed(() => props.steps.length);
const visibleStepCount = computed(() => groupedSteps.value.reduce((total, group) => total + group.steps.length, 0));
const stepCountLabel = computed(() =>
  normalizedFilterKeyword.value
    ? `${visibleStepCount.value} / ${stepCount.value} 个提示词节点`
    : `${stepCount.value} 个提示词节点`
);
const expandedGroups = shallowRef<string[]>([]);
const expandedNodes = shallowRef<string[]>([]);

watch(
  groupedSteps,
  groups => {
    expandedGroups.value = groups.map(group => group.key);
    expandedNodes.value = groups.flatMap(group => group.treeNodes.map(node => node.key));
  },
  { immediate: true }
);

function formatStepTreeTitle(step: Api.AiGateway.AiPromptStepSummary) {
  return step.promptKey.startsWith('crm_outreach_general_step_') ? step.title.replace(/^通用模板/, '') : step.title;
}

function isStepMatched(step: Api.AiGateway.AiPromptStepSummary, groupTitle: string, nodeTitle: string) {
  const keyword = normalizedFilterKeyword.value;

  if (!keyword) {
    return true;
  }

  return [step.title, step.promptKey, step.usage, step.channel, groupTitle, nodeTitle].some(value =>
    value.toLowerCase().includes(keyword)
  );
}
</script>

<template>
  <NCard :bordered="false" class="card-wrapper prompt-step-panel" content-class="prompt-step-panel__content">
    <div class="prompt-step-panel__header">
      <div>
        <NText strong>提示词配置树</NText>
        <p class="prompt-step-panel__subtitle">{{ stepCountLabel }}</p>
      </div>
      <NButton size="tiny" quaternary :loading="loading" @click="emit('reload')">刷新</NButton>
    </div>

    <NInput
      v-model:value="filterKeyword"
      class="prompt-step-panel__filter"
      size="small"
      clearable
      placeholder="筛选提示词 / promptKey"
    >
      <template #prefix>
        <SvgIcon icon="material-symbols:filter-list-rounded" />
      </template>
    </NInput>

    <NScrollbar class="prompt-step-panel__scroll">
      <div class="prompt-step-list">
        <NEmpty v-if="groupedSteps.length === 0" size="small" description="没有匹配的提示词" />

        <NCollapse v-else v-model:expanded-names="expandedGroups" arrow-placement="right">
          <NCollapseItem v-for="group in groupedSteps" :key="group.key" :title="group.title" :name="group.key">
            <NCollapse v-model:expanded-names="expandedNodes" arrow-placement="right" class="prompt-step-node-collapse">
              <NCollapseItem v-for="node in group.treeNodes" :key="node.key" :title="node.title" :name="node.key">
                <button
                  v-for="step in node.steps"
                  :key="step.promptKey"
                  type="button"
                  class="prompt-step-row"
                  :class="{ 'prompt-step-row--active': step.promptKey === selectedPromptKey }"
                  @click="emit('select', step.promptKey)"
                >
                  <span class="prompt-step-row__marker" />
                  <span class="prompt-step-row__main">
                    <span class="prompt-step-row__title">{{ step.displayTitle }}</span>
                    <span class="prompt-step-row__key">{{ step.promptKey }}</span>
                  </span>
                  <span class="prompt-step-row__meta">
                    <NTag size="small" :bordered="false">{{ step.channel }}</NTag>
                    <NTag size="small" :type="step.statusView.type" :bordered="false">
                      {{ step.statusView.label }}
                    </NTag>
                  </span>
                </button>
              </NCollapseItem>
            </NCollapse>
          </NCollapseItem>
        </NCollapse>
      </div>
    </NScrollbar>
  </NCard>
</template>

<style scoped>
.prompt-step-panel {
  height: 100%;
  max-height: 100%;
  overflow: hidden;
}

.prompt-step-panel :deep(.prompt-step-panel__content) {
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

.prompt-step-panel__filter {
  flex: none;
  margin-bottom: 12px;
}

.prompt-step-panel__scroll {
  height: 100%;
  max-height: 100%;
  min-height: 0;
  flex: 1;
  overflow: hidden;
}

.prompt-step-panel__scroll :deep(.n-scrollbar-container) {
  height: 100%;
  max-height: 100%;
}

.prompt-step-list {
  display: grid;
  gap: 12px;
}

.prompt-step-list :deep(.n-collapse .n-collapse-item) {
  margin: 0;
}

.prompt-step-list :deep(.n-collapse-item__header) {
  padding: 6px 2px;
}

.prompt-step-list :deep(.n-collapse-item__header-main) {
  color: var(--prompt-workbench-ink);
  font-size: 13px;
  font-weight: 700;
}

.prompt-step-list :deep(.n-collapse-item__content-inner) {
  padding: 4px 0 6px;
}

.prompt-step-node-collapse {
  padding-left: 8px;
  border-left: 1px solid var(--prompt-workbench-border);
}

.prompt-step-node-collapse :deep(.n-collapse-item__header-main) {
  color: var(--prompt-workbench-subtle);
  font-size: 12px;
  font-weight: 700;
}

.prompt-step-row {
  display: grid;
  grid-template-columns: 3px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  width: 100%;
  margin: 4px 0;
  padding: 10px 8px 10px 10px;
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
    max-height: none;
    overflow: visible;
  }

  .prompt-step-panel :deep(.prompt-step-panel__content) {
    display: block;
    height: auto;
    overflow: visible;
  }

  .prompt-step-panel__scroll {
    height: auto;
    min-height: auto;
  }

  .prompt-step-panel__scroll :deep(.n-scrollbar-container) {
    height: auto;
    max-height: none;
  }
}
</style>
