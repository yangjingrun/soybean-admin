<script setup lang="ts">
import { computed, onMounted, reactive, shallowRef } from 'vue';
import dayjs from 'dayjs';
import { useMessage } from 'naive-ui';
import { fetchCrmAiDraftQueueConfig, saveCrmAiDraftQueueConfig } from '@/service/api';
import { useAuthStore } from '@/store/modules/auth';
import {
  createAiDraftQueueConfigFormFromRecord,
  createDefaultAiDraftQueueConfigForm,
  normalizeAiDraftQueueConfigPayload,
  validateAiDraftQueueConfigForm
} from './shared';

const message = useMessage();
const authStore = useAuthStore();

const formModel = reactive(createDefaultAiDraftQueueConfigForm());
const loading = shallowRef(false);
const saving = shallowRef(false);
const updatedAt = shallowRef<string | null>(null);
const updatedByName = shallowRef<string | null>(null);

const isSuperAdmin = computed(() => authStore.userInfo.roles.includes('R_SUPER'));
const canSave = computed(() => isSuperAdmin.value && !validateAiDraftQueueConfigForm(formModel));
const formattedUpdatedAt = computed(() => {
  if (!updatedAt.value || dayjs(updatedAt.value).valueOf() <= 0) {
    return '尚未加载';
  }

  return dayjs(updatedAt.value).format('YYYY-MM-DD HH:mm:ss');
});
const updatedByText = computed(() => updatedByName.value || '系统默认');

onMounted(() => {
  if (isSuperAdmin.value) {
    void loadConfig(false);
  }
});

/** Load the platform-level AI draft queue config for super administrators. */
async function loadConfig(showMessage = true) {
  if (!isSuperAdmin.value || loading.value) {
    return;
  }

  loading.value = true;

  try {
    const { data, error } = await fetchCrmAiDraftQueueConfig();

    if (error) {
      return;
    }

    Object.assign(formModel, createAiDraftQueueConfigFormFromRecord(data));
    updatedAt.value = data.updatedAt;
    updatedByName.value = data.updatedByName;

    if (showMessage) {
      message.success('AI 草稿队列配置已加载');
    }
  } finally {
    loading.value = false;
  }
}

/** Save the platform-level AI draft queue config. */
async function saveConfig() {
  const validationMessage = validateAiDraftQueueConfigForm(formModel);

  if (validationMessage) {
    message.warning(validationMessage);
    return;
  }

  saving.value = true;

  try {
    const { data, error } = await saveCrmAiDraftQueueConfig(normalizeAiDraftQueueConfigPayload(formModel));

    if (error) {
      return;
    }

    Object.assign(formModel, createAiDraftQueueConfigFormFromRecord(data));
    updatedAt.value = data.updatedAt;
    updatedByName.value = data.updatedByName;
    message.success('AI 草稿队列配置已保存');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <NCard :bordered="false" size="small" class="card-wrapper" title="AI 草稿队列">
    <NSpace vertical :size="12">
      <NAlert type="info" :bordered="false">
        这里控制批量生成开发信草稿时的 AI 并发和失败重试，不会触发 Gmail 真实发送。
      </NAlert>

      <NAlert v-if="!isSuperAdmin" type="warning" :bordered="false">
        仅平台超级管理员可调整 AI 草稿队列参数；普通用户只使用平台默认限制。
      </NAlert>

      <template v-else>
        <NForm :model="formModel" label-placement="top" size="small">
          <NGrid responsive="screen" :x-gap="12" :y-gap="4" cols="1 s:2 m:6">
            <NGi>
              <NFormItem label="默认并发">
                <NInputNumber
                  v-model:value="formModel.itemConcurrency"
                  :min="1"
                  :max="formModel.maxItemConcurrency ?? 5"
                  :precision="0"
                  class="config-number-input"
                >
                  <template #suffix>封</template>
                </NInputNumber>
              </NFormItem>
            </NGi>

            <NGi>
              <NFormItem label="最大并发">
                <NInputNumber
                  v-model:value="formModel.maxItemConcurrency"
                  :min="1"
                  :precision="0"
                  class="config-number-input"
                >
                  <template #suffix>封</template>
                </NInputNumber>
              </NFormItem>
            </NGi>

            <NGi>
              <NFormItem label="用户活跃任务">
                <NInputNumber
                  v-model:value="formModel.maxActiveTasksPerUser"
                  :min="1"
                  :precision="0"
                  class="config-number-input"
                >
                  <template #suffix>个</template>
                </NInputNumber>
              </NFormItem>
            </NGi>

            <NGi>
              <NFormItem label="组织活跃任务">
                <NInputNumber
                  v-model:value="formModel.maxActiveTasksPerOrg"
                  :min="1"
                  :precision="0"
                  class="config-number-input"
                >
                  <template #suffix>个</template>
                </NInputNumber>
              </NFormItem>
            </NGi>

            <NGi>
              <NFormItem label="失败重试">
                <NInputNumber
                  v-model:value="formModel.maxAttempts"
                  :min="1"
                  :precision="0"
                  class="config-number-input"
                >
                  <template #suffix>次</template>
                </NInputNumber>
              </NFormItem>
            </NGi>

            <NGi>
              <NFormItem label="重试间隔">
                <NInput v-model:value="formModel.retryBackoffSecondsText" placeholder="30,60,120" />
              </NFormItem>
            </NGi>
          </NGrid>
        </NForm>

        <div class="ai-draft-config-footer">
          <NText depth="3" class="updated-time">
            更新：{{ formattedUpdatedAt }} / {{ updatedByText }}
          </NText>
          <NSpace :size="8">
            <NButton size="small" :loading="loading" @click="loadConfig()">重新加载</NButton>
            <NButton size="small" type="primary" :loading="saving" :disabled="!canSave" @click="saveConfig">
              保存
            </NButton>
          </NSpace>
        </div>
      </template>
    </NSpace>
  </NCard>
</template>

<style scoped>
.config-number-input {
  width: 100%;
}

.ai-draft-config-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.updated-time {
  font-size: 12px;
}

@media (max-width: 640px) {
  .ai-draft-config-footer {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
