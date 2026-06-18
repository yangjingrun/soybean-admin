<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, shallowRef } from 'vue';
import { useMessage } from 'naive-ui';
import { useAuthStore } from '@/store/modules/auth';
import {
  deleteLeadKeywordHistory,
  fetchLeadKeywordHistories,
  optimizeLeadKeywords,
  streamLeadCustomerSearch,
  updateLeadKeywordHistory
} from '@/service/api';
import KeywordHistoryDrawer from './modules/KeywordHistoryDrawer.vue';
import KeywordOptimizationResult from './modules/KeywordOptimizationResult.vue';
import SearchProgressPanel from './modules/SearchProgressPanel.vue';
import {
  canReturnToKeywordOptimizationStep,
  createLeadSearchProgressState,
  reduceLeadSearchProgressEvent
} from './modules/search-progress';
import type { LeadSearchProgressState } from './modules/search-progress';
import {
  buildKeywordHistoryUpdatePayload,
  cloneKeywordPlan,
  createAiResultFromKeywordHistory,
  createKeywordOptimizationViewModel,
  formatAiFinishReason,
  formatKeywordOptimizationVisibleText,
  isValidTargetLeadCount,
  parseKeywordOptimizationPlan,
  resolveTargetLeadCountAfterOptimization
} from './modules/shared';

const message = useMessage();
const authStore = useAuthStore();
const defaultTargetLeadCount = 20;
const maxLeadSearchRepeatRounds = 2;

interface LeadSearchForm {
  requirement: string;
  targetLeadCount: number | null;
}

const form = reactive<LeadSearchForm>({
  requirement:
    '我是中国河北卖轴承的，主打 6204 bearing，想找沙特阿拉伯进口商和经销商，产品优势是供货稳定、价格有竞争力。',
  targetLeadCount: defaultTargetLeadCount
});

const isGenerating = shallowRef(false);
const isSearching = shallowRef(false);
const isHistoryLoading = shallowRef(false);
const isHistorySaving = shallowRef(false);
const isHistoryDrawerVisible = shallowRef(false);
const isEditingResult = shallowRef(false);
const searchAbortController = shallowRef<AbortController | null>(null);
const deletingKeywordHistoryId = shallowRef('');
const aiResult = shallowRef<Api.AiGateway.AiTextResult | null>(null);
const searchProgress = ref<LeadSearchProgressState>(createLeadSearchProgressState());
const keywordQualityWarnings = ref<string[]>([]);
const historyRecords = ref<Api.AiLeads.KeywordHistoryRecord[]>([]);
const editableKeywordPlan = ref<Api.AiLeads.OptimizedKeywordPlan | null>(null);
const editingKeywordPlanSnapshot = ref<Api.AiLeads.OptimizedKeywordPlan | null>(null);
const selectedHistoryId = shallowRef('');
const isTargetLeadCountTouched = shallowRef(false);

const canGenerate = computed(() => Boolean(form.requirement.trim()));
const isTargetLeadCountValid = computed(() => isValidTargetLeadCount(form.targetLeadCount));
const targetLeadCountValidationStatus = computed(() => (isTargetLeadCountValid.value ? undefined : 'error'));
const targetLeadCountFeedback = computed(() => (isTargetLeadCountValid.value ? undefined : '请输入 1-200 的采集数量'));
const canSaveHistory = computed(() =>
  Boolean(selectedHistoryId.value && editableKeywordPlan.value && form.requirement.trim())
);
const isHistoryDeleting = computed(() => Boolean(deletingKeywordHistoryId.value));
const isSuperAdmin = computed(() => authStore.userInfo.roles.includes('R_SUPER'));
const parsedAiKeywordPlan = computed(() => {
  if (!aiResult.value?.text) {
    return null;
  }

  try {
    return parseKeywordOptimizationPlan(aiResult.value.text);
  } catch {
    return null;
  }
});
const keywordOptimizationPlan = computed(() => editableKeywordPlan.value || parsedAiKeywordPlan.value);
const hasKeywordPlan = computed(() => Boolean(keywordOptimizationPlan.value));
const canSearchCustomers = computed(
  () =>
    canGenerate.value &&
    hasKeywordPlan.value &&
    isTargetLeadCountValid.value &&
    !isGenerating.value &&
    !isSearching.value
);
const keywordOptimizationViewModel = computed(() =>
  keywordOptimizationPlan.value
    ? createKeywordOptimizationViewModel(keywordOptimizationPlan.value, isSuperAdmin.value)
    : null
);
const aiFinishReasonLabel = computed(() => formatAiFinishReason(aiResult.value?.finishReason));
const currentHistoryRecord = computed(
  () => historyRecords.value.find(record => record.id === selectedHistoryId.value) || null
);
const hasSearchProgress = computed(
  () => isSearching.value || searchProgress.value.status !== 'idle' || Boolean(searchProgress.value.result)
);
const canReturnToKeywordStep = computed(() =>
  canReturnToKeywordOptimizationStep(searchProgress.value, isSearching.value)
);
const currentWorkflowStepLabel = computed(() => (hasSearchProgress.value ? '搜索采集' : '关键词优化'));

