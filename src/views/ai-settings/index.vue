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
import { generateAiText, getAiModelConfig, getAiPrompt, saveAiModelConfig, saveAiPrompt } from '@/service/api';
import { useAuthStore } from '@/store/modules/auth';

const message = useMessage();
const authStore = useAuthStore();

const providerOptions = [
  { label: 'OpenRouter / 中转站', value: 'openrouter' },
  { label: 'OpenAI 兼容', value: 'custom' },
  { label: 'OpenAI 官方', value: 'openai' },
  { label: 'DeepSeek', value: 'deepseek' },
  { label: '通义千问', value: 'dashscope' }
];

const modelForm = reactive<Api.AiGateway.SaveModelConfigPayload>({
  configKey: defaultAiModelConfigKey,
  title: '默认模型',
  providerName: 'openrouter',
  apiBase: 'https://openrouter.ai/api/v1',
  apiKey: '',
  model: 'openai/gpt-4o-mini',
  temperature: 0.2,
  maxOutputTokens: 1200
});

const defaultPrompt = aiPromptOptions.find(item => item.value === defaultAiPromptKey)!;
const promptForm = reactive<Api.AiGateway.SavePromptPayload>({
  promptKey: defaultPrompt.value,
  title: defaultPrompt.label,
  systemPrompt: defaultPrompt.defaultPrompt
});

const isModelLoading = shallowRef(false);
const isModelSaving = shallowRef(false);
const isModelTesting = shallowRef(false);
const isPromptLoading = shallowRef(false);
const isPromptSaving = shallowRef(false);
const modelTestResult = shallowRef<Api.AiGateway.AiTextResult | null>(null);
const promptRecords = reactive<Partial<Record<AiPromptKey, Api.AiGateway.AiPromptRecord>>>({});

const selectedPrompt = computed(
  () => aiPromptOptions.find(item => item.value === promptForm.promptKey) || defaultPrompt
);
const canManagePrompts = computed(() => authStore.isStaticSuper);
const canSaveModel = computed(() =>
  Boolean(
    modelForm.providerName.trim() && modelForm.apiBase.trim() && modelForm.apiKey.trim() && modelForm.model.trim()
  )
);
const canSavePrompt = computed(() => Boolean(promptForm.systemPrompt.trim()));

onMounted(() => {
  void handleLoadModelConfig(false);

  if (canManagePrompts.value) {
    void handleLoadFixedPrompts(false);
  }
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
      model: record.model,
      temperature: record.temperature,
      maxOutputTokens: record.maxOutputTokens
    });
    if (showMessage) {
      message.success('模型配置已加载');
    }
  } finally {
    isModelLoading.value = false;
  }
}

/** Saves the backend model config used by AI workflows. */
async function handleSaveModelConfig() {
  isModelSaving.value = true;

  try {
    const { error } = await saveAiModelConfig({
      configKey: defaultAiModelConfigKey,
      title: modelForm.title.trim(),
      providerName: modelForm.providerName.trim(),
      apiBase: modelForm.apiBase.trim(),
      apiKey: modelForm.apiKey.trim(),
      model: modelForm.model.trim(),
      temperature: modelForm.temperature,
      maxOutputTokens: modelForm.maxOutputTokens
    });

    if (error) {
      return;
    }

    message.success('模型配置已保存');
  } finally {
    isModelSaving.value = false;
  }
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
      systemPrompt: '你是模型连通性测试助手。请只回复 OK。',
      prompt: '请回复 OK',
      temperature: 0,
      maxOutputTokens: 20
    });

    if (error) {
      return;
    }

    modelTestResult.value = result;
    message.success('模型连通性正常');
  } finally {
    isModelTesting.value = false;
  }
}

/** Loads all fixed system prompts from the backend REST API. */
async function handleLoadFixedPrompts(showMessage = true) {
  isPromptLoading.value = true;

  try {
    const records = await Promise.all(
      aiPromptOptions.map(async option => {
        const { data: record, error } = await getAiPrompt(option.value);

        return error ? null : record;
      })
    );

    records.forEach(record => {
      if (record) {
        setPromptRecord(record);
      }
    });
    syncPromptForm(promptRecords[getPromptFormKey()]);

    if (showMessage) {
      message.success('提示词已加载');
    }
  } finally {
    isPromptLoading.value = false;
  }
}

/** Loads the selected fixed system prompt into the form. */
async function handleLoadPrompt(showMessage = true) {
  isPromptLoading.value = true;

  try {
    const { data: record, error } = await getAiPrompt(promptForm.promptKey);

    if (error) {
      return;
    }

    setPromptRecord(record);
    syncPromptForm(record);
    if (showMessage) {
      message.success('提示词已加载');
    }
  } finally {
    isPromptLoading.value = false;
  }
}

/** Saves the selected fixed system prompt. */
async function handleSavePrompt() {
  isPromptSaving.value = true;

  try {
    const { data: record, error } = await saveAiPrompt({
      promptKey: promptForm.promptKey,
      title: selectedPrompt.value.label,
      systemPrompt: promptForm.systemPrompt.trim()
    });

    if (error) {
      return;
    }

    setPromptRecord(record);
    syncPromptForm(record);
    message.success('提示词已保存');
  } finally {
    isPromptSaving.value = false;
  }
}

function handlePromptKeyUpdate(value: string) {
  const option = aiPromptOptions.find(item => item.value === value) || defaultPrompt;

  promptForm.promptKey = option.value as AiPromptKey;
  promptForm.title = option.label;
  promptForm.systemPrompt = option.defaultPrompt;
  const cachedRecord = promptRecords[getPromptFormKey()];

  if (cachedRecord) {
    syncPromptForm(cachedRecord);
    return;
  }

  void handleLoadPrompt(false);
}

