<script setup lang="ts">
import { computed, nextTick, shallowRef, useTemplateRef } from 'vue';
import dayjs from 'dayjs';
import KeywordHistoryDrawer from './modules/KeywordHistoryDrawer.vue';
import KeywordOptimizationResult from './modules/KeywordOptimizationResult.vue';
import SearchProgressPanel from './modules/SearchProgressPanel.vue';
import { useAiLeadPage } from './modules/useAiLeadPage';

const {
  aiFinishReasonLabel,
  aiResult,
  canGenerate,
  canManageKeywordStrategy,
  canReturnToKeywordStep,
  canSaveHistory,
  canSearchCustomers,
  currentHistoryRecord,
  currentSearchTask,
  currentSearchTaskStatusLabel,
  currentSearchTaskStatusType,
  currentWorkflowStepLabel,
  deletingKeywordHistoryId,
  editableKeywordPlan,
  form,
  handleCancelEdit,
  handleClear,
  handleCopyResult,
  handleDeleteCurrentHistory,
  handleDeleteHistory,
  handleGenerate,
  handleProcessCollectedLeads,
  handleReturnToKeywordOptimization,
  handleSaveHistory,
  handleSearchCustomers,
  handleSearchTaskAction,
  handleSelectHistory,
  handleStartEdit,
  handleTargetLeadCountUpdate,
  hasSearchProgress,
  historyRecords,
  isEditingResult,
  isGenerating,
  isHistoryDeleting,
  isHistoryDrawerVisible,
  isHistoryLoading,
  isHistorySaving,
  isRestoredKeywordHistory,
  isSearchTaskActionLoading,
  isSearchTaskBlockingForm,
  isSearchTaskPending,
  isSearchTaskSubmitting,
  isSearching,
  keywordOptimizationViewModel,
  keywordQualityWarnings,
  searchProgress,
  searchTaskActionState,
  selectedHistoryId,
  targetLeadCountFeedback
} = useAiLeadPage();

type WorkflowStepState = 'wait' | 'active' | 'completed' | 'warning' | 'error';
type TaskActionButton = {
  key: 'resume' | 'retry';
  label: string;
  type: 'primary';
  visible: boolean;
};

const debugFooterRef = useTemplateRef<HTMLElement>('debugFooter');
const debugExpandedNames = shallowRef<Array<string | number>>([]);
const isHistoryGenerateConfirmVisible = shallowRef(false);

const isGenerateDisabled = computed(
  () =>
    !canGenerate.value ||
    isSearching.value ||
    isSearchTaskActionLoading.value ||
    isHistorySaving.value ||
    isHistoryDeleting.value ||
    isSearchTaskBlockingForm.value
);

const isClearDisabled = computed(
  () =>
    isGenerating.value ||
    isSearching.value ||
    isSearchTaskActionLoading.value ||
    isHistorySaving.value ||
    isHistoryDeleting.value ||
    isSearchTaskBlockingForm.value
);

const hasCompletedSearchTask = computed(() => currentSearchTask.value?.status === 'completed');
const isPrimarySearchInterruptAction = computed(() => searchTaskActionState.value.canInterrupt);
const searchButtonLabel = computed(() =>
  isPrimarySearchInterruptAction.value ? '中断' : hasCompletedSearchTask.value ? '继续采集更多' : '开始获客'
);
const searchPrimaryButtonType = computed(() => (isPrimarySearchInterruptAction.value ? 'error' : 'primary'));
const searchPrimaryButtonLoading = computed(() =>
  isPrimarySearchInterruptAction.value ? isSearchTaskActionLoading.value : isSearchTaskSubmitting.value
);
const debugFooterClass = computed(() => ({ 'is-editing-focus': isEditingResult.value }));
const isSearchPrimaryButtonDisabled = computed(() =>
  isPrimarySearchInterruptAction.value
    ? isHistorySaving.value || isHistoryDeleting.value
    : !canSearchCustomers.value || isHistorySaving.value || isHistoryDeleting.value
);
const clearButtonLabel = computed(() => (hasCompletedSearchTask.value ? '开始新任务' : '清空'));
const selectedHistoryUpdatedAtLabel = computed(() =>
  currentHistoryRecord.value ? dayjs(currentHistoryRecord.value.updatedAt).format('YYYY-MM-DD HH:mm') : ''
);
const keywordReadyResultTitle = computed(() =>
  isRestoredKeywordHistory.value ? '历史搜索策略已选中' : '搜索策略已准备好'
);
const keywordReadyResultDescription = computed(() =>
  isRestoredKeywordHistory.value
    ? '可以直接开始获客；如需按当前需求生成新策略，请点击重新优化。'
    : '点击开始获客，系统会直接返回候选客户。'
);

