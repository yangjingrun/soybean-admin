<script setup lang="ts">
import { computed, onMounted, reactive, shallowRef } from 'vue';
import dayjs from 'dayjs';
import { useMessage } from 'naive-ui';
import { useI18n } from 'vue-i18n';
import {
  aiLeadsQueueConfigManagePermission,
  hasPermission,
  type PermissionCode
} from '@soybean/shared';
import { defaultAiModelConfigKey, defaultHunterConfigKey, defaultSerperConfigKey } from '@/constants/ai-gateway';
import {
  fetchAiLeadQueueConfig,
  generateAiText,
  getMyAiModelConfig,
  getMyHunterConfig,
  getMySerperConfig,
  saveAiLeadQueueConfig,
  saveMyAiModelConfig,
  saveMyHunterConfig,
  saveMySerperConfig,
  testMyHunterConfig,
  testMySerperConfig
} from '@/service/api';
import { useAuthStore } from '@/store/modules/auth';
import {
  buildModelTestPayload,
  canSaveModelConfig,
  canTestModelConfig,
  resolveAiSettingsTabVisibility,
  type AiSettingsTabKey,
  type ModelConfigFormModel,
  type SavedSecretState
} from './modules/model-settings';

const message = useMessage();
const { t } = useI18n();
const authStore = useAuthStore();

const providerOptions = computed(() => [
  { label: t('page.aiSettings.providers.openrouter'), value: 'openrouter' },
  { label: t('page.aiSettings.providers.custom'), value: 'custom' },
  { label: t('page.aiSettings.providers.openai'), value: 'openai' },
  { label: t('page.aiSettings.providers.deepseek'), value: 'deepseek' },
  { label: t('page.aiSettings.providers.dashscope'), value: 'dashscope' }
]);
const noAutocompleteInputProps = {
  autocomplete: 'off'
};

interface QueueConfigForm {
  workerConcurrency: number | null;
}

interface ConfigStatus {
  label: string;
  type: NaiveUI.ThemeColor;
}

interface StatusOverviewItem {
  key: AiSettingsTabKey;
  label: string;
  status: ConfigStatus;
  updatedAt: string;
}

