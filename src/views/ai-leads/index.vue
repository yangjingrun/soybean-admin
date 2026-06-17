<script setup lang="ts">
import { computed, onMounted, reactive, shallowRef } from 'vue';
import { useMessage } from 'naive-ui';
import {
  aiPromptOptions,
  aiPromptSelectOptions,
  defaultAiModelConfigKey,
  defaultAiPromptKey,
  type AiPromptKey
} from '@/constants/ai-gateway';
import { generateAiText, getAiPrompt } from '@/service/api';

const message = useMessage();

const form = reactive({
  promptKey: defaultAiPromptKey,
  prompt: '帮我找沙特阿拉伯的 6204 bearing 进口商和经销商，输出产品关键词、目标客户画像、搜索词和筛选规则。'
});

const isGenerating = shallowRef(false);
const isPromptLoading = shallowRef(false);
const aiResult = shallowRef<Api.AiGateway.AiTextResult | null>(null);
const activePrompt = shallowRef<Api.AiGateway.AiPromptRecord | null>(null);

const activePromptLabel = computed(
  () => activePrompt.value?.title || aiPromptOptions.find(item => item.value === form.promptKey)?.label || 'AI获客'
);
const canGenerate = computed(() => Boolean(form.prompt.trim()));

onMounted(() => {
  void loadFixedPrompt(form.promptKey);
});

/** Reads the fixed system prompt from the backend REST API. */
async function loadFixedPrompt(promptKey: AiPromptKey) {
  isPromptLoading.value = true;

  try {
    const { data: prompt, error } = await getAiPrompt(promptKey);

    if (error) {
      return;
    }

    activePrompt.value = prompt;
  } finally {
    isPromptLoading.value = false;
  }
}

/** Calls the backend AI gateway with fixed prompt and model config keys. */
async function handleGenerate() {
  isGenerating.value = true;
  aiResult.value = null;

  try {
    const { data: result, error } = await generateAiText({
      modelConfigKey: defaultAiModelConfigKey,
      promptKey: form.promptKey,
      prompt: form.prompt.trim()
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

function handlePromptKeyUpdate(value: string) {
  form.promptKey = value as AiPromptKey;
  void loadFixedPrompt(form.promptKey);
}
</script>

<template>
  <NSpace vertical :size="12">
    <NCard :bordered="false" size="small" class="card-wrapper lead-search-card">
      <div class="card-title">获客条件</div>

      <NForm :model="form" label-placement="left" label-width="72" size="small">
        <NGrid :x-gap="18" :y-gap="12" responsive="screen" item-responsive>
          <NGi span="24 m:12 l:6">
            <NFormItem label="业务步骤">
              <NSelect :value="form.promptKey" :options="aiPromptSelectOptions" @update:value="handlePromptKeyUpdate" />
            </NFormItem>
          </NGi>

          <NGi span="24 m:12 l:14">
            <NFormItem label="获客需求">
              <NInput
                v-model:value="form.prompt"
                type="textarea"
                :autosize="{ minRows: 2, maxRows: 4 }"
                placeholder="输入本次获客需求"
              />
            </NFormItem>
          </NGi>

          <NGi span="24 l:4" class="lead-actions">
            <NButton type="primary" :loading="isGenerating" :disabled="!canGenerate" @click="handleGenerate">
              开始生成
            </NButton>
          </NGi>
        </NGrid>
      </NForm>
    </NCard>

    <NCard :bordered="false" size="small" class="card-wrapper result-card" content-class="result-card-content">
      <template #header>
        <div class="result-header">
          <span>生成结果</span>
          <NTag v-if="aiResult" size="small" type="success">{{ aiResult.finishReason }}</NTag>
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
