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
  canManageKeywordStrategy,
  canViewSerperDetails,
  canReturnToKeywordStep,
  canSaveHistory,
  canStartLeadWorkflow,
  canStopLeadWorkflow,
  currentHistoryRecord,
  currentSearchTask,
  deletingKeywordHistoryId,
  editableKeywordPlan,
  form,
  handleCancelEdit,
  handleCopyResult,
  handleDeleteCurrentHistory,
  handleDeleteHistory,
  handleProcessCollectedLeads,
  handleReturnToKeywordOptimization,
  handleSaveHistory,
  handleSelectHistory,
  handleStartLeadWorkflow,
  handleStartEdit,
  handleStopLeadWorkflow,
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
  isLeadWorkflowRunning,
  keywordOptimizationViewModel,
  keywordQualityWarnings,
  leadWorkflowStatusLabel,
  searchProgress,
  selectedHistoryId,
  targetLeadCountFeedback
} = useAiLeadPage();

const debugFooterRef = useTemplateRef<HTMLElement>('debugFooter');
const debugExpandedNames = shallowRef<Array<string | number>>([]);

const debugFooterClass = computed(() => ({ 'is-editing-focus': isEditingResult.value }));
const selectedHistoryUpdatedAtLabel = computed(() =>
  currentHistoryRecord.value ? dayjs(currentHistoryRecord.value.updatedAt).format('YYYY-MM-DD HH:mm') : ''
);
const keywordReadyResultTitle = computed(() =>
  isRestoredKeywordHistory.value ? '历史搜索策略已选中' : '搜索策略已准备好'
);
const keywordReadyResultDescription = computed(() =>
  isRestoredKeywordHistory.value ? '点击开始获客，系统会复用这条历史策略。' : '点击开始获客，系统会直接返回候选客户。'
);

/**
 * Enters keyword plan edit mode and guides the user to the editable debug panel.
 */
async function handleStartKeywordResultEdit() {
  handleStartEdit();
  debugExpandedNames.value = ['debug'];

  await nextTick();
  debugFooterRef.value?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
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
            <NTag v-if="leadWorkflowStatusLabel" size="small" type="info" :bordered="false">
              {{ leadWorkflowStatusLabel }}
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
            <NButton
              v-if="!isLeadWorkflowRunning"
              size="small"
              type="primary"
              :disabled="!canStartLeadWorkflow"
              data-action="start-leads"
              @click="handleStartLeadWorkflow"
            >
              开始获客
            </NButton>
            <NButton v-else size="small" type="primary" loading disabled data-action="start-leads">
              {{ leadWorkflowStatusLabel || '正在获客' }}
            </NButton>
            <NButton
              v-if="canStopLeadWorkflow"
              size="small"
              type="error"
              secondary
              :loading="isSearchTaskActionLoading"
              data-action="stop-leads"
              @click="handleStopLeadWorkflow"
            >
              停止本次获客
            </NButton>
          </NSpace>
        </div>
        <NAlert v-if="isRestoredKeywordHistory" type="info" :bordered="false" class="history-context-alert">
          <template #header>已选中关键词历史</template>
          当前展示的是
          {{ selectedHistoryUpdatedAtLabel }} 保存的搜索策略。需求不变时会直接复用，需求变化后会自动重新分析。
        </NAlert>
      </NForm>
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

      <div v-if="isGenerating || isSearchTaskSubmitting" class="result-panel lead-workflow-skeleton">
        <NSkeleton text :repeat="1" width="38%" />
        <NSkeleton text :repeat="2" />
        <div class="skeleton-grid">
          <NSkeleton v-for="item in 6" :key="item" height="72px" :sharp="false" />
        </div>
      </div>
      <div v-else-if="hasSearchProgress" class="result-panel">
        <SearchProgressPanel
          :state="searchProgress"
          :loading="isSearchTaskPending"
          :processable="Boolean(currentSearchTask?.id)"
          :show-serper-details="canViewSerperDetails"
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
                :show-query-details="canViewSerperDetails"
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
  container: ai-leads-content / inline-size;
  min-width: 0;
}

.task-card,
.result-card {
  min-width: 0;
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

.task-card :deep(.n-card__content) {
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

.task-toolbar-actions :deep(.n-button),
.result-actions :deep(.n-button) {
  max-width: 100%;
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

.result-panel {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 14px;
}

.lead-workflow-skeleton {
  justify-content: center;
  min-height: 320px;
}

.skeleton-grid {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
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

@container ai-leads-content (max-width: 900px) {
  .task-card :deep(.n-card__content) {
    padding: 10px 12px;
  }

  .result-card :deep(.n-card-header) {
    padding: 12px;
  }

  .result-card :deep(.result-card-content) {
    min-height: 360px;
    padding: 12px;
  }

  .section-header {
    width: 100%;
    align-items: flex-start;
    flex-direction: column;
  }

  .section-heading,
  .result-actions {
    width: 100%;
  }

  .result-actions {
    justify-content: flex-start;
  }

  .result-actions :deep(.n-space-item) {
    flex: 1 1 132px;
    min-width: 0;
  }

  .result-actions :deep(.n-button) {
    width: 100%;
  }

  .task-toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .task-toolbar-left,
  .lead-source-mode,
  .lead-count-compact,
  .task-toolbar-actions {
    width: 100%;
  }

  .task-toolbar-left,
  .lead-source-mode,
  .lead-count-compact {
    align-items: stretch;
  }

  .lead-source-mode,
  .lead-count-compact {
    gap: 6px;
  }

  .lead-source-mode :deep(.n-radio-group) {
    display: flex;
    width: 100%;
  }

  .lead-source-mode :deep(.n-radio-button) {
    flex: 1 1 0;
    justify-content: center;
  }

  .lead-count-input {
    width: 100%;
  }

  .lead-count-feedback {
    width: 100%;
  }

  .task-toolbar-actions {
    justify-content: flex-start;
  }

  .task-toolbar-actions :deep(.n-space-item) {
    flex: 1 1 132px;
    min-width: 0;
  }

  .task-toolbar-actions :deep(.n-button) {
    width: 100%;
  }

  .skeleton-grid {
    grid-template-columns: 1fr;
  }

  .keyword-ready-main {
    min-height: 220px;
  }
}

@container ai-leads-content (max-width: 520px) {
  .task-card :deep(.n-card__content),
  .result-card :deep(.result-card-content) {
    padding: 10px;
  }

  .lead-form :deep(.n-form-item) {
    --n-feedback-height: 18px;
  }

  .history-context-alert {
    margin-top: 8px;
  }

  .task-toolbar-actions :deep(.n-space-item),
  .result-actions :deep(.n-space-item) {
    flex-basis: 100%;
  }

  .keyword-ready-panel,
  .result-empty,
  .lead-workflow-skeleton {
    min-height: 260px;
  }
}

@media (max-width: 640px) {
  .skeleton-grid {
    grid-template-columns: 1fr;
  }
}
</style>