onMounted(() => {
  void loadKeywordHistories();
});

onBeforeUnmount(() => {
  cancelSearchStream();
});

/** Calls the AI leads keyword optimization workflow. */
async function handleGenerate() {
  const targetLeadCount = form.targetLeadCount;
  const isTargetLeadCountManuallyEdited = isTargetLeadCountTouched.value;
  isGenerating.value = true;
  resetSearchProgress();

  try {
    const { data: result, error } = await optimizeLeadKeywords({
      requirement: form.requirement.trim()
    });

    if (error) {
      return;
    }

    aiResult.value = result;
    keywordQualityWarnings.value = result.qualityWarnings ?? [];
    upsertHistoryRecord(result.historyRecord);
    applyKeywordHistoryRecord(result.historyRecord, { syncTargetLeadCount: false });
    form.targetLeadCount = resolveTargetLeadCountAfterOptimization({
      currentValue: targetLeadCount,
      resolvedValue: result.historyRecord.keywordPlan.resolvedTargetLeadCount,
      isManuallyEdited: isTargetLeadCountManuallyEdited,
      defaultValue: defaultTargetLeadCount
    });
    isTargetLeadCountTouched.value = isTargetLeadCountManuallyEdited;
    message.success('生成完成');
  } finally {
    isGenerating.value = false;
  }
}

/** Starts the backend search collection workflow and consumes streamed progress events. */
async function handleSearchCustomers() {
  if (isSearching.value) {
    return;
  }

  if (isGenerating.value) {
    message.warning('关键词生成中，请稍后再开始采集');
    return;
  }

  if (!hasKeywordPlan.value) {
    message.warning('请先优化关键词，再开始采集');
    return;
  }

  const targetLeadCount = getRequiredTargetLeadCount();
  if (!targetLeadCount) {
    message.warning('请输入 1-200 的采集数量');
    return;
  }

  isSearching.value = true;
  keywordQualityWarnings.value = [];
  searchProgress.value = createStartingSearchProgressState();

  const abortController = new AbortController();
  searchAbortController.value = abortController;

  try {
    await streamLeadCustomerSearch(
      {
        requirement: form.requirement.trim(),
        targetLeadCount
      },
      {
        onEvent(event) {
          searchProgress.value = reduceLeadSearchProgressEvent(searchProgress.value, event);
        }
      },
      { signal: abortController.signal }
    );

    if (searchProgress.value.status === 'completed') {
      message.success('搜索采集完成');
    } else if (searchProgress.value.status === 'failed') {
      message.error(searchProgress.value.errorMessage || '搜索采集失败，请稍后重试');
    }
  } catch (error) {
    if (!isAbortError(error)) {
      searchProgress.value = reduceLeadSearchProgressEvent(searchProgress.value, createClientFailureEvent());
      message.error('搜索采集失败，请稍后重试');
    }
  } finally {
    isSearching.value = false;
    if (searchAbortController.value === abortController) {
      searchAbortController.value = null;
    }
  }
}

function handleClear() {
  cancelSearchStream();
  form.requirement = '';
  form.targetLeadCount = defaultTargetLeadCount;
  isTargetLeadCountTouched.value = false;
  aiResult.value = null;
  searchProgress.value = createLeadSearchProgressState();
  keywordQualityWarnings.value = [];
  editableKeywordPlan.value = null;
  editingKeywordPlanSnapshot.value = null;
  selectedHistoryId.value = '';
  isEditingResult.value = false;
}

