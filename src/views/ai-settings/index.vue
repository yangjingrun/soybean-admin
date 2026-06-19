<script setup lang="ts">
import { computed, onMounted, reactive, shallowRef } from 'vue';
import dayjs from 'dayjs';
import { useMessage } from 'naive-ui';
import { useI18n } from 'vue-i18n';
import { defaultAiModelConfigKey, defaultHunterConfigKey, defaultSerperConfigKey } from '@/constants/ai-gateway';
import {
  fetchAiLeadQueueConfig,
  generateAiText,
  getAiModelConfig,
  getHunterConfig,
  getSerperConfig,
  saveAiLeadQueueConfig,
  saveAiModelConfig,
  saveHunterConfig,
  saveSerperConfig,
  testHunterConfig,
  testSerperConfig
} from '@/service/api';

const message = useMessage();
const { t } = useI18n();

const providerOptions = computed(() => [
  { label: t('page.aiSettings.providers.openrouter'), value: 'openrouter' },
  { label: t('page.aiSettings.providers.custom'), value: 'custom' },
  { label: t('page.aiSettings.providers.openai'), value: 'openai' },
  { label: t('page.aiSettings.providers.deepseek'), value: 'deepseek' },
  { label: t('page.aiSettings.providers.dashscope'), value: 'dashscope' }
]);

interface QueueConfigForm {
  workerConcurrency: number | null;
}

const modelForm = reactive<Api.AiGateway.SaveModelConfigPayload>({
  configKey: defaultAiModelConfigKey,
  title: '默认模型',
  providerName: 'openrouter',
  apiBase: 'https://openrouter.ai/api/v1',
  apiKey: '',
  model: 'openai/gpt-4o-mini'
});
const serperForm = reactive<Api.AiGateway.SaveSerperConfigPayload>({
  configKey: defaultSerperConfigKey,
  title: 'Serper 搜索',
  apiBase: 'https://google.serper.dev',
  apiKey: ''
});
const hunterForm = reactive<Api.AiGateway.SaveHunterConfigPayload>({
  configKey: defaultHunterConfigKey,
  title: 'Hunter 邮箱补全',
  apiBase: 'https://api.hunter.io/v2',
  apiKey: ''
});
const queueConfigForm = reactive<QueueConfigForm>({
  workerConcurrency: 2
});

const isModelLoading = shallowRef(false);
const isModelSaving = shallowRef(false);
const isModelTesting = shallowRef(false);
const isSerperLoading = shallowRef(false);
const isSerperSaving = shallowRef(false);
const isSerperTesting = shallowRef(false);
const isHunterLoading = shallowRef(false);
const isHunterSaving = shallowRef(false);
const isHunterTesting = shallowRef(false);
const isQueueConfigLoading = shallowRef(false);
const isQueueConfigSaving = shallowRef(false);
const modelUpdatedAt = shallowRef('');
const serperUpdatedAt = shallowRef('');
const hunterUpdatedAt = shallowRef('');
const queueConfigUpdatedAt = shallowRef<string | null>(null);
const modelTestResult = shallowRef<Api.AiGateway.AiTextResult | null>(null);
const serperTestResult = shallowRef<Api.AiGateway.SerperTestResult | null>(null);
const hunterTestResult = shallowRef<Api.AiGateway.HunterTestResult | null>(null);

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
const canSaveSerper = computed(() =>
  Boolean(serperForm.title.trim() && serperForm.apiBase.trim() && serperForm.apiKey.trim())
);
const formattedSerperUpdatedAt = computed(() =>
  serperUpdatedAt.value
    ? dayjs(serperUpdatedAt.value).format('YYYY-MM-DD HH:mm:ss')
    : t('page.aiSettings.status.notSaved')
);
const canSaveHunter = computed(() =>
  Boolean(hunterForm.title.trim() && hunterForm.apiBase.trim() && hunterForm.apiKey.trim())
);
const formattedHunterUpdatedAt = computed(() =>
  hunterUpdatedAt.value
    ? dayjs(hunterUpdatedAt.value).format('YYYY-MM-DD HH:mm:ss')
    : t('page.aiSettings.status.notSaved')
);
const canSaveQueueConfig = computed(() => isValidWorkerConcurrency(queueConfigForm.workerConcurrency));
const formattedQueueConfigUpdatedAt = computed(() => {
  const updatedAt = queueConfigUpdatedAt.value;

  return isSavedUpdatedAt(updatedAt)
    ? dayjs(updatedAt).format('YYYY-MM-DD HH:mm:ss')
    : t('page.aiSettings.status.notSaved');
});

