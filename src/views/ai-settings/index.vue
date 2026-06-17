<script setup lang="ts">
import { computed, onMounted, reactive, shallowRef } from 'vue';
import dayjs from 'dayjs';
import { useMessage } from 'naive-ui';
import { useI18n } from 'vue-i18n';
import { defaultAiModelConfigKey } from '@/constants/ai-gateway';
import { generateAiText, getAiModelConfig, saveAiModelConfig } from '@/service/api';

const message = useMessage();
const { t } = useI18n();

const providerOptions = computed(() => [
  { label: t('page.aiSettings.providers.openrouter'), value: 'openrouter' },
  { label: t('page.aiSettings.providers.custom'), value: 'custom' },
  { label: t('page.aiSettings.providers.openai'), value: 'openai' },
  { label: t('page.aiSettings.providers.deepseek'), value: 'deepseek' },
  { label: t('page.aiSettings.providers.dashscope'), value: 'dashscope' }
]);

const modelForm = reactive<Api.AiGateway.SaveModelConfigPayload>({
  configKey: defaultAiModelConfigKey,
  title: '默认模型',
  providerName: 'openrouter',
  apiBase: 'https://openrouter.ai/api/v1',
  apiKey: '',
  model: 'openai/gpt-4o-mini'
});

const isModelLoading = shallowRef(false);
const isModelSaving = shallowRef(false);
const isModelTesting = shallowRef(false);
const modelUpdatedAt = shallowRef('');
const modelTestResult = shallowRef<Api.AiGateway.AiTextResult | null>(null);

const canSaveModel = computed(() =>
  Boolean(
    modelForm.providerName.trim() && modelForm.apiBase.trim() && modelForm.apiKey.trim() && modelForm.model.trim()
  )
);
const formattedModelUpdatedAt = computed(() =>
  modelUpdatedAt.value
    ? dayjs(modelUpdatedAt.value).format('YYYY-MM-DD HH:mm:ss')
    : t('page.aiSettings.status.notSaved')
);

onMounted(() => {
  void handleLoadModelConfig(false);
});

/** Loads the default backend model config into the settings form. */
async function handleLoadModelConfig(showMessage = true) {
  isModelLoading.value = true;

  try {
    const { data: record, error } = await getAiModelConfig(defaultAiModelConfigKey);

    if (error) {
      return;
    }

    Object.assign(modelForm, {
      configKey: record.configKey,
      title: record.title,
      providerName: record.providerName,
      apiBase: record.apiBase,
      apiKey: record.apiKey,
      model: record.model
    });
    modelUpdatedAt.value = record.updatedAt;
    modelTestResult.value = null;

    if (showMessage) {
      message.success(t('page.aiSettings.messages.loaded'));
    }
  } finally {
    isModelLoading.value = false;
  }
}

/** Saves the backend model config used by AI workflows. */
async function handleSaveModelConfig() {
  isModelSaving.value = true;

  try {
    const { data: record, error } = await saveAiModelConfig({
      configKey: defaultAiModelConfigKey,
      title: modelForm.title.trim(),
      providerName: modelForm.providerName.trim(),
      apiBase: modelForm.apiBase.trim(),
      apiKey: modelForm.apiKey.trim(),
      model: modelForm.model.trim()
    });

    if (error) {
      return;
    }

    modelUpdatedAt.value = record.updatedAt;
    modelTestResult.value = null;
    message.success(t('page.aiSettings.messages.saved'));
  } finally {
    isModelSaving.value = false;
  }
}

/** Copies the current model service key for quick reuse. */
async function handleCopyApiKey() {
  const apiKey = modelForm.apiKey.trim();

  if (!apiKey) {
    return;
  }

  await navigator.clipboard.writeText(apiKey);
  message.success(t('page.aiSettings.messages.apiKeyCopied'));
}

/** Sends one lightweight message with the current model config. */
async function handleTestModelConfig() {
  isModelTesting.value = true;
  modelTestResult.value = null;

  try {
    const { data: result, error } = await generateAiText({
      providerName: modelForm.providerName.trim(),
      apiBase: modelForm.apiBase.trim(),
      apiKey: modelForm.apiKey.trim(),
      model: modelForm.model.trim(),
      systemPrompt: t('page.aiSettings.test.systemPrompt'),
      prompt: t('page.aiSettings.test.prompt'),
      temperature: 0,
      maxOutputTokens: 20
    });

    if (error) {
      return;
    }

    modelTestResult.value = result;
    message.success(t('page.aiSettings.messages.testPassed'));
  } finally {
    isModelTesting.value = false;
  }
}
</script>