function handlePrimarySearchAction() {
  if (isPrimarySearchInterruptAction.value) {
    return handleSearchTaskAction('interrupt');
  }

  return handleSearchCustomers();
}

/** Closes the history confirm popup before the generate flow switches page state. */
async function handleConfirmGenerateFromHistory() {
  isHistoryGenerateConfirmVisible.value = false;
  await nextTick();
  await handleGenerate();
}

/**
 * Enters keyword plan edit mode and guides the user to the editable debug panel.
 */
async function handleStartKeywordResultEdit() {
  handleStartEdit();
  debugExpandedNames.value = ['debug'];

  await nextTick();
  debugFooterRef.value?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

const workflowSteps = computed(() => {
  const hasRequirement = Boolean(form.requirement.trim());
  const hasKeywordPlan = Boolean(keywordOptimizationViewModel.value);
  const taskStatus = currentSearchTask.value?.status;
  const searchStatus = searchProgress.value.status;
  const hasCompletedSearch = searchStatus === 'completed' || taskStatus === 'completed';
  const hasFailedSearch = searchStatus === 'failed' || taskStatus === 'failed';
  const hasInterruptedSearch = searchStatus === 'interrupted' || taskStatus === 'interrupted';
  const hasStartedSearch = hasSearchProgress.value || isSearching.value;

  return [
    {
      key: 'requirement',
      title: '描述需求',
      description: hasRequirement ? '已填写目标客户描述' : '输入产品、地区和客户类型',
      state: hasRequirement ? 'completed' : 'active'
    },
    {
      key: 'keyword',
      title: 'AI 准备',
      description: isRestoredKeywordHistory.value
        ? '已选中历史搜索策略'
        : hasKeywordPlan
          ? '搜索策略已准备好'
          : '先让 AI 归纳搜索方向',
      state: hasKeywordPlan ? 'completed' : hasRequirement ? 'active' : 'wait'
    },
    {
      key: 'search',
      title: '搜索采集',
      description: currentSearchTask.value ? currentSearchTaskStatusLabel.value : '创建后台采集任务',
      state: hasFailedSearch
        ? 'error'
        : hasInterruptedSearch
          ? 'warning'
          : hasCompletedSearch
            ? 'completed'
            : hasStartedSearch
              ? 'active'
              : 'wait'
    }
  ] satisfies Array<{
    key: string;
    title: string;
    description: string;
    state: WorkflowStepState;
  }>;
});

const taskActionButtons = computed(
  () =>
    [
      { key: 'resume', label: '继续', type: 'primary', visible: searchTaskActionState.value.canResume },
      { key: 'retry', label: '重试', type: 'primary', visible: searchTaskActionState.value.canRetry }
    ].filter(item => item.visible) as TaskActionButton[]
);
</script>

<template>
  <NSpace vertical :size="12" class="ai-leads-page">
    <NCard :bordered="false" size="small" class="card-wrapper task-card">
      <NForm :model="form" label-placement="top" size="small" class="lead-form">
        <NFormItem label="获客需求">
          <NInput
            v-model:value="form.requirement"
            type="textarea"
            :disabled="isSearchTaskBlockingForm"
            :autosize="{ minRows: 2, maxRows: 6 }"
            placeholder="描述产品、地区、目标市场、客户类型和产品优势。例如：我是中国河北卖轴承的，主打 6204 bearing，想找沙特阿拉伯进口商和经销商，产品优势是供货稳定、价格有竞争力。"
          />
        </NFormItem>

        <div class="task-toolbar">
          <div class="task-toolbar-left">
            <div class="lead-source-mode">
              <span class="lead-count-label">获客模式</span>
              <NRadioGroup
                v-model:value="form.leadSourceMode"
                size="small"
                :disabled="isSearchTaskBlockingForm"
                name="lead-source-mode"
              >
                <NRadioButton value="search">官网获客</NRadioButton>
                <NRadioButton value="maps">地图获客</NRadioButton>
              </NRadioGroup>
            </div>
            <div class="lead-count-compact">
              <span class="lead-count-label">
                采集数量
                <span class="required-mark">*</span>
              </span>
              <NInputNumber
                :value="form.targetLeadCount"
                class="lead-count-input"
                placeholder="20"
                :min="1"
                :max="200"
                :precision="0"
                :disabled="isSearchTaskBlockingForm"
                @update:value="handleTargetLeadCountUpdate"
              />
              <NText v-if="targetLeadCountFeedback" type="error" class="lead-count-feedback">
                {{ targetLeadCountFeedback }}
              </NText>
            </div>
            <NTag size="small" type="info" :bordered="false">{{ currentWorkflowStepLabel }}</NTag>
            <NTag v-if="currentSearchTask" size="small" :type="currentSearchTaskStatusType" :bordered="false">
              {{ currentSearchTaskStatusLabel }}
            </NTag>
          </div>

          <NSpace :size="8" class="task-toolbar-actions">
            <NButton
              size="small"
              secondary
              :loading="isHistoryLoading"
              :disabled="isSearchTaskBlockingForm"
              @click="isHistoryDrawerVisible = true"
            >
              <template #icon>
                <SvgIcon icon="material-symbols:history" />
              </template>
              历史
            </NButton>
            <NPopconfirm
              v-if="isRestoredKeywordHistory"
              :show="isHistoryGenerateConfirmVisible"
              @update:show="isHistoryGenerateConfirmVisible = $event"
              @positive-click="handleConfirmGenerateFromHistory"
            >
              <template #trigger>
                <NButton
                  size="small"
                  :loading="isGenerating"
                  :disabled="isGenerateDisabled"
                  data-action="generate"
                  @click="isHistoryGenerateConfirmVisible = true"
                >
                  重新优化
                </NButton>
              </template>
              当前选中的是历史记录。重新优化会按上方需求生成新的搜索策略，并切换到新历史，确认继续？
            </NPopconfirm>
            <NButton
              v-else
              size="small"
              :loading="isGenerating"
              :disabled="isGenerateDisabled"
              data-action="generate"
              @click="handleGenerate"
            >
              优化关键词
            </NButton>
            <NButton
              size="small"
              :type="searchPrimaryButtonType"
              :loading="searchPrimaryButtonLoading"
              :disabled="isSearchPrimaryButtonDisabled"
              @click="handlePrimarySearchAction"
            >
              {{ searchButtonLabel }}
            </NButton>
            <NButton size="small" :disabled="isClearDisabled" @click="handleClear">{{ clearButtonLabel }}</NButton>
            <NButton
              v-for="item in taskActionButtons"
              :key="item.key"
              size="small"
              secondary
              :type="item.type"
              :loading="isSearchTaskActionLoading"
              :disabled="isHistorySaving || isHistoryDeleting"
              @click="handleSearchTaskAction(item.key)"
            >
              {{ item.label }}
            </NButton>
            <NPopconfirm v-if="searchTaskActionState.canDiscard" @positive-click="handleSearchTaskAction('discard')">
              <template #trigger>
                <NButton
                  size="small"
                  type="error"
                  secondary
                  :loading="isSearchTaskActionLoading"
                  :disabled="isHistorySaving || isHistoryDeleting"
                >
                  放弃
                </NButton>
              </template>
              放弃后该采集任务将不再恢复，确认放弃？
            </NPopconfirm>
          </NSpace>
        </div>
        <NAlert v-if="isRestoredKeywordHistory" type="info" :bordered="false" class="history-context-alert">
          <template #header>已选中关键词历史</template>
          当前展示的是
          {{ selectedHistoryUpdatedAtLabel }} 保存的搜索策略。可以直接开始获客；重新优化会生成一条新的历史。
        </NAlert>
      </NForm>
    </NCard>

    <NCard :bordered="false" size="small" class="card-wrapper workflow-card">
      <div class="workflow-strip">
        <div v-for="step in workflowSteps" :key="step.key" class="workflow-step" :class="`is-${step.state}`">
          <span class="workflow-dot" />
          <div class="workflow-step-copy">
            <span class="workflow-step-title">{{ step.title }}</span>
            <span class="workflow-step-description">{{ step.description }}</span>
          </div>
        </div>
      </div>
    </NCard>

    <NCard :bordered="false" size="small" class="card-wrapper result-card" content-class="result-card-content">
      <template #header>
        <div class="section-header">
          <div class="section-heading">
            <span class="section-title">工作结果</span>
            <NTag v-if="aiResult && aiFinishReasonLabel" size="small" type="success" :bordered="false">
              {{ aiFinishReasonLabel }}
            </NTag>
          </div>
          <NSpace :size="8" class="result-actions">
            <NButton
              v-if="canReturnToKeywordStep"
              size="small"
              secondary
              :disabled="isHistorySaving || isHistoryDeleting"
              @click="handleReturnToKeywordOptimization"
            >
              <template #icon>
                <SvgIcon icon="material-symbols:keyboard-return" />
              </template>
              调整需求
            </NButton>
            <template v-if="!hasSearchProgress && aiResult && canManageKeywordStrategy">
              <NButton v-if="!isEditingResult" size="small" @click="handleStartKeywordResultEdit">
                <template #icon>
                  <SvgIcon icon="material-symbols:edit-outline" />
                </template>
                编辑
              </NButton>
              <NButton
                v-if="isEditingResult"
                size="small"
                type="primary"
                :loading="isHistorySaving"
                :disabled="!canSaveHistory || isHistoryDeleting"
                @click="handleSaveHistory"
              >
                <template #icon>
                  <SvgIcon icon="material-symbols:save-outline" />
                </template>
                保存
              </NButton>
              <NButton
                v-if="isEditingResult"
                size="small"
                :disabled="isHistorySaving || isHistoryDeleting"
                @click="handleCancelEdit"
              >
                取消
              </NButton>
              <NButton size="small" :disabled="isEditingResult || isHistoryDeleting" @click="handleCopyResult">
                复制结果
              </NButton>
              <NPopconfirm @positive-click="handleDeleteCurrentHistory">
                <template #trigger>
                  <NButton
                    size="small"
                    type="error"
                    secondary
                    :loading="deletingKeywordHistoryId === selectedHistoryId"
                    :disabled="isEditingResult || isHistorySaving || isHistoryDeleting || !currentHistoryRecord"
                  >
                    <template #icon>
                      <SvgIcon icon="material-symbols:delete-outline" />
                    </template>
                    删除
                  </NButton>
                </template>
                删除当前关键词优化历史？
              </NPopconfirm>
            </template>
          </NSpace>
        </div>
      </template>

      <div v-if="hasSearchProgress" class="result-panel">
        <SearchProgressPanel
          :state="searchProgress"
          :loading="isSearchTaskPending"
          :processable="Boolean(currentSearchTask?.id)"
          :show-serper-details="canManageKeywordStrategy"
          @process-collected-leads="handleProcessCollectedLeads"
        />
      </div>
      <div v-else-if="aiResult" class="result-panel keyword-ready-panel">
        <div class="keyword-ready-main">
          <NAlert v-if="keywordQualityWarnings.length" type="warning" :bordered="false" class="keyword-ready-warning">
            {{ keywordQualityWarnings.join('；') }}
          </NAlert>
          <NResult
            status="success"
            :title="keywordReadyResultTitle"
            :description="keywordReadyResultDescription"
            class="keyword-ready-result"
          />
        </div>
        <div v-if="canManageKeywordStrategy" ref="debugFooter" class="result-debug-footer" :class="debugFooterClass">
          <NAlert v-if="isEditingResult" type="info" :bordered="false" class="debug-edit-hint">
            正在编辑搜索策略调试信息，修改关键词、查询包或展示字段后点击保存会更新当前历史记录。
          </NAlert>
          <NCollapse v-model:expanded-names="debugExpandedNames" class="debug-collapse">
            <NCollapseItem title="调试信息" name="debug">
              <KeywordOptimizationResult
                v-if="keywordOptimizationViewModel"
                v-model:keyword-plan="editableKeywordPlan"
                :view-model="keywordOptimizationViewModel"
                :editable="isEditingResult"
              />
              <template v-else>
                <NAlert type="warning" :bordered="false">AI 搜索策略不是合法 JSON，请重新生成。</NAlert>
                <NInput :value="aiResult.text" type="textarea" readonly :autosize="{ minRows: 16, maxRows: 28 }" />
              </template>
              <NText depth="3" class="token-summary">
                Tokens：输入 {{ aiResult.usage.inputTokens ?? '-' }} / 输出 {{ aiResult.usage.outputTokens ?? '-' }} /
                总计 {{ aiResult.usage.totalTokens ?? '-' }}
              </NText>
            </NCollapseItem>
          </NCollapse>
        </div>
      </div>
      <NEmpty v-else description="填写需求后开始获客" class="result-empty" />
    </NCard>

    <KeywordHistoryDrawer
      v-model:show="isHistoryDrawerVisible"
      :records="historyRecords"
      :selected-id="selectedHistoryId"
      :loading="isHistoryLoading"
      :deleting-id="deletingKeywordHistoryId"
      @select="handleSelectHistory"
      @delete="handleDeleteHistory"
    />
  </NSpace>
</template>

<style scoped>
.ai-leads-page {
  --ai-leads-border: #e5eaf3;
  --ai-leads-muted: #f7f9fc;
  --ai-leads-primary: rgb(var(--primary-color));
  --ai-leads-primary-soft: rgb(var(--primary-50-color));
  --ai-leads-success: rgb(var(--success-color));
  --ai-leads-warning: rgb(var(--warning-color));
  --ai-leads-error: rgb(var(--error-color));
  --ai-leads-ink: #1f2937;
  --ai-leads-text-weak: #667085;
}

.task-card,
.workflow-card,
.result-card {
  overflow: hidden;
  border: 1px solid var(--ai-leads-border);
  background: #ffffff;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.section-heading {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.section-title {
  color: var(--ai-leads-ink);
  font-size: 15px;
  font-weight: 600;
}

.result-card :deep(.n-card-header) {
  padding: 14px 16px;
  border-bottom: 1px solid #edf1f7;
  background: #fbfcff;
}

.task-card :deep(.n-card__content),
.workflow-card :deep(.n-card__content) {
  padding: 10px 16px;
}

.lead-form :deep(.n-form-item-label) {
  font-weight: 600;
}

.task-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 2px;
}

