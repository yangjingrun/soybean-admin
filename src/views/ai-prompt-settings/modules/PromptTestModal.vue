<script setup lang="ts">
import { computed, reactive, shallowRef } from 'vue';
import { useMessage } from 'naive-ui';
import { useI18n } from 'vue-i18n';
import { generateAiText } from '@/service/api';

defineOptions({
  name: 'PromptTestModal'
});

interface Props {
  promptTitle: string;
  systemPrompt: string;
}

const props = defineProps<Props>();

const show = defineModel<boolean>('show', { required: true });

const message = useMessage();
const { t } = useI18n();

const form = reactive({
  prompt: '我是中国河北卖轴承的，主打 6204 bearing，想找沙特阿拉伯进口商和经销商，产品优势是供货稳定、价格有竞争力。'
});

const isTesting = shallowRef(false);
const testResult = shallowRef<Api.AiGateway.AiTextResult | null>(null);

const canRunTest = computed(() => Boolean(props.systemPrompt.trim() && form.prompt.trim()));
const testTitle = computed(() => `${t('page.aiPromptSettings.test.title')}：${props.promptTitle}`);

/** Runs the current editor prompt against one test input without saving it. */
async function handleRunPromptTest() {
  const systemPrompt = props.systemPrompt.trim();
  const prompt = form.prompt.trim();

  if (!systemPrompt || !prompt) {
    return;
  }

  isTesting.value = true;
  testResult.value = null;

  try {
    const { data: result, error } = await generateAiText({
      systemPrompt,
      prompt
    });

    if (error) {
      return;
    }

    testResult.value = result;
    message.success(t('page.aiPromptSettings.messages.testPassed'));
  } finally {
    isTesting.value = false;
  }
}

function handleClearTestInput() {
  form.prompt = '';
  testResult.value = null;
}

async function handleCopyTestResult() {
  if (!testResult.value?.text) {
    return;
  }

  await navigator.clipboard.writeText(testResult.value.text);
  message.success(t('page.aiPromptSettings.messages.testCopied'));
}
</script>

<template>
  <NModal
    v-model:show="show"
    preset="card"
    :title="testTitle"
    :style="{ width: '820px', maxWidth: 'calc(100vw - 32px)' }"
    :bordered="false"
  >
    <NSpace vertical :size="14">
      <NAlert type="info" :bordered="false">
        {{ $t('page.aiPromptSettings.test.tip') }}
      </NAlert>

      <NForm :model="form" label-placement="top" size="small">
        <NFormItem :label="$t('page.aiPromptSettings.test.inputLabel')">
          <NInput
            v-model:value="form.prompt"
            type="textarea"
            :autosize="{ minRows: 5, maxRows: 8 }"
            :placeholder="$t('page.aiPromptSettings.test.inputPlaceholder')"
          />
        </NFormItem>
      </NForm>

      <NCard :bordered="false" size="small" class="test-result-card" content-class="test-result-content">
        <template #header>
          <div class="test-result-header">
            <span>{{ $t('page.aiPromptSettings.test.resultTitle') }}</span>
            <NSpace v-if="testResult" :size="8">
              <NTag size="small" type="success">{{ testResult.finishReason }}</NTag>
              <NButton size="small" @click="handleCopyTestResult">
                {{ $t('page.aiPromptSettings.actions.copyResult') }}
              </NButton>
            </NSpace>
          </div>
        </template>

        <div v-if="testResult" class="test-result-panel">
          <NInput :value="testResult.text" type="textarea" readonly :autosize="{ minRows: 10, maxRows: 16 }" />
          <NText depth="3" class="token-summary">
            {{ $t('page.aiPromptSettings.test.tokens') }}：{{ $t('page.aiPromptSettings.test.inputTokens') }}
            {{ testResult.usage.inputTokens ?? '-' }} / {{ $t('page.aiPromptSettings.test.outputTokens') }}
            {{ testResult.usage.outputTokens ?? '-' }} / {{ $t('page.aiPromptSettings.test.totalTokens') }}
            {{ testResult.usage.totalTokens ?? '-' }}
          </NText>
        </div>
        <NEmpty v-else :description="$t('page.aiPromptSettings.test.empty')" class="test-result-empty" />
      </NCard>
    </NSpace>

    <template #footer>
      <div class="test-footer">
        <NButton :disabled="isTesting" @click="handleClearTestInput">
          {{ $t('page.aiPromptSettings.actions.clearTest') }}
        </NButton>
        <NSpace :size="8">
          <NButton @click="show = false">{{ $t('common.close') }}</NButton>
          <NButton type="primary" :loading="isTesting" :disabled="!canRunTest" @click="handleRunPromptTest">
            {{ $t('page.aiPromptSettings.actions.runTest') }}
          </NButton>
        </NSpace>
      </div>
    </template>
  </NModal>
</template>

<style scoped>
.test-result-card :deep(.test-result-content) {
  min-height: 240px;
  display: flex;
  flex-direction: column;
}

.test-result-header,
.test-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.test-result-panel {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 10px;
}

.token-summary {
  align-self: flex-end;
}

.test-result-empty {
  flex: 1;
  justify-content: center;
}

@media (max-width: 640px) {
  .test-result-header,
  .test-footer {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