onMounted(() => {
  void handleLoadModelConfig(false);
  void handleLoadSerperConfig(false);
  void handleLoadHunterConfig(false);
  void handleLoadQueueConfig(false);
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

/** Loads the default Serper config into the settings form. */
async function handleLoadSerperConfig(showMessage = true) {
  isSerperLoading.value = true;

  try {
    const { data: record, error } = await getSerperConfig(defaultSerperConfigKey);

    if (error) {
      return;
    }

    Object.assign(serperForm, {
      configKey: record.configKey,
      title: record.title,
      apiBase: record.apiBase,
      apiKey: record.apiKey
    });
    serperUpdatedAt.value = record.updatedAt;
    serperTestResult.value = null;

    if (showMessage) {
      message.success(t('page.aiSettings.serper.loaded'));
    }
  } finally {
    isSerperLoading.value = false;
  }
}

/** Saves the Serper config used by AI leads search orchestration. */
async function handleSaveSerperConfig() {
  isSerperSaving.value = true;

  try {
    const { data: record, error } = await saveSerperConfig({
      configKey: defaultSerperConfigKey,
      title: serperForm.title.trim(),
      apiBase: serperForm.apiBase.trim(),
      apiKey: serperForm.apiKey.trim()
    });

    if (error) {
      return;
    }

    serperUpdatedAt.value = record.updatedAt;
    serperTestResult.value = null;
    message.success(t('page.aiSettings.serper.saved'));
  } finally {
    isSerperSaving.value = false;
  }
}

/** Loads the default Hunter config into the settings form. */
async function handleLoadHunterConfig(showMessage = true) {
  isHunterLoading.value = true;

  try {
    const { data: record, error } = await getHunterConfig(defaultHunterConfigKey);

    if (error) {
      return;
    }

    Object.assign(hunterForm, {
      configKey: record.configKey,
      title: record.title,
      apiBase: record.apiBase,
      apiKey: record.apiKey
    });
    hunterUpdatedAt.value = record.updatedAt;
    hunterTestResult.value = null;

    if (showMessage) {
      message.success(t('page.aiSettings.hunter.loaded'));
    }
  } finally {
    isHunterLoading.value = false;
  }
}

/** Saves the Hunter config used by CRM Domain Search enrichment. */
async function handleSaveHunterConfig() {
  isHunterSaving.value = true;

  try {
    const { data: record, error } = await saveHunterConfig({
      configKey: defaultHunterConfigKey,
      title: hunterForm.title.trim(),
      apiBase: hunterForm.apiBase.trim(),
      apiKey: hunterForm.apiKey.trim()
    });

    if (error) {
      return;
    }

    hunterUpdatedAt.value = record.updatedAt;
    hunterTestResult.value = null;
    message.success(t('page.aiSettings.hunter.saved'));
  } finally {
    isHunterSaving.value = false;
  }
}

/** Loads the global AI leads BullMQ worker concurrency. */
async function handleLoadQueueConfig(showMessage = true) {
  isQueueConfigLoading.value = true;

  try {
    const { data: record, error } = await fetchAiLeadQueueConfig();

    if (error) {
      return;
    }

    queueConfigForm.workerConcurrency = record.workerConcurrency;
    queueConfigUpdatedAt.value = record.updatedAt;

    if (showMessage) {
      message.success('AI 获客任务配置已加载');
    }
  } finally {
    isQueueConfigLoading.value = false;
  }
}

/** Saves the global AI leads BullMQ worker concurrency. */
async function handleSaveQueueConfig() {
  const workerConcurrency = queueConfigForm.workerConcurrency;

  if (!isValidWorkerConcurrency(workerConcurrency)) {
    message.warning('请输入 1-10 的并发数');
    return;
  }

  isQueueConfigSaving.value = true;

  try {
    const { data: record, error } = await saveAiLeadQueueConfig({
      workerConcurrency
    });

    if (error) {
      return;
    }

    queueConfigForm.workerConcurrency = record.workerConcurrency;
    queueConfigUpdatedAt.value = record.updatedAt;
    message.success('AI 获客任务配置已保存');
  } finally {
    isQueueConfigSaving.value = false;
  }
}

function isValidWorkerConcurrency(value: number | null): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 10;
}

/** Checks whether a saved timestamp should be displayed to users. */
function isSavedUpdatedAt(value: string | null): value is string {
  return Boolean(value && dayjs(value).valueOf() > 0);
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

/** Copies the current Serper key for quick reuse. */
async function handleCopySerperApiKey() {
  const apiKey = serperForm.apiKey.trim();

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

/** Sends one lightweight request with the current Serper config. */
async function handleTestSerperConfig() {
  isSerperTesting.value = true;
  serperTestResult.value = null;

  try {
    const { data: result, error } = await testSerperConfig({
      configKey: defaultSerperConfigKey,
      title: serperForm.title.trim(),
      apiBase: serperForm.apiBase.trim(),
      apiKey: serperForm.apiKey.trim()
    });

    if (error) {
      return;
    }

    serperTestResult.value = result;
    message.success(t('page.aiSettings.serper.testPassed'));
  } finally {
    isSerperTesting.value = false;
  }
}

/** Sends one lightweight Domain Search request with the current Hunter config. */
async function handleTestHunterConfig() {
  isHunterTesting.value = true;
  hunterTestResult.value = null;

  try {
    const { data: result, error } = await testHunterConfig({
      configKey: defaultHunterConfigKey,
      title: hunterForm.title.trim(),
      apiBase: hunterForm.apiBase.trim(),
      apiKey: hunterForm.apiKey.trim()
    });

    if (error) {
      return;
    }

    hunterTestResult.value = result;
    message.success(t('page.aiSettings.hunter.testPassed'));
  } finally {
    isHunterTesting.value = false;
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

    <NCard :bordered="false" class="card-wrapper">
      <NSpace vertical :size="14">
        <div class="page-heading">
          <div>
            <h2 class="page-title">{{ $t('page.aiSettings.serper.title') }}</h2>
            <p class="panel-desc">{{ $t('page.aiSettings.serper.description') }}</p>
          </div>
          <NTag v-if="serperTestResult" type="success" :bordered="false">
            {{ $t('page.aiSettings.status.connected') }}
          </NTag>
          <NTag v-else-if="serperUpdatedAt" type="warning" :bordered="false">
            {{ $t('page.aiSettings.status.savedUntested') }}
          </NTag>
          <NTag v-else :bordered="false">{{ $t('page.aiSettings.status.pending') }}</NTag>
        </div>

        <NForm :model="serperForm" label-placement="top" size="small">
          <NFormItem :label="$t('page.aiSettings.form.title')">
            <NInput v-model:value="serperForm.title" :placeholder="$t('page.aiSettings.serper.title')" />
          </NFormItem>
          <NFormItem :label="$t('page.aiSettings.form.apiBase')">
            <NInput v-model:value="serperForm.apiBase" placeholder="https://google.serper.dev" />
          </NFormItem>
          <NFormItem :label="$t('page.aiSettings.form.apiKey')">
            <NInputGroup>
              <NInput
                v-model:value="serperForm.apiKey"
                type="password"
                show-password-on="click"
                :placeholder="$t('page.aiSettings.serper.apiKeyPlaceholder')"
              />
              <NTooltip>
                <template #trigger>
                  <NButton
                    class="api-key-copy-button"
                    :aria-label="$t('page.aiSettings.actions.copyApiKey')"
                    :disabled="!serperForm.apiKey.trim()"
                    @click="handleCopySerperApiKey"
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

        <NAlert v-if="serperTestResult" type="success" :bordered="false">
          <NText strong>{{ $t('page.aiSettings.serper.testResult') }}：OK</NText>
        </NAlert>

        <div class="form-footer">
          <NText depth="3" class="updated-time">
            {{ $t('page.aiSettings.status.title') }}：{{ formattedSerperUpdatedAt }}
          </NText>
          <NSpace :size="8">
            <NButton size="small" :loading="isSerperLoading" @click="handleLoadSerperConfig()">
              {{ $t('page.aiSettings.actions.reload') }}
            </NButton>
            <NButton size="small" :loading="isSerperTesting" :disabled="!canSaveSerper" @click="handleTestSerperConfig">
              {{ $t('page.aiSettings.actions.test') }}
            </NButton>
            <NButton
              size="small"
              type="primary"
              :loading="isSerperSaving"
              :disabled="!canSaveSerper"
              @click="handleSaveSerperConfig"
            >
              {{ $t('page.aiSettings.serper.save') }}
            </NButton>
          </NSpace>
        </div>
      </NSpace>
    </NCard>

    <NCard :bordered="false" class="card-wrapper">
      <NSpace vertical :size="14">
        <div class="page-heading">
          <div>
            <h2 class="page-title">{{ $t('page.aiSettings.hunter.title') }}</h2>
            <p class="panel-desc">{{ $t('page.aiSettings.hunter.description') }}</p>
          </div>
          <NTag v-if="hunterTestResult" type="success" :bordered="false">
            {{ $t('page.aiSettings.status.connected') }}
          </NTag>
          <NTag v-else-if="hunterUpdatedAt" type="warning" :bordered="false">
            {{ $t('page.aiSettings.status.savedUntested') }}
          </NTag>
          <NTag v-else :bordered="false">{{ $t('page.aiSettings.status.pending') }}</NTag>
        </div>

        <NForm :model="hunterForm" label-placement="top" size="small">
          <NFormItem :label="$t('page.aiSettings.form.title')">
            <NInput v-model:value="hunterForm.title" :placeholder="$t('page.aiSettings.hunter.title')" />
          </NFormItem>
          <NFormItem :label="$t('page.aiSettings.form.apiBase')">
            <NInput v-model:value="hunterForm.apiBase" placeholder="https://api.hunter.io/v2" />
          </NFormItem>
          <NFormItem :label="$t('page.aiSettings.form.apiKey')">
            <NInput
              v-model:value="hunterForm.apiKey"
              type="password"
              :placeholder="$t('page.aiSettings.hunter.apiKeyPlaceholder')"
            />
          </NFormItem>
        </NForm>

        <NAlert v-if="hunterTestResult" type="success" :bordered="false">
          <NText strong>{{ $t('page.aiSettings.hunter.testResult') }}：OK</NText>
        </NAlert>

        <div class="form-footer">
          <NText depth="3" class="updated-time">
            {{ $t('page.aiSettings.status.title') }}：{{ formattedHunterUpdatedAt }}
          </NText>
          <NSpace :size="8">
            <NButton size="small" :loading="isHunterLoading" @click="handleLoadHunterConfig()">
              {{ $t('page.aiSettings.actions.reload') }}
            </NButton>
            <NButton size="small" :loading="isHunterTesting" :disabled="!canSaveHunter" @click="handleTestHunterConfig">
              {{ $t('page.aiSettings.actions.test') }}
            </NButton>
            <NButton
              size="small"
              type="primary"
              :loading="isHunterSaving"
              :disabled="!canSaveHunter"
              @click="handleSaveHunterConfig"
            >
              {{ $t('page.aiSettings.hunter.save') }}
            </NButton>
          </NSpace>
        </div>
      </NSpace>
    </NCard>

    <NCard :bordered="false" class="card-wrapper">
      <NSpace vertical :size="14">
        <div class="page-heading">
          <div>
            <h2 class="page-title">AI 获客后台任务</h2>
            <p class="panel-desc">配置全局 BullMQ worker 并发，默认 2。</p>
          </div>
          <NTag type="info" :bordered="false">BullMQ</NTag>
        </div>

        <NForm :model="queueConfigForm" label-placement="top" size="small">
          <NFormItem label="Worker 并发数">
            <NInputNumber
              v-model:value="queueConfigForm.workerConcurrency"
              :min="1"
              :max="10"
              :precision="0"
              class="queue-concurrency-input"
            />
          </NFormItem>
        </NForm>

        <div class="form-footer">
          <NText depth="3" class="updated-time">配置时间：{{ formattedQueueConfigUpdatedAt }}</NText>
          <NSpace :size="8">
            <NButton size="small" :loading="isQueueConfigLoading" @click="handleLoadQueueConfig()">
              {{ $t('page.aiSettings.actions.reload') }}
            </NButton>
            <NButton
              size="small"
              type="primary"
              :loading="isQueueConfigSaving"
              :disabled="!canSaveQueueConfig"
              @click="handleSaveQueueConfig"
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

.queue-concurrency-input {
  width: 180px;
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
