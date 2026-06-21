<script setup lang="ts">
import { computed, onMounted, reactive, shallowRef } from 'vue';
import dayjs from 'dayjs';
import { useMessage } from 'naive-ui';
import { useI18n } from 'vue-i18n';
import {
  aiSettingsPromptManagePermission,
  hasPermission
} from '@soybean/shared';
import { aiPromptOptions, defaultAiPromptKey, type AiPromptKey } from '@/constants/ai-gateway';
import { getAiPrompt, saveAiPrompt } from '@/service/api';
import { useAuthStore } from '@/store/modules/auth';
import PromptTestModal from './modules/PromptTestModal.vue';

const message = useMessage();
const { t } = useI18n();
const authStore = useAuthStore();

const promptI18nMap: Record<AiPromptKey, { title: string; usage: string }> = {
  lead_keyword_optimize: {
    title: 'page.aiPromptSettings.prompts.leadKeywordOptimize.title',
    usage: 'page.aiPromptSettings.prompts.leadKeywordOptimize.usage'
  },
  lead_search_result_decide: {
    title: 'page.aiPromptSettings.prompts.leadSearchResultDecide.title',
    usage: 'page.aiPromptSettings.prompts.leadSearchResultDecide.usage'
  },
  lead_match_analyze: {
    title: 'page.aiPromptSettings.prompts.leadMatchAnalyze.title',
    usage: 'page.aiPromptSettings.prompts.leadMatchAnalyze.usage'
  },
  lead_email_generate: {
    title: 'page.aiPromptSettings.prompts.leadEmailGenerate.title',
    usage: 'page.aiPromptSettings.prompts.leadEmailGenerate.usage'
  }
};

const defaultPrompt = aiPromptOptions.find(item => item.value === defaultAiPromptKey)!;
const promptForm = reactive<Api.AiGateway.SavePromptPayload>({
  promptKey: defaultPrompt.value,
  title: defaultPrompt.label,
  systemPrompt: ''
});

const isPromptLoading = shallowRef(false);
const isPromptSaving = shallowRef(false);
const isPromptTestVisible = shallowRef(false);
const promptRecords = reactive<Partial<Record<AiPromptKey, Api.AiGateway.AiPromptRecord>>>({});

const selectedPrompt = computed(
  () => aiPromptOptions.find(item => item.value === promptForm.promptKey) || defaultPrompt
);
const selectedPromptRecord = computed(() => promptRecords[getPromptFormKey()]);
const promptDisplayOptions = computed(() =>
  aiPromptOptions.map(option => ({
    ...option,
    label: t(promptI18nMap[option.value].title),
    usage: t(promptI18nMap[option.value].usage)
  }))
);
const selectedPromptTitle = computed(() => t(promptI18nMap[getPromptFormKey()].title));
const selectedPromptUsage = computed(() => t(promptI18nMap[getPromptFormKey()].usage));
const selectedPromptUpdatedAt = computed(() => {
  const updatedAt = selectedPromptRecord.value?.updatedAt;

  return updatedAt ? dayjs(updatedAt).format('YYYY-MM-DD HH:mm:ss') : t('page.aiPromptSettings.status.notSaved');
});
const canManagePrompt = computed(() => authStore.isStaticSuper || hasPermission(authStore.userInfo, aiSettingsPromptManagePermission));
const canSavePrompt = computed(() => canManagePrompt.value && Boolean(promptForm.systemPrompt.trim()));
const canTestPrompt = computed(() => canManagePrompt.value && Boolean(promptForm.systemPrompt.trim()));

onMounted(() => {
  if (!canManagePrompt.value) {
    return;
  }

  void handleLoadFixedPrompts(false);
});

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
      message.success(t('page.aiPromptSettings.messages.loaded'));
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
      message.success(t('page.aiPromptSettings.messages.loaded'));
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
    message.success(t('page.aiPromptSettings.messages.saved'));
  } finally {
    isPromptSaving.value = false;
  }
}

