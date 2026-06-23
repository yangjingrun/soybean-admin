<script setup lang="ts">
import { computed, onMounted, reactive, shallowRef } from 'vue';
import dayjs from 'dayjs';
import { useMessage } from 'naive-ui';
import { hasPermission } from '@soybean/shared';
import { fetchCrmGlobalConfig, saveCrmGlobalConfig } from '@/service/api';
import { useAuthStore } from '@/store/modules/auth';
import {
  createDefaultGlobalConfigForm,
  isValidEmailVerificationCooldownDays,
  isValidFollowUpDelayDays,
  isValidOwnerConcurrentSendLimit,
  isValidOwnerDailySendLimitMax,
  isValidSendWindows,
  isValidSendWorkdays
} from './shared';

const message = useMessage();
const authStore = useAuthStore();

const formModel = reactive<Api.Crm.GlobalConfigFormModel>(createDefaultGlobalConfigForm());
const loading = shallowRef(false);
const saving = shallowRef(false);
const updatedAt = shallowRef<string | null>(null);

const canManageGlobalConfig = computed(() => hasPermission(authStore.userInfo, 'crm:settings:global:write'));
const canSave = computed(
  () =>
    canManageGlobalConfig.value &&
    isValidEmailVerificationCooldownDays(formModel.emailVerificationCooldownDays) &&
    isValidOwnerConcurrentSendLimit(formModel.ownerConcurrentSendLimit) &&
    isValidOwnerDailySendLimitMax(formModel.ownerDailySendLimitMax) &&
    isValidFollowUpDelayDays(formModel.followUpDelayDays) &&
    isValidSendWorkdays(formModel.sendWorkdays) &&
    isValidSendWindows(formModel.sendWindows)
);
const formattedUpdatedAt = computed(() => {
  if (!updatedAt.value || dayjs(updatedAt.value).valueOf() <= 0) {
    return '尚未加载';
  }

  return dayjs(updatedAt.value).format('YYYY-MM-DD HH:mm:ss');
});

onMounted(() => {
  if (canManageGlobalConfig.value) {
    void loadGlobalConfig(false);
  }
});

