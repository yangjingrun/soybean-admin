<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue';
import KeywordHistoryDrawer from './modules/KeywordHistoryDrawer.vue';
import KeywordOptimizationResult from './modules/KeywordOptimizationResult.vue';
import SearchProgressPanel from './modules/SearchProgressPanel.vue';
import { useAiLeadPage } from './modules/useAiLeadPage';

const {
  aiFinishReasonLabel,
  aiResult,
  canGenerate,
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
  handleImportCandidate,
  handleReturnToKeywordOptimization,
  handleSaveHistory,
  handleSearchCustomers,
  handleSearchTaskAction,
  handleSelectHistory,
  handleStartEdit,
  handleTargetLeadCountUpdate,
  hasSearchProgress,
  historyRecords,
  importingCandidateKey,
  isEditingResult,
  isGenerating,
  isHistoryDeleting,
  isHistoryDrawerVisible,
  isHistoryLoading,
  isHistorySaving,
  isSearchTaskActionLoading,
  isSearchTaskBlockingForm,
  isSearchTaskPending,
  isSearchTaskSubmitting,
  isSearching,
  isSuperAdmin,
  keywordOptimizationViewModel,
  keywordQualityWarnings,
  searchProgress,
  searchTaskActionState,
  selectedHistoryId,
  targetLeadCountFeedback
} = useAiLeadPage();

type ResultTab = 'keyword' | 'search';
type WorkflowStepState = 'wait' | 'active' | 'completed' | 'warning' | 'error';
type TaskActionButton = {
  key: 'interrupt' | 'resume' | 'retry' | 'read';
  label: string;
  type: 'primary' | 'success' | 'warning';
  visible: boolean;
};

const activeResultTab = shallowRef<ResultTab>('keyword');

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
      title: '确认关键词',
      description: hasKeywordPlan ? '已生成可执行查询' : '先让 AI 归纳搜索方向',
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
    },
    {
      key: 'crm',
      title: '导入 CRM',
      description: hasCompletedSearch ? '筛选候选客户并导入线索库' : '采集完成后处理候选客户',
      state: hasCompletedSearch ? 'active' : 'wait'
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
      { key: 'interrupt', label: '中断', type: 'warning', visible: searchTaskActionState.value.canInterrupt },
      { key: 'resume', label: '继续', type: 'primary', visible: searchTaskActionState.value.canResume },
      { key: 'retry', label: '重试', type: 'primary', visible: searchTaskActionState.value.canRetry },
      { key: 'read', label: '确认结果', type: 'success', visible: searchTaskActionState.value.canMarkRead }
    ].filter(item => item.visible) as TaskActionButton[]
);

watch(
  hasSearchProgress,
  value => {
    activeResultTab.value = value ? 'search' : 'keyword';
  },
  { immediate: true }
);
</script>

<template>
  <NSpace vertical :size="12" class="ai-leads-page">
    <NCard :bordered="false" size="small" class="card-wrapper task-card">
      <template #header>
        <div class="section-header">
          <div class="section-heading">
            <span class="section-title">AI 获客任务</span>
            <NTag size="small" type="info" :bordered="false">{{ currentWorkflowStepLabel }}</NTag>
            <NTag v-if="currentSearchTask" size="small" :type="currentSearchTaskStatusType" :bordered="false">
              {{ currentSearchTaskStatusLabel }}
            </NTag>
          </div>
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
        </div>
      </template>

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
          </div>

          <NSpace :size="8" class="task-toolbar-actions">
            <NButton :loading="isGenerating" :disabled="isGenerateDisabled" @click="handleGenerate">优化关键词</NButton>
            <NButton
              type="primary"
              :loading="isSearchTaskSubmitting"
              :disabled="!canSearchCustomers || isHistorySaving || isHistoryDeleting"
              @click="handleSearchCustomers"
            >
              开始搜索采集
            </NButton>
            <NButton size="small" :disabled="isClearDisabled" @click="handleClear">清空</NButton>
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
              返回关键词
            </NButton>
            <template v-if="!hasSearchProgress && aiResult && (isSuperAdmin || keywordOptimizationViewModel)">
              <NButton v-if="!isEditingResult" size="small" @click="handleStartEdit">
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

      <NTabs v-if="aiResult || hasSearchProgress" v-model:value="activeResultTab" size="small" animated>
        <NTabPane name="keyword" tab="关键词方案">
          <div v-if="aiResult" class="result-panel">
            <NAlert v-if="keywordQualityWarnings.length" type="warning" :bordered="false">
              {{ keywordQualityWarnings.join('；') }}
            </NAlert>
            <KeywordOptimizationResult
              v-if="keywordOptimizationViewModel"
              v-model:keyword-plan="editableKeywordPlan"
              :view-model="keywordOptimizationViewModel"
              :editable="isEditingResult"
            />
            <template v-else>
              <NAlert type="warning" :bordered="false">关键词优化结果不是合法 JSON，请重新生成。</NAlert>
              <NInput
                v-if="isSuperAdmin"
                :value="aiResult.text"
                type="textarea"
                readonly
                :autosize="{ minRows: 16, maxRows: 28 }"
              />
            </template>
            <NText depth="3" class="token-summary">
              Tokens：输入 {{ aiResult.usage.inputTokens ?? '-' }} / 输出 {{ aiResult.usage.outputTokens ?? '-' }} /
              总计 {{ aiResult.usage.totalTokens ?? '-' }}
            </NText>
          </div>
          <NEmpty v-else description="先优化关键词，系统会在这里展示可执行查询" class="result-empty" />
        </NTabPane>

        <NTabPane v-if="hasSearchProgress" name="search" tab="采集结果">
          <div class="result-panel">
            <SearchProgressPanel
              :state="searchProgress"
              :importing-candidate-key="importingCandidateKey"
              :loading="isSearchTaskPending"
              :show-serper-details="isSuperAdmin"
              @import-candidate="handleImportCandidate"
            />
          </div>
        </NTabPane>
      </NTabs>
      <NEmpty v-else description="填写需求后先优化关键词" class="result-empty" />
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

.task-card :deep(.n-card-header),
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

.result-card :deep(.result-card-content) {
  min-height: 430px;
  display: flex;
  flex-direction: column;
  padding: 0 16px 16px;
  background: #ffffff;
}

.result-card :deep(.n-tabs-nav) {
  padding-top: 4px;
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