function handlePromptKeyUpdate(value: AiPromptKey) {
  const option = aiPromptOptions.find(item => item.value === value) || defaultPrompt;

  promptForm.promptKey = option.value;
  promptForm.title = option.label;
  promptForm.systemPrompt = '';
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
  <NSpace v-if="canManagePrompt" vertical :size="12">
    <NGrid :x-gap="16" :y-gap="16" responsive="screen" item-responsive>
      <NGi span="24 l:7">
        <NCard :bordered="false" class="card-wrapper">
          <NSpace vertical :size="14">
            <div class="panel-title">
              <NText strong>{{ $t('page.aiPromptSettings.steps.title') }}</NText>
              <NButton size="small" :loading="isPromptLoading" @click="handleLoadFixedPrompts()">
                {{ $t('page.aiPromptSettings.actions.reload') }}
              </NButton>
            </div>

            <div class="prompt-step-list">
              <button
                v-for="option in promptDisplayOptions"
                :key="option.value"
                class="prompt-step"
                :class="{ active: option.value === promptForm.promptKey }"
                type="button"
                @click="handlePromptKeyUpdate(option.value)"
              >
                <span>{{ option.label }}</span>
                <small>{{ option.value }}</small>
              </button>
            </div>
          </NSpace>
        </NCard>
      </NGi>

      <NGi span="24 l:17">
        <NCard :bordered="false" class="card-wrapper">
          <NSpace vertical :size="16">
            <div class="panel-title">
              <div>
                <h2 class="prompt-page-title">{{ $t('page.aiPromptSettings.title') }}</h2>
                <p class="prompt-page-desc">{{ $t('page.aiPromptSettings.description') }}</p>
                <p class="panel-desc">{{ selectedPromptTitle }}：{{ selectedPromptUsage }}</p>
              </div>
              <NSpace :size="8">
                <NTag type="warning" :bordered="false">{{ $t('page.aiPromptSettings.superOnly') }}</NTag>
                <NText depth="3" class="updated-time">{{ selectedPromptUpdatedAt }}</NText>
                <NButton
                  size="small"
                  type="primary"
                  :loading="isPromptSaving"
                  :disabled="!canSavePrompt"
                  @click="handleSavePrompt"
                >
                  {{ $t('page.aiPromptSettings.actions.save') }}
                </NButton>
                <NButton size="small" :disabled="!canTestPrompt" @click="isPromptTestVisible = true">
                  {{ $t('page.aiPromptSettings.actions.test') }}
                </NButton>
              </NSpace>
            </div>

            <NAlert type="info" :bordered="false">
              {{ $t('page.aiPromptSettings.globalTip') }}
            </NAlert>

            <NForm :model="promptForm" label-placement="top" size="small">
              <NFormItem :label="$t('page.aiPromptSettings.form.systemPrompt')">
                <NInput
                  v-model:value="promptForm.systemPrompt"
                  type="textarea"
                  :autosize="{ minRows: 20, maxRows: 32 }"
                  :placeholder="$t('page.aiPromptSettings.placeholders.systemPrompt')"
                />
              </NFormItem>
            </NForm>
          </NSpace>
        </NCard>
      </NGi>
    </NGrid>

    <PromptTestModal
      v-model:show="isPromptTestVisible"
      :prompt-title="selectedPromptTitle"
      :system-prompt="promptForm.systemPrompt"
    />
  </NSpace>
  <NCard v-else :bordered="false" class="card-wrapper">
    <NEmpty description="暂无权限查看提示词配置" />
  </NCard>
</template>

<style scoped>
.panel-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.prompt-page-title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  line-height: 1.35;
}

.prompt-page-desc,
.panel-desc {
  margin: 6px 0 0;
  color: var(--n-text-color-3);
}

.panel-desc,
.updated-time {
  font-size: 13px;
}

.prompt-step-list {
  display: grid;
  gap: 10px;
}

.prompt-step {
  display: flex;
  align-items: flex-start;
  flex-direction: column;
  gap: 4px;
  width: 100%;
  padding: 12px;
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
  color: var(--n-text-color);
  background: var(--n-color);
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.2s,
    color 0.2s,
    background-color 0.2s;
}

.prompt-step small {
  color: var(--n-text-color-3);
}

.prompt-step.active {
  border-color: var(--n-primary-color);
  color: var(--n-primary-color);
  background: var(--n-primary-color-suppl);
}

@media (max-width: 640px) {
  .panel-title {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
