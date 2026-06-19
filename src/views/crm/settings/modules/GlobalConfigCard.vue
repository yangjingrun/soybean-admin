<script setup lang="ts">
import { computed, onMounted, reactive, shallowRef } from 'vue';
import dayjs from 'dayjs';
import { useMessage } from 'naive-ui';
import { fetchCrmGlobalConfig, saveCrmGlobalConfig } from '@/service/api';
import { useAuthStore } from '@/store/modules/auth';
import { createDefaultGlobalConfigForm, isValidEmailVerificationCooldownDays } from './shared';

const message = useMessage();
const authStore = useAuthStore();

const formModel = reactive<Api.Crm.GlobalConfigFormModel>(createDefaultGlobalConfigForm());
const loading = shallowRef(false);
const saving = shallowRef(false);
const updatedAt = shallowRef<string | null>(null);

const isSuperAdmin = computed(() => authStore.userInfo.roles.includes('R_SUPER'));
const canSave = computed(
  () => isSuperAdmin.value && isValidEmailVerificationCooldownDays(formModel.emailVerificationCooldownDays)
);
const formattedUpdatedAt = computed(() => {
  if (!updatedAt.value || dayjs(updatedAt.value).valueOf() <= 0) {
    return '尚未加载';
  }

  return dayjs(updatedAt.value).format('YYYY-MM-DD HH:mm:ss');
});

onMounted(() => {
  if (isSuperAdmin.value) {
    void loadGlobalConfig(false);
  }
});

/** Load the platform-wide CRM global config for super administrators. */
async function loadGlobalConfig(showMessage = true) {
  if (!isSuperAdmin.value || loading.value) {
    return;
  }

  loading.value = true;

  try {
    const { data, error } = await fetchCrmGlobalConfig();

    if (error) {
      return;
    }

    formModel.emailVerificationCooldownDays = data.emailVerificationCooldownDays;
    updatedAt.value = data.updatedAt;

    if (showMessage) {
      message.success('CRM 全局配置已加载');
    }
  } finally {
    loading.value = false;
  }
}

/** Save the platform-wide email verification cache cooldown. */
async function saveGlobalConfig() {
  const emailVerificationCooldownDays = formModel.emailVerificationCooldownDays;

  if (!isValidEmailVerificationCooldownDays(emailVerificationCooldownDays)) {
    message.warning('请输入 1-365 的冷却天数');
    return;
  }

  saving.value = true;

  try {
    const { data, error } = await saveCrmGlobalConfig({
      emailVerificationCooldownDays
    });

    if (error) {
      return;
    }

    formModel.emailVerificationCooldownDays = data.emailVerificationCooldownDays;
    updatedAt.value = data.updatedAt;
    message.success('CRM 全局配置已保存');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <NCard :bordered="false" size="small" class="card-wrapper" title="邮箱验证冷却期">
    <NSpace vertical :size="12">
      <NAlert type="info" :bordered="false">
        邮箱验证结果是全平台共享缓存。冷却期内同一 email 不会重复做 DNS / MX 等验证，不属于某个组织的私有配置。
      </NAlert>

      <NAlert v-if="!isSuperAdmin" type="warning" :bordered="false">
        仅平台超级管理员可查看和调整该全局参数；组织用户的线索与邮件数据仍按组织和负责人隔离。
      </NAlert>

      <template v-else>
        <NForm :model="formModel" label-placement="top" size="small">
          <NFormItem label="冷却天数">
            <NInputNumber
              v-model:value="formModel.emailVerificationCooldownDays"
              :min="1"
              :max="365"
              :precision="0"
              class="cooldown-days-input"
            >
              <template #suffix>天</template>
            </NInputNumber>
          </NFormItem>
        </NForm>

        <div class="global-config-footer">
          <NText depth="3" class="updated-time">配置时间：{{ formattedUpdatedAt }}</NText>
          <NSpace :size="8">
            <NButton size="small" :loading="loading" @click="loadGlobalConfig()">重新加载</NButton>
            <NButton size="small" type="primary" :loading="saving" :disabled="!canSave" @click="saveGlobalConfig">
              保存
            </NButton>
          </NSpace>
        </div>
      </template>
    </NSpace>
  </NCard>
</template>

<style scoped>
.cooldown-days-input {
  width: 180px;
}

.global-config-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.updated-time {
  font-size: 12px;
}

@media (max-width: 640px) {
  .global-config-footer {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