.task-toolbar-left {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.lead-count-compact {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.lead-source-mode {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.lead-count-label {
  color: var(--ai-leads-ink);
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}

.required-mark {
  color: var(--ai-leads-error);
}

.lead-count-input {
  width: 116px;
}

.lead-count-feedback {
  font-size: 12px;
}

.task-toolbar-actions {
  justify-content: flex-end;
  flex-wrap: wrap;
}

.history-context-alert {
  margin-top: 10px;
}

.result-card :deep(.result-card-content) {
  min-height: 430px;
  display: flex;
  flex-direction: column;
  padding: 16px;
  background: #ffffff;
}

.workflow-strip {
  display: flex;
  align-items: flex-start;
}

.workflow-step {
  position: relative;
  display: flex;
  flex: 1 1 0;
  min-width: 0;
  align-items: flex-start;
  gap: 8px;
  padding: 2px 12px 2px 0;
}

.workflow-step::after {
  position: absolute;
  top: 8px;
  right: 14px;
  left: 17px;
  height: 1px;
  background: #e5eaf3;
  content: '';
}

.workflow-step:last-child::after {
  display: none;
}

.workflow-dot {
  position: relative;
  z-index: 1;
  width: 8px;
  height: 8px;
  flex: 0 0 auto;
  margin-top: 5px;
  border-radius: 999px;
  background: #c5cedb;
}

.workflow-step-copy {
  position: relative;
  z-index: 1;
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
  padding-left: 2px;
  background: #ffffff;
}

.workflow-step-title {
  overflow: hidden;
  color: var(--ai-leads-ink);
  font-size: 13px;
  font-weight: 600;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workflow-step-description {
  color: var(--ai-leads-text-weak);
  font-size: 12px;
  line-height: 1.45;
}

.workflow-step.is-active {
  color: var(--ai-leads-primary);
}

.workflow-step.is-active .workflow-dot {
  background: var(--ai-leads-primary);
}

.workflow-step.is-completed .workflow-dot {
  background: var(--ai-leads-success);
}

.workflow-step.is-warning .workflow-dot {
  background: var(--ai-leads-warning);
}

.workflow-step.is-error .workflow-dot {
  background: var(--ai-leads-error);
}

.result-panel {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 14px;
}

.keyword-ready-panel {
  min-height: 320px;
  justify-content: space-between;
}

.keyword-ready-main {
  display: flex;
  flex: 1;
  min-height: 240px;
  align-items: center;
  flex-direction: column;
  justify-content: center;
  gap: 12px;
}

.keyword-ready-warning {
  width: min(720px, 100%);
}

.keyword-ready-result {
  width: 100%;
}

.result-debug-footer {
  width: 100%;
  align-self: stretch;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 8px;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    background-color 0.2s ease,
    padding 0.2s ease;
}

.result-debug-footer.is-editing-focus {
  padding: 10px 12px 12px;
  border-color: var(--ai-leads-primary);
  background: #f8fbff;
  box-shadow: 0 0 0 3px rgb(var(--primary-100-color));
}

.debug-edit-hint {
  margin-bottom: 8px;
}

.debug-collapse {
  width: 100%;
}

.debug-collapse :deep(.n-collapse-item__header-main) {
  flex: 0 0 auto;
}

.debug-collapse :deep(.n-collapse-item__content-inner) {
  padding-right: 0;
  padding-left: 0;
}

.result-actions {
  flex-wrap: wrap;
  justify-content: flex-end;
}

.token-summary {
  align-self: flex-end;
  padding: 4px 10px;
  border: 1px solid #e3e9f3;
  border-radius: 6px;
  background: #f8fafc;
}

.result-empty {
  flex: 1;
  justify-content: center;
  min-height: 320px;
}

@media (max-width: 640px) {
  .section-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .result-actions {
    justify-content: flex-start;
  }

  .task-toolbar {
    flex-direction: column;
  }

  .task-toolbar-actions {
    justify-content: flex-start;
  }

  .workflow-strip {
    flex-direction: column;
    gap: 8px;
  }

  .workflow-step {
    width: 100%;
    padding-right: 0;
  }

  .workflow-step::after {
    display: none;
  }
}
</style>