/** Load the platform-wide CRM global config for super administrators. */
async function loadGlobalConfig(showMessage = true) {
  if (!canManageGlobalConfig.value || loading.value) {
    return;
  }

  loading.value = true;

  try {
    const { data, error } = await fetchCrmGlobalConfig();

    if (error) {
      return;
    }

    formModel.emailVerificationCooldownDays = data.emailVerificationCooldownDays;
    formModel.ownerConcurrentSendLimit = data.ownerConcurrentSendLimit;
    formModel.ownerDailySendLimitMax = data.ownerDailySendLimitMax;
    formModel.followUpDelayDays = { ...data.followUpDelayDays };
    formModel.sendWorkdays = [...data.sendWorkdays];
    formModel.sendWindows = data.sendWindows.map(window => ({ ...window }));
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
  if (!canManageGlobalConfig.value) {
    return;
  }

  const emailVerificationCooldownDays = formModel.emailVerificationCooldownDays;
  const ownerConcurrentSendLimit = formModel.ownerConcurrentSendLimit;
  const ownerDailySendLimitMax = formModel.ownerDailySendLimitMax;

  if (!isValidEmailVerificationCooldownDays(emailVerificationCooldownDays)) {
    message.warning('请输入 1-365 的冷却天数');
    return;
  }

  if (!isValidFollowUpDelayDays(formModel.followUpDelayDays)) {
    message.warning('请输入 1-90 的跟进间隔天数');
    return;
  }

  if (!isValidOwnerConcurrentSendLimit(ownerConcurrentSendLimit)) {
    message.warning('请输入 1-100 的并发邮件上限');
    return;
  }

  if (!isValidOwnerDailySendLimitMax(ownerDailySendLimitMax)) {
    message.warning('请输入大于 0 的每日发送硬上限');
    return;
  }

  saving.value = true;

  try {
    const { data, error } = await saveCrmGlobalConfig({
      emailVerificationCooldownDays,
      ownerConcurrentSendLimit,
      ownerDailySendLimitMax,
      followUpDelayDays: formModel.followUpDelayDays,
      sendWorkdays: formModel.sendWorkdays,
      sendWindows: formModel.sendWindows
    });

    if (error) {
      return;
    }

    formModel.emailVerificationCooldownDays = data.emailVerificationCooldownDays;
    formModel.ownerConcurrentSendLimit = data.ownerConcurrentSendLimit;
    formModel.ownerDailySendLimitMax = data.ownerDailySendLimitMax;
    formModel.followUpDelayDays = { ...data.followUpDelayDays };
    formModel.sendWorkdays = [...data.sendWorkdays];
    formModel.sendWindows = data.sendWindows.map(window => ({ ...window }));
    updatedAt.value = data.updatedAt;
    message.success('CRM 全局配置已保存');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <NCard :bordered="false" size="small" class="card-wrapper" title="CRM 全局配置">
    <NSpace vertical :size="12">
      <NAlert type="info" :bordered="false">
        邮箱验证结果是全平台共享缓存。冷却期内同一 email 不会重复做 DNS / MX 等验证，不属于某个组织的私有配置。
      </NAlert>

      <NAlert v-if="!canManageGlobalConfig" type="warning" :bordered="false">
        当前账号没有 CRM 全局配置权限；组织用户的客户与邮件数据仍按组织和负责人隔离。
      </NAlert>

      <template v-else>
        <NForm :model="formModel" label-placement="top" size="small">
          <NGrid responsive="screen" :x-gap="12" :y-gap="4" cols="1 s:2 m:7">
            <NGi>
              <NFormItem label="验证冷却">
                <NInputNumber
                  v-model:value="formModel.emailVerificationCooldownDays"
                  :min="1"
                  :max="365"
                  :precision="0"
                  class="config-number-input"
                >
                  <template #suffix>天</template>
                </NInputNumber>
              </NFormItem>
            </NGi>

            <NGi>
              <NFormItem label="用户并发">
                <NInputNumber
                  v-model:value="formModel.ownerConcurrentSendLimit"
                  :min="1"
                  :max="100"
                  :precision="0"
                  class="config-number-input"
                >
                  <template #suffix>封</template>
                </NInputNumber>
              </NFormItem>
            </NGi>

            <NGi>
              <NFormItem label="每日硬上限">
                <NInputNumber
                  v-model:value="formModel.ownerDailySendLimitMax"
                  :min="1"
                  :precision="0"
                  class="config-number-input"
                >
                  <template #suffix>封</template>
                </NInputNumber>
              </NFormItem>
            </NGi>

            <NGi>
              <NFormItem label="第 2 封">
                <NInputNumber
                  v-model:value="formModel.followUpDelayDays.step2Days"
                  :min="1"
                  :max="90"
                  :precision="0"
                  class="config-number-input"
                >
                  <template #suffix>天后</template>
                </NInputNumber>
              </NFormItem>
            </NGi>

            <NGi>
              <NFormItem label="第 3 封">
                <NInputNumber
                  v-model:value="formModel.followUpDelayDays.step3Days"
                  :min="1"
                  :max="90"
                  :precision="0"
                  class="config-number-input"
                >
                  <template #suffix>天后</template>
                </NInputNumber>
              </NFormItem>
            </NGi>

            <NGi>
              <NFormItem label="第 4 封">
                <NInputNumber
                  v-model:value="formModel.followUpDelayDays.step4Days"
                  :min="1"
                  :max="90"
                  :precision="0"
                  class="config-number-input"
                >
                  <template #suffix>天后</template>
                </NInputNumber>
              </NFormItem>
            </NGi>

            <NGi>
              <NFormItem label="第 5 封">
                <NInputNumber
                  v-model:value="formModel.followUpDelayDays.step5Days"
                  :min="1"
                  :max="90"
                  :precision="0"
                  class="config-number-input"
                >
                  <template #suffix>天后</template>
                </NInputNumber>
              </NFormItem>
            </NGi>
          </NGrid>
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
.config-number-input {
  width: 100%;
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
