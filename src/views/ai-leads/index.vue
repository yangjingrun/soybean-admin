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
  <NSpace vertical :size="12" class="ai-leads-page">
    <NCard :bordered="false" size="small" class="card-wrapper">
      <div class="section-title">
        <NText strong>业务条件</NText>
        <NTag size="small" type="info">{{ isPromptLoading ? '加载中' : activePromptLabel }}</NTag>
      </div>

      <NForm :model="form" label-placement="left" label-width="72" size="small" class="lead-form">
        <NGrid :x-gap="16" :y-gap="12" responsive="screen" item-responsive>
          <NGi span="24 m:12 l:8">
            <NFormItem label="业务步骤">
              <NSelect :value="form.promptKey" :options="aiPromptSelectOptions" @update:value="handlePromptKeyUpdate" />
            </NFormItem>
          </NGi>

          <NGi span="24 m:12 l:16" class="form-actions">
            <NButton type="primary" :loading="isGenerating" :disabled="!canGenerate" @click="handleGenerate">
              开始生成
            </NButton>
          </NGi>

          <NGi span="24">
            <NFormItem label="获客需求">
              <NInput
                v-model:value="form.prompt"
                type="textarea"
                :autosize="{ minRows: 8, maxRows: 14 }"
                placeholder="输入本次获客需求"
              />
            </NFormItem>
          </NGi>
        </NGrid>
      </NForm>
    </NCard>

    <NCard :bordered="false" size="small" class="card-wrapper result-card">
      <template #header>
        <div class="section-title">
          <NText strong>生成结果</NText>
          <NTag v-if="aiResult" size="small" type="success">{{ aiResult.finishReason }}</NTag>
        </div>
      </template>

      <NSpace v-if="aiResult" vertical :size="12">
        <NInput :value="aiResult.text" type="textarea" readonly :autosize="{ minRows: 14, maxRows: 26 }" />
        <NText depth="3">
          Tokens：输入 {{ aiResult.usage.inputTokens ?? '-' }} / 输出 {{ aiResult.usage.outputTokens ?? '-' }} / 总计
          {{ aiResult.usage.totalTokens ?? '-' }}
        </NText>
      </NSpace>
      <NEmpty v-else description="暂无生成结果" class="result-empty" />
    </NCard>
  </NSpace>
</template>

<style scoped>
.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.lead-form {
  margin-top: 12px;
}

.form-actions {
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
}

.result-empty {
  padding-top: 64px;
}

.result-card {
  min-height: 360px;
}

@media (max-width: 640px) {
  .section-title {
    align-items: flex-start;
    flex-direction: column;
  }

  .form-actions {
    justify-content: flex-start;
  }
}
</style>
