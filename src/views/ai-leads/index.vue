<script setup lang="ts">
import { computed, reactive, shallowRef } from 'vue';
import { useMessage } from 'naive-ui';
import { optimizeLeadKeywords } from '@/service/api';

const message = useMessage();

const form = reactive({
  requirement:
    '我是中国河北卖轴承的，主打 6204 bearing，想找沙特阿拉伯进口商和经销商，产品优势是供货稳定、价格有竞争力。'
});

const isGenerating = shallowRef(false);
const aiResult = shallowRef<Api.AiGateway.AiTextResult | null>(null);

const canGenerate = computed(() => Boolean(form.requirement.trim()));

/** Calls the AI leads keyword optimization workflow. */
async function handleGenerate() {
  isGenerating.value = true;
  aiResult.value = null;

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

function handleClear() {
  form.requirement = '';
  aiResult.value = null;
}

async function handleCopyResult() {
  if (!aiResult.value?.text) {
    return;
  }

  await navigator.clipboard.writeText(aiResult.value.text);
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
          <NGi span="24 l:19">
            <NFormItem label="获客需求">
              <NInput
                v-model:value="form.requirement"
                type="textarea"
                :autosize="{ minRows: 4, maxRows: 7 }"
                placeholder="描述你的产品、地区、目标市场、客户类型、产品优势等"
              />
            </NFormItem>
          </NGi>

          <NGi span="24 l:5" class="lead-actions">
            <NSpace :size="8">
              <NButton :disabled="isGenerating" @click="handleClear">清空</NButton>
              <NButton type="primary" :loading="isGenerating" :disabled="!canGenerate" @click="handleGenerate">
                优化关键词
              </NButton>
            </NSpace>
          </NGi>
        </NGrid>
      </NForm>
    </NCard>

    <NCard :bordered="false" size="small" class="card-wrapper result-card" content-class="result-card-content">
      <template #header>
        <div class="result-header">
          <span>关键词优化结果</span>
          <NSpace v-if="aiResult" :size="8">
            <NTag size="small" type="success">{{ aiResult.finishReason }}</NTag>
            <NButton size="small" @click="handleCopyResult">复制结果</NButton>
          </NSpace>
        </div>
      </template>

      <div v-if="aiResult" class="result-panel">
        <NInput :value="aiResult.text" type="textarea" readonly :autosize="{ minRows: 16, maxRows: 28 }" />
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
