<script setup lang="ts">
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
  maxLeadSearchRepeatRounds,
  searchProgress,
  searchTaskActionState,
  selectedHistoryId,
  targetLeadCountFeedback,
  targetLeadCountValidationStatus
} = useAiLeadPage();
</script>

<template>
  <NSpace vertical :size="14" class="ai-leads-page">
    <NCard :bordered="false" size="small" class="card-wrapper lead-search-card">
      <div class="card-title">
        <div class="card-title-main">
          <span class="card-title-text">获客需求</span>
          <NTag size="small" type="info" :bordered="false">当前步骤：{{ currentWorkflowStepLabel }}</NTag>
          <NTag v-if="currentSearchTask" size="small" :type="currentSearchTaskStatusType" :bordered="false">
            任务：{{ currentSearchTaskStatusLabel }}
          </NTag>
          <NTag size="small" type="warning" :bordered="false">最多重复 {{ maxLeadSearchRepeatRounds }} 轮</NTag>
        </div>
      </div>

      <NForm :model="form" label-placement="left" label-width="90" size="small" class="lead-form">
        <NGrid :x-gap="18" :y-gap="12" responsive="screen" item-responsive>
          <NGi span="24 l:15">
            <NFormItem label="">
              <NInput
                v-model:value="form.requirement"
                type="textarea"
                :disabled="isSearchTaskBlockingForm"
                :autosize="{ minRows: 4, maxRows: 7 }"
                placeholder="描述你的产品、地区、目标市场、客户类型、产品优势等。例如：我是中国河北卖轴承的，主打 6204 bearing，想找沙特阿拉伯进口商和经销商，产品优势是供货稳定、价格有竞争力。"
              />
            </NFormItem>
          </NGi>

          <NGi span="24 m:8 l:4" class="lead-count-field">
            <NFormItem
              label="采集数量"
              required
              :validation-status="targetLeadCountValidationStatus"
              :feedback="targetLeadCountFeedback"
            >
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
            </NFormItem>
          </NGi>

          <NGi span="24 m:16 l:5" class="lead-actions">
            <NSpace :size="8" class="lead-action-group">
              <NButton
                :disabled="
                  isGenerating ||
                    isSearching ||
                    isSearchTaskActionLoading ||
                    isHistorySaving ||
                    isHistoryDeleting ||
                    isSearchTaskBlockingForm
                "
                @click="handleClear"
              >
                清空
              </NButton>
              <NButton
                :loading="isGenerating"
                :disabled="
                  !canGenerate ||
                    isSearching ||
                    isSearchTaskActionLoading ||
                    isHistorySaving ||
                    isHistoryDeleting ||
                    isSearchTaskBlockingForm
                "
                @click="handleGenerate"
              >
                优化关键词
              </NButton>
              <NButton
                type="primary"
                :loading="isSearchTaskSubmitting"
                :disabled="!canSearchCustomers || isHistorySaving || isHistoryDeleting"
                @click="handleSearchCustomers"
              >
                开始搜索采集
              </NButton>
              <NButton
                v-if="searchTaskActionState.canInterrupt"
                type="warning"
                secondary
                :loading="isSearchTaskActionLoading"
                :disabled="isHistorySaving || isHistoryDeleting"
                @click="handleSearchTaskAction('interrupt')"
              >
                中断
              </NButton>
              <NButton
                v-if="searchTaskActionState.canResume"
                type="primary"
                secondary
                :loading="isSearchTaskActionLoading"
                :disabled="isHistorySaving || isHistoryDeleting"
                @click="handleSearchTaskAction('resume')"
              >
                继续
              </NButton>
              <NButton
                v-if="searchTaskActionState.canRetry"
                type="primary"
                secondary
                :loading="isSearchTaskActionLoading"
                :disabled="isHistorySaving || isHistoryDeleting"
                @click="handleSearchTaskAction('retry')"
              >
                重试
              </NButton>
              <NButton
                v-if="searchTaskActionState.canMarkRead"
                type="success"
                secondary
                :loading="isSearchTaskActionLoading"
                :disabled="isHistorySaving || isHistoryDeleting"
                @click="handleSearchTaskAction('read')"
              >
                确认结果
              </NButton>
              <NPopconfirm v-if="searchTaskActionState.canDiscard" @positive-click="handleSearchTaskAction('discard')">
                <template #trigger>
                  <NButton
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
          </NGi>
        </NGrid>
      </NForm>
    </NCard>

    <NCard :bordered="false" size="small" class="card-wrapper result-card" content-class="result-card-content">
      <template #header>
        <div class="result-header">
          <div class="result-heading">
            <span class="result-title">{{ hasSearchProgress ? '搜索采集结果' : '关键词优化结果' }}</span>
            <NTag v-if="aiResult && aiFinishReasonLabel" size="small" type="success">
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

      <div v-if="hasSearchProgress" class="result-panel">
        <SearchProgressPanel
          :state="searchProgress"
          :importing-candidate-key="importingCandidateKey"
          :loading="isSearchTaskPending"
          :show-serper-details="isSuperAdmin"
          @import-candidate="handleImportCandidate"
        />
      </div>
      <div v-else-if="aiResult" class="result-panel">
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
          Tokens：输入 {{ aiResult.usage.inputTokens ?? '-' }} / 输出 {{ aiResult.usage.outputTokens ?? '-' }} / 总计
          {{ aiResult.usage.totalTokens ?? '-' }}
        </NText>
      </div>
      <NEmpty v-else description="暂无生成结果" class="result-empty" />
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
  --ai-leads-surface: #f7f9fd;
  --ai-leads-border: #dbe5f3;
  --ai-leads-primary: #5b75ff;
  --ai-leads-primary-soft: #eef3ff;
  --ai-leads-ink: #1f2937;
}

.lead-search-card,
.result-card {
  overflow: hidden;
  border: 1px solid var(--ai-leads-border);
  background: linear-gradient(180deg, #ffffff 0%, var(--ai-leads-surface) 100%);
  box-shadow: 0 10px 28px rgb(15 23 42 / 5%);
}

.card-title,
.result-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-weight: 600;
}

.card-title {
  padding-bottom: 8px;
  border-bottom: 1px solid #edf1f7;
}

.card-title-main {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.card-title-text,
.result-title {
  position: relative;
  display: inline-flex;
  align-items: center;
  color: var(--ai-leads-ink);
}

.card-title-text::before,
.result-title::before {
  width: 4px;
  height: 16px;
  margin-right: 8px;
  border-radius: 999px;
  background: var(--ai-leads-primary);
  content: '';
}

.result-heading {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.lead-form {
  padding-top: 12px;
}

.lead-search-card :deep(.n-card__content) {
  padding: 16px 18px 14px;
}

.lead-search-card :deep(.n-input) {
  background: #ffffff;
}

.lead-search-card :deep(.n-form-item-label) {
  font-weight: 600;
}

.lead-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.lead-count-field :deep(.n-input-number) {
  width: 100%;
}

.lead-action-group {
  justify-content: flex-end;
}

.result-card :deep(.n-card-header) {
  padding: 14px 18px;
  border-bottom: 1px solid #edf1f7;
  background: #fbfcff;
}

.result-card :deep(.result-card-content) {
  min-height: 430px;
  display: flex;
  flex-direction: column;
  padding: 18px;
  background: #ffffff;
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
}

@media (max-width: 640px) {
  .card-title,
  .result-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .lead-actions {
    justify-content: flex-start;
  }

  .lead-action-group,
  .result-actions {
    justify-content: flex-start;
  }
}
</style>