function syncPromptForm(record?: Api.AiGateway.AiPromptRecord) {
  if (!record) {
    return;
  }

  promptForm.title = record.title;
  promptForm.systemPrompt = record.systemPrompt;
}

function setPromptRecord(record: Api.AiGateway.AiPromptRecord) {
  promptRecords[record.promptKey as AiPromptKey] = record;
}

function getPromptFormKey() {
  return promptForm.promptKey as AiPromptKey;
}
</script>

<template>
  <NSpace vertical :size="16">
    <NCard :bordered="false" class="card-wrapper">
      <div class="ai-settings-header">
        <div>
          <p class="ai-settings-eyebrow text-primary">AI Settings</p>
          <h2 class="ai-settings-title">AI设置</h2>
          <p class="ai-settings-desc">维护默认模型通道和固定业务提示词。</p>
        </div>
      </div>
    </NCard>

    <NGrid :x-gap="16" :y-gap="16" responsive="screen" item-responsive>
      <NGi span="24 l:10">
        <NCard :bordered="false" class="card-wrapper">
          <NSpace vertical :size="16">
            <div class="panel-title">
              <NText strong>默认模型</NText>
              <NSpace :size="8">
                <NButton size="small" :loading="isModelLoading" @click="handleLoadModelConfig()">重新加载</NButton>
                <NButton
                  size="small"
                  :loading="isModelTesting"
                  :disabled="!canSaveModel"
                  @click="handleTestModelConfig"
                >
                  测试连接
                </NButton>
                <NButton
                  size="small"
                  type="primary"
                  :loading="isModelSaving"
                  :disabled="!canSaveModel"
                  @click="handleSaveModelConfig"
                >
                  保存
                </NButton>
              </NSpace>
            </div>

            <NForm label-placement="top" size="small">
              <NFormItem label="配置名称">
                <NInput v-model:value="modelForm.title" placeholder="默认模型" />
              </NFormItem>
              <NGrid :x-gap="12" responsive="screen" item-responsive>
                <NGi span="24 m:12">
                  <NFormItem label="模型服务">
                    <NSelect v-model:value="modelForm.providerName" :options="providerOptions" />
                  </NFormItem>
                </NGi>
                <NGi span="24 m:12">
                  <NFormItem label="模型名称">
                    <NInput v-model:value="modelForm.model" placeholder="openai/gpt-4o-mini" />
                  </NFormItem>
                </NGi>
              </NGrid>
              <NFormItem label="API Base">
                <NInput v-model:value="modelForm.apiBase" placeholder="https://openrouter.ai/api/v1" />
              </NFormItem>
              <NFormItem label="API Key">
                <NInput
                  v-model:value="modelForm.apiKey"
                  type="password"
                  show-password-on="click"
                  placeholder="请输入模型服务密钥"
                />
              </NFormItem>
              <NGrid :x-gap="12" responsive="screen" item-responsive>
                <NGi span="24 m:12">
                  <NFormItem label="Temperature">
                    <NInputNumber
                      v-model:value="modelForm.temperature"
                      :min="0"
                      :max="2"
                      :step="0.1"
                      class="full-input"
                    />
                  </NFormItem>
                </NGi>
                <NGi span="24 m:12">
                  <NFormItem label="输出上限">
                    <NInputNumber
                      v-model:value="modelForm.maxOutputTokens"
                      :min="1"
                      :max="8000"
                      :step="100"
                      class="full-input"
                    />
                  </NFormItem>
                </NGi>
              </NGrid>
            </NForm>

            <NAlert v-if="modelTestResult" type="success" :bordered="false">
              <NSpace vertical :size="4">
                <NText strong>测试返回：{{ modelTestResult.text }}</NText>
                <NText depth="3">
                  Tokens：输入 {{ modelTestResult.usage.inputTokens ?? '-' }} / 输出
                  {{ modelTestResult.usage.outputTokens ?? '-' }}
                </NText>
              </NSpace>
            </NAlert>
          </NSpace>
        </NCard>
      </NGi>

      <NGi v-if="canManagePrompts" span="24 l:14">
        <NCard :bordered="false" class="card-wrapper">
          <NSpace vertical :size="16">
            <div class="panel-title">
              <NText strong>固定提示词</NText>
              <NSpace :size="8">
                <NButton size="small" :loading="isPromptLoading" @click="handleLoadFixedPrompts()">重新加载</NButton>
                <NButton
                  size="small"
                  type="primary"
                  :loading="isPromptSaving"
                  :disabled="!canSavePrompt"
                  @click="handleSavePrompt"
                >
                  保存
                </NButton>
              </NSpace>
            </div>

            <NForm label-placement="top" size="small">
              <NFormItem label="业务步骤">
                <NSelect
                  :value="promptForm.promptKey"
                  :options="aiPromptSelectOptions"
                  @update:value="handlePromptKeyUpdate"
                />
              </NFormItem>
              <NFormItem label="系统提示词">
                <NInput
                  v-model:value="promptForm.systemPrompt"
                  type="textarea"
                  :autosize="{ minRows: 18, maxRows: 28 }"
                  placeholder="写入模型必须遵守的固定规则"
                />
              </NFormItem>
            </NForm>
          </NSpace>
        </NCard>
      </NGi>
    </NGrid>
  </NSpace>
</template>

<style scoped>
.ai-settings-header,
.panel-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.ai-settings-eyebrow {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 600;
}

.ai-settings-title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
}

.ai-settings-desc {
  margin: 10px 0 0;
  color: var(--n-text-color-3);
}

.full-input {
  width: 100%;
}

@media (max-width: 640px) {
  .ai-settings-header,
  .panel-title {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
