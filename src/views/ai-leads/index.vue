<script setup lang="ts">
import { computed, onMounted, reactive, ref, shallowRef } from 'vue';
import { useMessage } from 'naive-ui';
import { useAuthStore } from '@/store/modules/auth';
import {
  fetchLeadKeywordHistories,
  optimizeLeadKeywords,
  searchLeadCustomers,
  updateLeadKeywordHistory
} from '@/service/api';
import KeywordHistoryDrawer from './modules/KeywordHistoryDrawer.vue';
import KeywordOptimizationResult from './modules/KeywordOptimizationResult.vue';
import {
  buildKeywordHistoryUpdatePayload,
  cloneKeywordPlan,
  createAiResultFromKeywordHistory,
  createKeywordOptimizationViewModel,
  formatKeywordOptimizationVisibleText,
  parseKeywordOptimizationPlan
} from './modules/shared';

const message = useMessage();
const authStore = useAuthStore();

const form = reactive({
  requirement:
    '我是中国河北卖轴承的，主打 6204 bearing，想找沙特阿拉伯进口商和经销商，产品优势是供货稳定、价格有竞争力。'
});

const isGenerating = shallowRef(false);
const isSearching = shallowRef(false);
const isHistoryLoading = shallowRef(false);
const isHistorySaving = shallowRef(false);
const isHistoryDrawerVisible = shallowRef(false);
const isEditingResult = shallowRef(false);
const aiResult = shallowRef<Api.AiGateway.AiTextResult | null>(null);
const searchResult = shallowRef<Api.AiLeads.SearchOrchestrateResult | null>(null);
const historyRecords = ref<Api.AiLeads.KeywordHistoryRecord[]>([]);
const editableKeywordPlan = ref<Api.AiLeads.OptimizedKeywordPlan | null>(null);
const editingKeywordPlanSnapshot = ref<Api.AiLeads.OptimizedKeywordPlan | null>(null);
const selectedHistoryId = shallowRef('');

const canGenerate = computed(() => Boolean(form.requirement.trim()));
const canSaveHistory = computed(() =>
  Boolean(selectedHistoryId.value && editableKeywordPlan.value && form.requirement.trim())
);
const isSuperAdmin = computed(() => authStore.userInfo.roles.includes('R_SUPER'));
const searchResultText = computed(() => (searchResult.value ? JSON.stringify(searchResult.value, null, 2) : ''));
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
const keywordOptimizationViewModel = computed(() =>
  keywordOptimizationPlan.value
    ? createKeywordOptimizationViewModel(keywordOptimizationPlan.value, isSuperAdmin.value)
    : null
);

onMounted(() => {
  void loadKeywordHistories();
});

/** Calls the AI leads keyword optimization workflow. */
async function handleGenerate() {
  isGenerating.value = true;
  searchResult.value = null;

  try {
    const { data: result, error } = await optimizeLeadKeywords({
      requirement: form.requirement.trim()
    });

    if (error) {
      return;
    }

    aiResult.value = result;
    upsertHistoryRecord(result.historyRecord);
    applyKeywordHistoryRecord(result.historyRecord);
    message.success('生成完成');
  } finally {
    isGenerating.value = false;
  }
}

/** Runs keyword optimization, Serper search, and search-result decisions through the backend workflow. */
async function handleSearchCustomers() {
  isSearching.value = true;
  aiResult.value = null;
  searchResult.value = null;

  try {
    const { data: result, error } = await searchLeadCustomers({
      requirement: form.requirement.trim()
    });

    if (error) {
      return;
    }

    searchResult.value = result;
    message.success('搜索采集完成');
  } finally {
    isSearching.value = false;
  }
}