async function handleCopyResult() {
  if (!aiResult.value?.text) {
    return;
  }

  const copyText =
    isSuperAdmin.value || !keywordOptimizationViewModel.value
      ? aiResult.value.text
      : formatKeywordOptimizationVisibleText(keywordOptimizationViewModel.value);

  await navigator.clipboard.writeText(copyText);
  message.success('结果已复制');
}

/** Loads keyword histories and selects the newest one by default. */
async function loadKeywordHistories() {
  isHistoryLoading.value = true;

  try {
    const { data: result, error } = await fetchLeadKeywordHistories({ size: 20 });

    if (error) {
      return;
    }

    historyRecords.value = result.records;
    if (!selectedHistoryId.value && result.records[0]) {
      applyKeywordHistoryRecord(result.records[0]);
    }
  } finally {
    isHistoryLoading.value = false;
  }
}

function handleSelectHistory(record: Api.AiLeads.KeywordHistoryRecord) {
  applyKeywordHistoryRecord(record);
  isHistoryDrawerVisible.value = false;
}

/** Deletes one history record and keeps the current selection in sync. */
async function handleDeleteHistory(record: Api.AiLeads.KeywordHistoryRecord) {
  deletingKeywordHistoryId.value = record.id;

  try {
    const { error } = await deleteLeadKeywordHistory(record.id);

    if (error) {
      return;
    }

    const nextRecords = historyRecords.value.filter(item => item.id !== record.id);
    historyRecords.value = nextRecords;

    // 删除当前记录后，切到剩余最新记录；没有历史时清空当前结果。
    if (record.id === selectedHistoryId.value) {
      if (nextRecords[0]) {
        applyKeywordHistoryRecord(nextRecords[0]);
      } else {
        resetKeywordHistorySelection();
      }
    }

    message.success('删除完成');
  } finally {
    deletingKeywordHistoryId.value = '';
  }
}

async function handleDeleteCurrentHistory() {
  if (!currentHistoryRecord.value) {
    return;
  }

  await handleDeleteHistory(currentHistoryRecord.value);
}

function handleStartEdit() {
  if (!keywordOptimizationPlan.value) {
    return;
  }

  editingKeywordPlanSnapshot.value = cloneKeywordPlan(keywordOptimizationPlan.value);
  editableKeywordPlan.value = cloneKeywordPlan(keywordOptimizationPlan.value);
  isEditingResult.value = true;
}

function handleCancelEdit() {
  editableKeywordPlan.value = editingKeywordPlanSnapshot.value
    ? cloneKeywordPlan(editingKeywordPlanSnapshot.value)
    : null;
  editingKeywordPlanSnapshot.value = null;
  isEditingResult.value = false;
}

async function handleSaveHistory() {
  if (!selectedHistoryId.value || !editableKeywordPlan.value) {
    return;
  }

  isHistorySaving.value = true;

  try {
    const { data: record, error } = await updateLeadKeywordHistory(
      selectedHistoryId.value,
      buildKeywordHistoryUpdatePayload(form.requirement, editableKeywordPlan.value)
    );

    if (error) {
      return;
    }

    upsertHistoryRecord(record);
    applyKeywordHistoryRecord(record);
    message.success('保存完成');
  } finally {
    isHistorySaving.value = false;
  }
}

function applyKeywordHistoryRecord(
  record: Api.AiLeads.KeywordHistoryRecord,
  options: { syncTargetLeadCount?: boolean } = {}
) {
  selectedHistoryId.value = record.id;
  form.requirement = record.requirement;
  if (options.syncTargetLeadCount !== false) {
    form.targetLeadCount = resolveTargetLeadCountAfterOptimization({
      currentValue: defaultTargetLeadCount,
      resolvedValue: record.keywordPlan.resolvedTargetLeadCount,
      isManuallyEdited: false,
      defaultValue: defaultTargetLeadCount
    });
    isTargetLeadCountTouched.value = false;
  }
  aiResult.value = createAiResultFromKeywordHistory(record);
  keywordQualityWarnings.value = [];
  editableKeywordPlan.value = cloneKeywordPlan(record.keywordPlan);
  editingKeywordPlanSnapshot.value = null;
  resetSearchProgress();
  isEditingResult.value = false;
}

