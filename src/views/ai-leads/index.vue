<script setup lang="ts">
import { computed, reactive, shallowRef } from 'vue';
import { useMessage } from 'naive-ui';
import {
  aiPromptOptions,
  aiPromptSelectOptions,
  defaultAiModelConfigKey,
  defaultAiPromptKey,
  type AiPromptKey
} from '@/constants/ai-gateway';
import { generateAiText } from '@/service/api';

const message = useMessage();

const form = reactive({
  promptKey: defaultAiPromptKey,
  prompt: '帮我找沙特阿拉伯的 6204 bearing 进口商和经销商，输出产品关键词、目标客户画像、搜索词和筛选规则。'
});

const isGenerating = shallowRef(false);
const aiResult = shallowRef<Api.AiGateway.AiTextResult | null>(null);

const activePromptLabel = computed(
  () => aiPromptOptions.find(item => item.value === form.promptKey)?.label || 'AI获客'
);
const canGenerate = computed(() => Boolean(form.prompt.trim()));

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
}
</script>

<template>
  <NSpace vertical :size="16">
    <NCard :bordered="false" class="card-wrapper">
      <div class="ai-leads-header">
        <div>
          <p class="ai-leads-eyebrow text-primary">AI Leads</p>
          <h2 class="ai-leads-title">AI获客</h2>
          <p class="ai-leads-desc">选择固定业务步骤，提交本次获客需求。</p>
        </div>
        <NButton type="primary" :loading="isGenerating" :disabled="!canGenerate" @click="handleGenerate">
          开始生成
        </NButton>
      </div>
    </NCard>

    <NGrid :x-gap="16" :y-gap="16" responsive="screen" item-responsive>
      <NGi span="24 l:10">
        <NCard :bordered="false" class="card-wrapper">
          <NSpace vertical :size="16">
            <div class="panel-title">
              <NText strong>业务步骤</NText>
              <NTag size="small" type="info">{{ activePromptLabel }}</NTag>
            </div>
            <NSelect :value="form.promptKey" :options="aiPromptSelectOptions" @update:value="handlePromptKeyUpdate" />
            <NInput
              v-model:value="form.prompt"
              type="textarea"
              :autosize="{ minRows: 14, maxRows: 24 }"
              placeholder="输入本次获客需求"
            />
          </NSpace>
        </NCard>
      </NGi>

      <NGi span="24 l:14">
        <NCard :bordered="false" class="card-wrapper result-card">
          <NSpace v-if="aiResult" vertical :size="12">
            <div class="panel-title">
              <NText strong>生成结果</NText>
              <NTag size="small" type="success">{{ aiResult.finishReason }}</NTag>
            </div>
            <NInput :value="aiResult.text" type="textarea" readonly :autosize="{ minRows: 14, maxRows: 26 }" />
            <NText depth="3">
              Tokens：输入 {{ aiResult.usage.inputTokens ?? '-' }} / 输出 {{ aiResult.usage.outputTokens ?? '-' }} /
              总计
              {{ aiResult.usage.totalTokens ?? '-' }}
            </NText>
          </NSpace>
          <NEmpty v-else description="暂无生成结果" />
        </NCard>
      </NGi>
    </NGrid>
  </NSpace>
</template>

<style scoped>
.ai-leads-header,
.panel-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.ai-leads-eyebrow {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 600;
}

.ai-leads-title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
}

.ai-leads-desc {
  margin: 10px 0 0;
  color: var(--n-text-color-3);
}

.result-card {
  min-height: 100%;
}

@media (max-width: 640px) {
  .ai-leads-header,
  .panel-title {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