function handleClear() {
  form.requirement = '';
  aiResult.value = null;
  searchResult.value = null;
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

async function handleCopySearchResult() {
  if (!searchResultText.value) {
    return;
  }

  await navigator.clipboard.writeText(searchResultText.value);
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

function applyKeywordHistoryRecord(record: Api.AiLeads.KeywordHistoryRecord) {
  selectedHistoryId.value = record.id;
  form.requirement = record.requirement;
  aiResult.value = createAiResultFromKeywordHistory(record);
  editableKeywordPlan.value = cloneKeywordPlan(record.keywordPlan);
  editingKeywordPlanSnapshot.value = null;
  searchResult.value = null;
  isEditingResult.value = false;
}

function upsertHistoryRecord(record: Api.AiLeads.KeywordHistoryRecord) {
  const nextRecords = historyRecords.value.filter(item => item.id !== record.id);

  historyRecords.value = [record, ...nextRecords].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
</script>

<template>
  <NSpace vertical :size="12">
    <NCard :bordered="false" size="small" class="card-wrapper lead-search-card">
      <div class="card-title">
        <span>获客需求</span>
        <NTag size="small" type="info" :bordered="false">当前步骤：关键词优化</NTag>
      </div>

      <NForm :model="form" label-placement="left" label-width="72" size="small">
        <NGrid :x-gap="18" :y-gap="12" responsive="screen" item-responsive>
          <NGi span="24 l:18">
            <NFormItem label="获客需求">
              <NInput
                v-model:value="form.requirement"
                type="textarea"
                :autosize="{ minRows: 4, maxRows: 7 }"
                placeholder="描述你的产品、地区、目标市场、客户类型、产品优势等"
              />
            </NFormItem>
          </NGi>

          <NGi span="24 l:6" class="lead-actions">
            <NSpace :size="8">
              <NButton :disabled="isGenerating || isSearching || isHistorySaving" @click="handleClear">清空</NButton>
              <NButton
                :loading="isGenerating"
                :disabled="!canGenerate || isSearching || isHistorySaving"
                @click="handleGenerate"
              >
                优化关键词
              </NButton>
              <NButton
                type="primary"
                :loading="isSearching"
                :disabled="!canGenerate || isGenerating || isHistorySaving"
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
          <span>{{ searchResult ? '搜索采集结果' : '关键词优化结果' }}</span>
          <NSpace :size="8">
            <NButton size="small" secondary :loading="isHistoryLoading" @click="isHistoryDrawerVisible = true">
              <template #icon>
                <SvgIcon icon="material-symbols:history" />
              </template>
              历史
            </NButton>
            <template v-if="aiResult && (isSuperAdmin || keywordOptimizationViewModel)">
              <NTag size="small" type="success">{{ aiResult.finishReason }}</NTag>
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
                :disabled="!canSaveHistory"
                @click="handleSaveHistory"
              >
                <template #icon>
                  <SvgIcon icon="material-symbols:save-outline" />
                </template>
                保存
              </NButton>
              <NButton v-if="isEditingResult" size="small" :disabled="isHistorySaving" @click="handleCancelEdit">
                取消
              </NButton>
              <NButton size="small" :disabled="isEditingResult" @click="handleCopyResult">复制结果</NButton>
            </template>
          </NSpace>
          <NSpace v-if="searchResult" :size="8">
            <NTag size="small" type="info">请求 {{ searchResult.serperRequests.length }}</NTag>
            <NTag size="small" type="success">候选 {{ searchResult.candidates.length }}</NTag>
            <NButton size="small" @click="handleCopySearchResult">复制结果</NButton>
          </NSpace>
        </div>
      </template>

      <div v-if="searchResult" class="result-panel">
        <NSpace :size="8">
          <NTag type="info" :bordered="false">Serper 请求：{{ searchResult.serperRequests.length }}</NTag>
          <NTag type="warning" :bordered="false">决策：{{ searchResult.decisions.length }}</NTag>
          <NTag type="success" :bordered="false">候选：{{ searchResult.candidates.length }}</NTag>
          <NTag :bordered="false">{{ searchResult.stopReason }}</NTag>
        </NSpace>
        <NInput :value="searchResultText" type="textarea" readonly :autosize="{ minRows: 18, maxRows: 30 }" />
      </div>
      <div v-else-if="aiResult" class="result-panel">
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
      @select="handleSelectHistory"
    />
  </NSpace>
</template>

<style scoped>
.card-title,
.result-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-weight: 600;
}

.lead-search-card :deep(.n-card__content) {
  padding-bottom: 10px;
}

.lead-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.result-card :deep(.result-card-content) {
  min-height: 430px;
  display: flex;
  flex-direction: column;
}

.result-panel {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 12px;
}

.token-summary {
  align-self: flex-end;
}

.result-empty {
  flex: 1;
  justify-content: center;
}

@media (max-width: 640px) {
  .lead-actions {
    justify-content: flex-start;
  }
}
</style>