function resetKeywordHistorySelection() {
  selectedHistoryId.value = '';
  isTargetLeadCountTouched.value = false;
  aiResult.value = null;
  keywordQualityWarnings.value = [];
  editableKeywordPlan.value = null;
  editingKeywordPlanSnapshot.value = null;
  resetSearchProgress();
  isEditingResult.value = false;
}

function upsertHistoryRecord(record: Api.AiLeads.KeywordHistoryRecord) {
  const nextRecords = historyRecords.value.filter(item => item.id !== record.id);

  historyRecords.value = [record, ...nextRecords].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Reads the required target lead count after form validation has passed. */
function getRequiredTargetLeadCount() {
  return isTargetLeadCountValid.value ? form.targetLeadCount : null;
}

/** Tracks direct edits so AI optimization does not overwrite an explicit user count. */
function handleTargetLeadCountUpdate(value: number | null) {
  isTargetLeadCountTouched.value = true;
  form.targetLeadCount = value;
}

/** Returns to the optimized keyword result while keeping the current keyword plan intact. */
function handleReturnToKeywordOptimization() {
  resetSearchProgress();
}

/** Clears previous search progress and aborts an active stream if one exists. */
function resetSearchProgress() {
  cancelSearchStream();
  searchProgress.value = createLeadSearchProgressState();
}

function cancelSearchStream() {
  searchAbortController.value?.abort();
  searchAbortController.value = null;
}

function createStartingSearchProgressState(): LeadSearchProgressState {
  return {
    ...createLeadSearchProgressState(),
    status: 'running',
    currentTitle: '准备搜索采集',
    currentDescription: '正在建立采集任务。',
    progressPercent: 3
  };
}

function createClientFailureEvent(): Api.AiLeads.LeadSearchProgressEvent {
  return {
    type: 'workflow_failed',
    runId: 'client',
    sequence: Date.now(),
    emittedAt: new Date().toISOString(),
    title: '搜索采集失败',
    errorMessage: '搜索采集失败，请稍后重试'
  };
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError';
}
</script>

<template>
  <NSpace vertical :size="14" class="ai-leads-page">
    <NCard :bordered="false" size="small" class="card-wrapper lead-search-card">
      <div class="card-title">
        <div class="card-title-main">
          <span class="card-title-text">获客需求</span>
          <NTag size="small" type="info" :bordered="false">当前步骤：{{ currentWorkflowStepLabel }}</NTag>
          <NTag size="small" type="warning" :bordered="false">最多重复 {{ maxLeadSearchRepeatRounds }} 轮</NTag>
        </div>
      </div>

      <NForm :model="form" label-placement="left" label-width="78" size="small" class="lead-form">
        <NGrid :x-gap="18" :y-gap="12" responsive="screen" item-responsive>
          <NGi span="24 l:15">
            <NFormItem label="">
              <NInput
                v-model:value="form.requirement"
                type="textarea"
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
                @update:value="handleTargetLeadCountUpdate"
              />
            </NFormItem>
          </NGi>

          <NGi span="24 m:16 l:5" class="lead-actions">
            <NSpace :size="8" class="lead-action-group">
              <NButton
                :disabled="isGenerating || isSearching || isHistorySaving || isHistoryDeleting"
                @click="handleClear"
              >
                清空
              </NButton>
              <NButton
                :loading="isGenerating"
                :disabled="!canGenerate || isSearching || isHistorySaving || isHistoryDeleting"
                @click="handleGenerate"
              >
                优化关键词
              </NButton>
              <NButton
                type="primary"
                :loading="isSearching"
                :disabled="!canSearchCustomers || isHistorySaving || isHistoryDeleting"
                @click="handleSearchCustomers"
              >
                开始搜索采集
              </NButton>
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
            <NButton size="small" secondary :loading="isHistoryLoading" @click="isHistoryDrawerVisible = true">
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
        <SearchProgressPanel :state="searchProgress" :loading="isSearching" />
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