<template>
  <NSpace vertical :size="12">
    <NCard :bordered="false" class="card-wrapper">
      <NSpace vertical :size="14">
        <div class="page-heading">
          <div>
            <h2 class="page-title">{{ $t('page.aiSettings.title') }}</h2>
            <p class="panel-desc">{{ $t('page.aiSettings.description') }}</p>
          </div>
          <NTag v-if="modelTestResult" type="success" :bordered="false">
            {{ $t('page.aiSettings.status.connected') }}
          </NTag>
          <NTag v-else-if="modelUpdatedAt" type="warning" :bordered="false">
            {{ $t('page.aiSettings.status.savedUntested') }}
          </NTag>
          <NTag v-else :bordered="false">{{ $t('page.aiSettings.status.pending') }}</NTag>
        </div>

        <NForm :model="modelForm" label-placement="top" size="small">
          <NFormItem :label="$t('page.aiSettings.form.title')">
            <NInput v-model:value="modelForm.title" :placeholder="$t('page.aiSettings.placeholders.title')" />
          </NFormItem>
          <NGrid :x-gap="12" responsive="screen" item-responsive>
            <NGi span="24 m:12">
              <NFormItem :label="$t('page.aiSettings.form.provider')">
                <NSelect v-model:value="modelForm.providerName" :options="providerOptions" />
              </NFormItem>
            </NGi>
            <NGi span="24 m:12">
              <NFormItem :label="$t('page.aiSettings.form.model')">
                <NInput v-model:value="modelForm.model" :placeholder="$t('page.aiSettings.placeholders.model')" />
              </NFormItem>
            </NGi>
          </NGrid>
          <NFormItem :label="$t('page.aiSettings.form.apiBase')">
            <NInput v-model:value="modelForm.apiBase" :placeholder="$t('page.aiSettings.placeholders.apiBase')" />
          </NFormItem>
          <NFormItem :label="$t('page.aiSettings.form.apiKey')">
            <NInputGroup>
              <NInput
                v-model:value="modelForm.apiKey"
                type="password"
                show-password-on="click"
                :placeholder="$t('page.aiSettings.placeholders.apiKey')"
              />
              <NTooltip>
                <template #trigger>
                  <NButton
                    class="api-key-copy-button"
                    :aria-label="$t('page.aiSettings.actions.copyApiKey')"
                    :disabled="!modelForm.apiKey.trim()"
                    @click="handleCopyApiKey"
                  >
                    <template #icon>
                      <SvgIcon icon="material-symbols:content-copy-outline" />
                    </template>
                  </NButton>
                </template>
                {{ $t('page.aiSettings.actions.copyApiKey') }}
              </NTooltip>
            </NInputGroup>
          </NFormItem>
        </NForm>

        <NAlert v-if="modelTestResult" type="success" :bordered="false">
          <NSpace vertical :size="4">
            <NText strong>{{ $t('page.aiSettings.status.testResult') }}：{{ modelTestResult.text }}</NText>
            <NText depth="3">
              {{ $t('page.aiSettings.status.tokens') }}：{{ $t('page.aiSettings.status.input') }}
              {{ modelTestResult.usage.inputTokens ?? '-' }} / {{ $t('page.aiSettings.status.output') }}
              {{ modelTestResult.usage.outputTokens ?? '-' }}
            </NText>
          </NSpace>
        </NAlert>

        <div class="form-footer">
          <NText depth="3" class="updated-time">
            {{ $t('page.aiSettings.status.title') }}：{{ formattedModelUpdatedAt }}
          </NText>
          <NSpace :size="8">
            <NButton size="small" :loading="isModelLoading" @click="handleLoadModelConfig()">
              {{ $t('page.aiSettings.actions.reload') }}
            </NButton>
            <NButton size="small" :loading="isModelTesting" :disabled="!canSaveModel" @click="handleTestModelConfig">
              {{ $t('page.aiSettings.actions.test') }}
            </NButton>
            <NButton
              size="small"
              type="primary"
              :loading="isModelSaving"
              :disabled="!canSaveModel"
              @click="handleSaveModelConfig"
            >
              {{ $t('page.aiSettings.actions.save') }}
            </NButton>
          </NSpace>
        </div>
      </NSpace>
    </NCard>
  </NSpace>
</template>

<style scoped>
.page-heading,
.form-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.page-title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  line-height: 1.35;
}

.panel-desc {
  margin: 6px 0 0;
  color: var(--n-text-color-3);
}

.panel-desc {
  font-size: 13px;
}

.api-key-copy-button {
  width: 34px;
}

.updated-time {
  font-size: 12px;
}

@media (max-width: 640px) {
  .page-heading,
  .form-footer {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