const modelForm = reactive<ModelConfigFormModel>({
  configKey: defaultAiModelConfigKey,
  title: '我的模型通道',
  providerName: 'openrouter',
  apiBase: 'https://openrouter.ai/api/v1',
  apiKey: '',
  model: 'openai/gpt-4o-mini'
});
const serperForm = reactive<Api.AiGateway.SaveMySerperConfigPayload & { configKey: string }>({
  configKey: defaultSerperConfigKey,
  title: 'Serper 搜索',
  apiBase: 'https://google.serper.dev',
  apiKey: ''
});
const hunterForm = reactive<Api.AiGateway.SaveMyHunterConfigPayload & { configKey: string }>({
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
const savedModelSecret = reactive<SavedSecretState>({
  hasApiKey: false,
  maskedApiKey: ''
});
const savedSerperSecret = reactive<SavedSecretState>({
  hasApiKey: false,
  maskedApiKey: ''
});
const savedHunterSecret = reactive<SavedSecretState>({
  hasApiKey: false,
  maskedApiKey: ''
});
const modelTestResult = shallowRef<Api.AiGateway.AiTextResult | null>(null);
const serperTestResult = shallowRef<Api.AiGateway.SerperTestResult | null>(null);
const hunterTestResult = shallowRef<Api.AiGateway.HunterTestResult | null>(null);
const activeSettingsTab = shallowRef<AiSettingsTabKey>('model');

const canManageAiLeadQueueConfig = computed(() => hasAssignedPermission(aiLeadsQueueConfigManagePermission));
const tabVisibility = computed<Record<AiSettingsTabKey, boolean>>(() =>
  resolveAiSettingsTabVisibility({
    canManageAiLeadQueueConfig: canManageAiLeadQueueConfig.value
  })
);
const canViewAnySettingsTab = computed(() => Object.values(tabVisibility.value).some(Boolean));
const firstVisibleSettingsTab = computed(
  () =>
    (Object.keys(tabVisibility.value) as AiSettingsTabKey[]).find(tabKey => tabVisibility.value[tabKey]) || 'model'
);
const modelApiKeyPlaceholder = computed(() =>
  savedModelSecret.hasApiKey && savedModelSecret.maskedApiKey
    ? `已保存：${savedModelSecret.maskedApiKey}，输入新 API Key 可替换`
    : t('page.aiSettings.placeholders.apiKey')
);
const canSaveModel = computed(() => canSaveModelConfig(modelForm, savedModelSecret));
const canTestModel = computed(() => canTestModelConfig(modelForm, savedModelSecret));
const serperApiKeyPlaceholder = computed(() => buildSavedApiKeyPlaceholder(savedSerperSecret));
const hunterApiKeyPlaceholder = computed(() => buildSavedApiKeyPlaceholder(savedHunterSecret));
const formattedModelUpdatedAt = computed(() =>
  modelUpdatedAt.value
    ? dayjs(modelUpdatedAt.value).format('YYYY-MM-DD HH:mm:ss')
    : t('page.aiSettings.status.notSaved')
);
const canSaveSerper = computed(() => canSaveProviderConfig(serperForm, savedSerperSecret));
const canTestSerper = computed(() => canSaveProviderConfig(serperForm, savedSerperSecret));
const formattedSerperUpdatedAt = computed(() =>
  serperUpdatedAt.value
    ? dayjs(serperUpdatedAt.value).format('YYYY-MM-DD HH:mm:ss')
    : t('page.aiSettings.status.notSaved')
);
const canSaveHunter = computed(() => canSaveProviderConfig(hunterForm, savedHunterSecret));
const canTestHunter = computed(() => canSaveProviderConfig(hunterForm, savedHunterSecret));
const formattedHunterUpdatedAt = computed(() =>
  hunterUpdatedAt.value
    ? dayjs(hunterUpdatedAt.value).format('YYYY-MM-DD HH:mm:ss')
    : t('page.aiSettings.status.notSaved')
);
const canSaveQueueConfig = computed(
  () => canManageAiLeadQueueConfig.value && isValidWorkerConcurrency(queueConfigForm.workerConcurrency)
);
const formattedQueueConfigUpdatedAt = computed(() => {
  const updatedAt = queueConfigUpdatedAt.value;

  return isSavedUpdatedAt(updatedAt)
    ? dayjs(updatedAt).format('YYYY-MM-DD HH:mm:ss')
    : t('page.aiSettings.status.notSaved');
});
const modelStatus = computed(() => getConnectionStatus(Boolean(modelTestResult.value), modelUpdatedAt.value));
const serperStatus = computed(() => getConnectionStatus(Boolean(serperTestResult.value), serperUpdatedAt.value));
const hunterStatus = computed(() => getConnectionStatus(Boolean(hunterTestResult.value), hunterUpdatedAt.value));
const queueStatus = computed<ConfigStatus>(() =>
  isSavedUpdatedAt(queueConfigUpdatedAt.value)
    ? { label: '已保存', type: 'info' }
    : { label: t('page.aiSettings.status.pending'), type: 'default' }
);
const statusOverviewItems = computed<StatusOverviewItem[]>(() => {
  const items: StatusOverviewItem[] = [
    {
      key: 'model',
      label: '我的模型',
      status: modelStatus.value,
      updatedAt: formattedModelUpdatedAt.value
    },
    {
      key: 'serper',
      label: 'Serper',
      status: serperStatus.value,
      updatedAt: formattedSerperUpdatedAt.value
    },
    {
      key: 'hunter',
      label: 'Hunter',
      status: hunterStatus.value,
      updatedAt: formattedHunterUpdatedAt.value
    },
    {
      key: 'queue',
      label: '后台任务',
      status: queueStatus.value,
      updatedAt: formattedQueueConfigUpdatedAt.value
    }
  ];

  return items.filter(item => tabVisibility.value[item.key]);
});

/** Selects the shared tab used by both overview cards and the settings workspace. */
function handleSelectSettingsTab(tabKey: AiSettingsTabKey) {
  activeSettingsTab.value = tabKey;
}

onMounted(() => {
  if (!canViewAnySettingsTab.value) {
    return;
  }

  activeSettingsTab.value = firstVisibleSettingsTab.value;

  void handleLoadModelConfig(false);
  void handleLoadSerperConfig(false);
  void handleLoadHunterConfig(false);

  if (canManageAiLeadQueueConfig.value) {
    void handleLoadQueueConfig(false);
  }
});

/** Check current user buttons against one platform AI setting permission. */
function hasAssignedPermission(permission: PermissionCode) {
  return authStore.isStaticSuper || hasPermission(authStore.userInfo, permission);
}

/** Loads the current account model config into the settings form. */
async function handleLoadModelConfig(showMessage = true) {
  isModelLoading.value = true;

  try {
    const { data: record, error } = await getMyAiModelConfig();

    if (error) {
      return;
    }

    Object.assign(modelForm, {
      configKey: record.configKey ?? defaultAiModelConfigKey,
      title: record.title ?? '我的模型通道',
      providerName: record.providerName,
      apiBase: record.apiBase,
      apiKey: record.apiKey ?? '',
      model: record.model
    });
    Object.assign(savedModelSecret, {
      hasApiKey: record.hasApiKey,
      maskedApiKey: record.maskedApiKey
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

/** Saves the current account model config used by AI workflows. */
async function handleSaveModelConfig() {
  isModelSaving.value = true;

  try {
    const apiKey = modelForm.apiKey.trim();
    const { data: record, error } = await saveMyAiModelConfig({
      providerName: modelForm.providerName.trim(),
      apiBase: modelForm.apiBase.trim(),
      model: modelForm.model.trim(),
      ...(apiKey ? { apiKey } : {})
    });

    if (error) {
      return;
    }

    modelUpdatedAt.value = record.updatedAt;
    Object.assign(savedModelSecret, {
      hasApiKey: record.hasApiKey,
      maskedApiKey: record.maskedApiKey
    });
    modelForm.apiKey = record.apiKey ?? modelForm.apiKey;
    modelTestResult.value = null;
    message.success(t('page.aiSettings.messages.saved'));
  } finally {
    isModelSaving.value = false;
  }
}

/** Loads the current account Serper config into the settings form. */
async function handleLoadSerperConfig(showMessage = true) {
  isSerperLoading.value = true;

  try {
    const { data: record, error } = await getMySerperConfig();

    if (error) {
      return;
    }

    Object.assign(serperForm, {
      configKey: defaultSerperConfigKey,
      title: record.title,
      apiBase: record.apiBase,
      apiKey: record.apiKey ?? ''
    });
    Object.assign(savedSerperSecret, {
      hasApiKey: record.hasApiKey,
      maskedApiKey: record.maskedApiKey
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

/** Saves the Serper config used by the current account's AI leads search orchestration. */
async function handleSaveSerperConfig() {
  isSerperSaving.value = true;

  try {
    const apiKey = serperForm.apiKey?.trim() || '';
    const { data: record, error } = await saveMySerperConfig({
      title: serperForm.title.trim(),
      apiBase: serperForm.apiBase.trim(),
      ...(apiKey ? { apiKey } : {})
    });

    if (error) {
      return;
    }

    serperUpdatedAt.value = record.updatedAt;
    serperTestResult.value = null;
    Object.assign(savedSerperSecret, {
      hasApiKey: record.hasApiKey,
      maskedApiKey: record.maskedApiKey
    });
    serperForm.apiKey = record.apiKey ?? serperForm.apiKey;
    message.success(t('page.aiSettings.serper.saved'));
  } finally {
    isSerperSaving.value = false;
  }
}

/** Loads the current account Hunter config into the settings form. */
async function handleLoadHunterConfig(showMessage = true) {
  isHunterLoading.value = true;

  try {
    const { data: record, error } = await getMyHunterConfig();

    if (error) {
      return;
    }

    Object.assign(hunterForm, {
      configKey: defaultHunterConfigKey,
      title: record.title,
      apiBase: record.apiBase,
      apiKey: record.apiKey ?? ''
    });
    Object.assign(savedHunterSecret, {
      hasApiKey: record.hasApiKey,
      maskedApiKey: record.maskedApiKey
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

/** Saves the Hunter config used by the current account's CRM Domain Search enrichment. */
async function handleSaveHunterConfig() {
  isHunterSaving.value = true;

  try {
    const apiKey = hunterForm.apiKey?.trim() || '';
    const { data: record, error } = await saveMyHunterConfig({
      title: hunterForm.title.trim(),
      apiBase: hunterForm.apiBase.trim(),
      ...(apiKey ? { apiKey } : {})
    });

    if (error) {
      return;
    }

    hunterUpdatedAt.value = record.updatedAt;
    hunterTestResult.value = null;
    Object.assign(savedHunterSecret, {
      hasApiKey: record.hasApiKey,
      maskedApiKey: record.maskedApiKey
    });
    hunterForm.apiKey = record.apiKey ?? hunterForm.apiKey;
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

/** Maps saved and tested states to the compact tags used by the config cards. */
function getConnectionStatus(isConnected: boolean, updatedAt: string | null): ConfigStatus {
  if (isConnected) {
    return { label: t('page.aiSettings.status.connected'), type: 'success' };
  }

  if (isSavedUpdatedAt(updatedAt)) {
    return { label: t('page.aiSettings.status.savedUntested'), type: 'warning' };
  }

  return { label: t('page.aiSettings.status.pending'), type: 'default' };
}

/** Checks whether a saved timestamp should be displayed to users. */
function isSavedUpdatedAt(value: string | null): value is string {
  return Boolean(value && dayjs(value).valueOf() > 0);
}

/** Sends one lightweight message with the current model config. */
async function handleTestModelConfig() {
  isModelTesting.value = true;
  modelTestResult.value = null;

  try {
    const { data: result, error } = await generateAiText(
      buildModelTestPayload(modelForm, savedModelSecret, {
        systemPrompt: t('page.aiSettings.test.systemPrompt'),
        prompt: t('page.aiSettings.test.prompt')
      })
    );

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
    const apiKey = serperForm.apiKey?.trim() || '';
    const { data: result, error } = await testMySerperConfig({
      title: serperForm.title.trim(),
      apiBase: serperForm.apiBase.trim(),
      ...(apiKey ? { apiKey } : {})
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
    const apiKey = hunterForm.apiKey?.trim() || '';
    const { data: result, error } = await testMyHunterConfig({
      title: hunterForm.title.trim(),
      apiBase: hunterForm.apiBase.trim(),
      ...(apiKey ? { apiKey } : {})
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

/** Copies the API key currently entered in a settings form. */
async function handleCopyApiKey(apiKey: string) {
  await navigator.clipboard.writeText(apiKey.trim());
  message.success('API Key 已复制');
}

function canSaveProviderConfig(
  form: Pick<Api.AiGateway.SaveMySerperConfigPayload, 'title' | 'apiBase' | 'apiKey'>,
  savedSecret: SavedSecretState
) {
  return Boolean(form.title.trim() && form.apiBase.trim() && (form.apiKey?.trim() || savedSecret.hasApiKey));
}

function buildSavedApiKeyPlaceholder(savedSecret: SavedSecretState) {
  return savedSecret.hasApiKey && savedSecret.maskedApiKey
    ? `已保存：${savedSecret.maskedApiKey}，输入新 API Key 可替换`
    : t('page.aiSettings.placeholders.apiKey');
}
</script>

<template>
  <NSpace vertical :size="12" class="ai-settings-page">
    <NCard :bordered="false" size="small" class="card-wrapper settings-overview-card">
      <div class="settings-overview">
        <div class="settings-overview__copy">
          <h2 class="page-title">{{ $t('page.aiSettings.title') }}</h2>
          <p class="panel-desc">{{ $t('page.aiSettings.description') }}</p>
        </div>
        <div v-if="statusOverviewItems.length" class="status-overview">
          <button
            v-for="item in statusOverviewItems"
            :key="item.key"
            type="button"
            class="status-overview__item"
            :class="{ 'status-overview__item--active': activeSettingsTab === item.key }"
            :aria-pressed="activeSettingsTab === item.key"
            @click="handleSelectSettingsTab(item.key)"
          >
            <div class="status-overview__topline">
              <span class="status-overview__label">{{ item.label }}</span>
              <NTag size="small" :type="item.status.type" :bordered="false">{{ item.status.label }}</NTag>
            </div>
            <NText depth="3" class="updated-time">{{ item.updatedAt }}</NText>
          </button>
        </div>
      </div>
    </NCard>

    <NCard v-if="canViewAnySettingsTab" :bordered="false" size="small" class="card-wrapper settings-workspace-card">
      <NTabs v-model:value="activeSettingsTab" type="line" size="small">
        <NTabPane v-if="tabVisibility.model" name="model" tab="我的模型通道" display-directive="if">
          <NSpace vertical :size="12" class="settings-tab-panel">
            <div class="panel-heading">
              <div>
                <h3 class="panel-title">我的模型通道</h3>
                <p class="panel-desc">{{ $t('page.aiSettings.description') }}</p>
              </div>
              <NTag size="small" :type="modelStatus.type" :bordered="false">{{ modelStatus.label }}</NTag>
            </div>

            <NForm :model="modelForm" label-placement="top" size="small" :show-feedback="false">
              <NGrid :x-gap="12" :y-gap="8" responsive="screen" item-responsive>
                <NGi span="24 m:12">
                  <NFormItem :label="$t('page.aiSettings.form.provider')">
                    <NSelect v-model:value="modelForm.providerName" :options="providerOptions" />
                  </NFormItem>
                </NGi>
                <NGi span="24 m:12">
                  <NFormItem :label="$t('page.aiSettings.form.model')">
                    <NInput
                      v-model:value="modelForm.model"
                      :placeholder="$t('page.aiSettings.placeholders.model')"
                      :input-props="noAutocompleteInputProps"
                    />
                  </NFormItem>
                </NGi>
                <NGi span="24 m:14">
                  <NFormItem :label="$t('page.aiSettings.form.apiBase')">
                    <NInput
                      v-model:value="modelForm.apiBase"
                      :placeholder="$t('page.aiSettings.placeholders.apiBase')"
                      :input-props="noAutocompleteInputProps"
                    />
                  </NFormItem>
                </NGi>
                <NGi span="24">
                  <NFormItem :label="$t('page.aiSettings.form.apiKey')">
                    <NInputGroup>
                      <NInput
                        v-model:value="modelForm.apiKey"
                        type="password"
                        show-password-on="click"
                        :placeholder="modelApiKeyPlaceholder"
                        :input-props="noAutocompleteInputProps"
                      />
                      <NTooltip trigger="hover">
                        <template #trigger>
                          <NButton
                            size="small"
                            :disabled="!modelForm.apiKey.trim()"
                            @click="handleCopyApiKey(modelForm.apiKey)"
                          >
                            <template #icon>
                              <SvgIcon icon="material-symbols:content-copy-outline" />
                            </template>
                          </NButton>
                        </template>
                        复制 API Key
                      </NTooltip>
                    </NInputGroup>
                  </NFormItem>
                </NGi>
              </NGrid>
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
                <NButton size="small" :loading="isModelTesting" :disabled="!canTestModel" @click="handleTestModelConfig">
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
        </NTabPane>

        <NTabPane v-if="tabVisibility.serper" name="serper" tab="Serper 搜索" display-directive="if">
          <NSpace vertical :size="12" class="settings-tab-panel">
            <div class="panel-heading">
              <div>
                <h3 class="panel-title">{{ $t('page.aiSettings.serper.title') }}</h3>
                <p class="panel-desc">{{ $t('page.aiSettings.serper.description') }}</p>
              </div>
              <NTag size="small" :type="serperStatus.type" :bordered="false">{{ serperStatus.label }}</NTag>
            </div>

            <NForm :model="serperForm" label-placement="top" size="small" :show-feedback="false">
              <NGrid :x-gap="12" :y-gap="8" responsive="screen" item-responsive>
                <NGi span="24 m:12">
                  <NFormItem :label="$t('page.aiSettings.form.title')">
                    <NInput
                      v-model:value="serperForm.title"
                      :placeholder="$t('page.aiSettings.serper.title')"
                      :input-props="noAutocompleteInputProps"
                    />
                  </NFormItem>
                </NGi>
                <NGi span="24 m:12">
                  <NFormItem :label="$t('page.aiSettings.form.apiBase')">
                    <NInput
                      v-model:value="serperForm.apiBase"
                      placeholder="https://google.serper.dev"
                      :input-props="noAutocompleteInputProps"
                    />
                  </NFormItem>
                </NGi>
                <NGi span="24">
                  <NFormItem :label="$t('page.aiSettings.form.apiKey')">
                    <NInputGroup>
                      <NInput
                        v-model:value="serperForm.apiKey"
                        type="password"
                        show-password-on="click"
                        :placeholder="serperApiKeyPlaceholder"
                        :input-props="noAutocompleteInputProps"
                      />
                      <NTooltip trigger="hover">
                        <template #trigger>
                          <NButton
                            size="small"
                            :disabled="!(serperForm.apiKey || '').trim()"
                            @click="handleCopyApiKey(serperForm.apiKey || '')"
                          >
                            <template #icon>
                              <SvgIcon icon="material-symbols:content-copy-outline" />
                            </template>
                          </NButton>
                        </template>
                        复制 API Key
                      </NTooltip>
                    </NInputGroup>
                  </NFormItem>
                </NGi>
              </NGrid>
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
                <NButton
                  size="small"
                  :loading="isSerperTesting"
                  :disabled="!canTestSerper"
                  @click="handleTestSerperConfig"
                >
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
        </NTabPane>

        <NTabPane v-if="tabVisibility.hunter" name="hunter" tab="Hunter 补全" display-directive="if">
          <NSpace vertical :size="12" class="settings-tab-panel">
            <div class="panel-heading">
              <div>
                <h3 class="panel-title">{{ $t('page.aiSettings.hunter.title') }}</h3>
                <p class="panel-desc">{{ $t('page.aiSettings.hunter.description') }}</p>
              </div>
              <NTag size="small" :type="hunterStatus.type" :bordered="false">{{ hunterStatus.label }}</NTag>
            </div>

            <NForm :model="hunterForm" label-placement="top" size="small" :show-feedback="false">
              <NGrid :x-gap="12" :y-gap="8" responsive="screen" item-responsive>
                <NGi span="24 m:12">
                  <NFormItem :label="$t('page.aiSettings.form.title')">
                    <NInput
                      v-model:value="hunterForm.title"
                      :placeholder="$t('page.aiSettings.hunter.title')"
                      :input-props="noAutocompleteInputProps"
                    />
                  </NFormItem>
                </NGi>
                <NGi span="24 m:12">
                  <NFormItem :label="$t('page.aiSettings.form.apiBase')">
                    <NInput
                      v-model:value="hunterForm.apiBase"
                      placeholder="https://api.hunter.io/v2"
                      :input-props="noAutocompleteInputProps"
                    />
                  </NFormItem>
                </NGi>
                <NGi span="24">
                  <NFormItem :label="$t('page.aiSettings.form.apiKey')">
                    <NInputGroup>
                      <NInput
                        v-model:value="hunterForm.apiKey"
                        type="password"
                        show-password-on="click"
                        :placeholder="hunterApiKeyPlaceholder"
                        :input-props="noAutocompleteInputProps"
                      />
                      <NTooltip trigger="hover">
                        <template #trigger>
                          <NButton
                            size="small"
                            :disabled="!(hunterForm.apiKey || '').trim()"
                            @click="handleCopyApiKey(hunterForm.apiKey || '')"
                          >
                            <template #icon>
                              <SvgIcon icon="material-symbols:content-copy-outline" />
                            </template>
                          </NButton>
                        </template>
                        复制 API Key
                      </NTooltip>
                    </NInputGroup>
                  </NFormItem>
                </NGi>
              </NGrid>
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
                <NButton
                  size="small"
                  :loading="isHunterTesting"
                  :disabled="!canTestHunter"
                  @click="handleTestHunterConfig"
                >
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
        </NTabPane>

        <NTabPane v-if="tabVisibility.queue" name="queue" tab="后台任务" display-directive="if">
          <NSpace vertical :size="12" class="settings-tab-panel settings-tab-panel--narrow">
            <div class="panel-heading">
              <div>
                <h3 class="panel-title">AI 获客后台任务</h3>
                <p class="panel-desc">配置全局 BullMQ worker 并发，默认 2。</p>
              </div>
              <NTag size="small" type="info" :bordered="false">BullMQ</NTag>
            </div>

            <div class="queue-panel">
              <NForm :model="queueConfigForm" label-placement="top" size="small" :show-feedback="false">
                <NFormItem label="Worker 并发数">
                  <NInputNumber
                    v-model:value="queueConfigForm.workerConcurrency"
                    :min="1"
                    :max="10"
                    :precision="0"
                    :input-props="noAutocompleteInputProps"
                    class="queue-concurrency-input"
                  />
                </NFormItem>
              </NForm>
              <NText depth="3" class="queue-hint">数值越高，并发采集越快，也会更集中消耗外部服务额度。</NText>
            </div>

            <div class="form-footer form-footer--stacked">
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
        </NTabPane>
      </NTabs>
    </NCard>

    <NCard v-else :bordered="false" size="small" class="card-wrapper settings-workspace-card">
      <NEmpty description="暂无权限维护平台 AI 配置" />
    </NCard>
  </NSpace>
</template>

<style scoped>
.ai-settings-page {
  --settings-panel-gap: 12px;
}

.settings-overview {
  display: grid;
  grid-template-columns: minmax(280px, 1fr) minmax(520px, 1.35fr);
  gap: 16px;
  align-items: center;
}

.settings-overview__copy {
  min-width: 0;
}

.status-overview {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.status-overview__item {
  width: 100%;
  min-width: 0;
  padding: 8px 10px;
  border: 1px solid transparent;
  border-radius: 8px;
  color: inherit;
  font: inherit;
  text-align: left;
  background: var(--n-color-embedded);
  cursor: pointer;
  outline: none;
  appearance: none;
  transition:
    border-color 0.2s var(--n-bezier),
    background-color 0.2s var(--n-bezier),
    box-shadow 0.2s var(--n-bezier);
}

.status-overview__item:hover {
  border-color: var(--n-border-color);
}

.status-overview__item--active {
  border-color: rgb(var(--primary-color, 100 108 255));
  background: var(--n-color-embedded);
  box-shadow:
    0 0 0 1px rgb(var(--primary-color, 100 108 255)),
    0 8px 18px rgb(var(--primary-color, 100 108 255) / 0.12);
}

.status-overview__item--active .status-overview__label {
  color: rgb(var(--primary-color, 100 108 255));
}

.status-overview__item:focus-visible {
  outline: 2px solid rgb(var(--primary-color, 100 108 255));
  outline-offset: 2px;
}

.status-overview__topline,
.panel-heading,
.form-footer {
  display: flex;
  gap: 12px;
}

.status-overview__topline {
  flex-direction: column;
  gap: 4px;
  align-items: flex-start;
}

.panel-heading {
  align-items: flex-start;
  justify-content: space-between;
}

.status-overview__label {
  overflow: hidden;
  color: var(--n-text-color-2);
  font-size: 13px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.settings-workspace-card :deep(.n-tabs-nav) {
  display: none;
}

.settings-tab-panel {
  max-width: 920px;
}

.settings-tab-panel--narrow {
  max-width: 520px;
}

.panel-heading {
  min-height: 48px;
}

.page-title,
.panel-title {
  margin: 0;
  color: var(--n-text-color);
  font-weight: 700;
  line-height: 1.35;
  text-wrap: balance;
}

.page-title {
  font-size: 20px;
}

.panel-title {
  font-size: 16px;
}

.panel-desc {
  max-width: 72ch;
  margin: 4px 0 0;
  color: var(--n-text-color-3);
  font-size: 13px;
  line-height: 1.55;
  text-wrap: pretty;
}

.form-footer {
  align-items: center;
  justify-content: space-between;
  padding-top: 2px;
}

.form-footer--stacked {
  align-items: flex-start;
  flex-direction: column;
}

.full-width-control,
.queue-concurrency-input {
  width: 100%;
}

.queue-panel {
  display: grid;
  gap: 8px;
}

.queue-concurrency-input {
  max-width: 180px;
}

.queue-hint,
.updated-time {
  font-size: 12px;
  line-height: 1.5;
}

@media (max-width: 1024px) {
  .settings-overview {
    grid-template-columns: 1fr;
  }

  .status-overview {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .status-overview {
    grid-template-columns: 1fr;
  }

  .panel-heading,
  .form-footer {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
