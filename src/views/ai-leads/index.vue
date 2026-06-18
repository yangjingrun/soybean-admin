<script setup lang="ts">
import { computed, reactive, shallowRef } from 'vue';
import { useMessage } from 'naive-ui';
import { useAuthStore } from '@/store/modules/auth';
import { optimizeLeadKeywords, searchLeadCustomers } from '@/service/api';
import KeywordOptimizationResult from './modules/KeywordOptimizationResult.vue';
import {
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
const aiResult = shallowRef<Api.AiGateway.AiTextResult | null>(null);
const searchResult = shallowRef<Api.AiLeads.SearchOrchestrateResult | null>(null);

const canGenerate = computed(() => Boolean(form.requirement.trim()));
const isSuperAdmin = computed(() => authStore.userInfo.roles.includes('R_SUPER'));
const searchResultText = computed(() => (searchResult.value ? JSON.stringify(searchResult.value, null, 2) : ''));
const keywordOptimizationPlan = computed(() => {
  if (!aiResult.value?.text) {
    return null;
  }

  try {
    return parseKeywordOptimizationPlan(aiResult.value.text);
  } catch {
    return null;
  }
});
const keywordOptimizationViewModel = computed(() =>
  keywordOptimizationPlan.value
    ? createKeywordOptimizationViewModel(keywordOptimizationPlan.value, isSuperAdmin.value)
    : null
);

/** Calls the AI leads keyword optimization workflow. */
async function handleGenerate() {
  isGenerating.value = true;
  aiResult.value = null;
  searchResult.value = null;

  try {
    const { data: result, error } = await optimizeLeadKeywords({
      requirement: form.requirement.trim()
    });

    if (error) {
      return;
    }

    aiResult.value = result;
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
              <NButton :disabled="isGenerating || isSearching" @click="handleClear">清空</NButton>
              <NButton :loading="isGenerating" :disabled="!canGenerate || isSearching" @click="handleGenerate">
                优化关键词
              </NButton>
              <NButton
                type="primary"
                :loading="isSearching"
                :disabled="!canGenerate || isGenerating"
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
          <NSpace v-if="aiResult && (isSuperAdmin || keywordOptimizationViewModel)" :size="8">
            <NTag size="small" type="success">{{ aiResult.finishReason }}</NTag>
            <NButton size="small" @click="handleCopyResult">复制结果</NButton>
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
        <KeywordOptimizationResult v-if="keywordOptimizationViewModel" :view-model="keywordOptimizationViewModel" />
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
