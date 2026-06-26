<script setup lang="ts">
import { computed, onMounted, reactive, shallowRef } from 'vue';
import dayjs from 'dayjs';
import { useMessage } from 'naive-ui';
import { hasPermission } from '@soybean/shared';
import { fetchCrmGlobalConfig, saveCrmGlobalConfig } from '@/service/api';
import { useAuthStore } from '@/store/modules/auth';
import {
  createDefaultGlobalConfigForm,
  createDefaultSendWindow,
  isValidEmailVerificationCooldownDays,
  isValidFollowUpDelayDays,
  isValidOwnerConcurrentSendLimit,
  isValidOwnerDailySendLimitMax,
  isValidSendWindows,
  isValidSendWorkdays
} from './shared';

const workdayOptions = [
  { label: '周日', value: 0 },
  { label: '周一', value: 1 },
  { label: '周二', value: 2 },
  { label: '周三', value: 3 },
  { label: '周四', value: 4 },
  { label: '周五', value: 5 },
  { label: '周六', value: 6 }
];

const message = useMessage();
const authStore = useAuthStore();

const formModel = reactive<Api.Crm.GlobalConfigFormModel>(createDefaultGlobalConfigForm());
const loading = shallowRef(false);
const saving = shallowRef(false);
const updatedAt = shallowRef<string | null>(null);

const canManageGlobalConfig = computed(() => hasPermission(authStore.userInfo, 'crm:settings:global:write'));
const canAddWindow = computed(() => formModel.sendWindows.length < 4);
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

/** Load global config and keep hidden fields intact for a full save payload. */
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

    applyGlobalConfig(data);

    if (showMessage) {
      message.success('客户工作时间已加载');
    }
  } finally {
    loading.value = false;
  }
}

/** Save the customer local work time config together with the current global settings. */
async function saveWorkTime() {
  if (!canManageGlobalConfig.value) {
    return;
  }

  if (!isValidSendWorkdays(formModel.sendWorkdays)) {
    message.warning('请至少选择一个工作日');
    return;
  }

  if (!isValidSendWindows(formModel.sendWindows)) {
    message.warning('请检查工作时间段，开始时间必须早于结束时间');
    return;
  }

  if (
    !isValidEmailVerificationCooldownDays(formModel.emailVerificationCooldownDays) ||
    !isValidOwnerConcurrentSendLimit(formModel.ownerConcurrentSendLimit) ||
    !isValidOwnerDailySendLimitMax(formModel.ownerDailySendLimitMax) ||
    !isValidFollowUpDelayDays(formModel.followUpDelayDays)
  ) {
    message.warning('请先重新加载全局配置');
    return;
  }

  saving.value = true;

  try {
    const { data, error } = await saveCrmGlobalConfig({
      emailVerificationCooldownDays: formModel.emailVerificationCooldownDays,
      ownerConcurrentSendLimit: formModel.ownerConcurrentSendLimit,
      ownerDailySendLimitMax: formModel.ownerDailySendLimitMax,
      followUpDelayDays: formModel.followUpDelayDays,
      sendWorkdays: [...formModel.sendWorkdays],
      sendWindows: formModel.sendWindows.map(window => ({ ...window }))
    });

    if (error) {
      return;
    }

    applyGlobalConfig(data);
    message.success('客户工作时间已保存');
  } finally {
    saving.value = false;
  }
}

function applyGlobalConfig(data: Api.Crm.GlobalConfig) {
  formModel.emailVerificationCooldownDays = data.emailVerificationCooldownDays;
  formModel.ownerConcurrentSendLimit = data.ownerConcurrentSendLimit;
  formModel.ownerDailySendLimitMax = data.ownerDailySendLimitMax;
  formModel.followUpDelayDays = { ...data.followUpDelayDays };
  formModel.sendWorkdays = [...data.sendWorkdays];
  formModel.sendWindows = data.sendWindows.map(window => ({ ...window }));
  updatedAt.value = data.updatedAt;
}

function addWindow() {
  if (!canAddWindow.value) {
    return;
  }

  formModel.sendWindows.push(createDefaultSendWindow());
}

function removeWindow(index: number) {
  if (formModel.sendWindows.length <= 1) {
    return;
  }

  formModel.sendWindows.splice(index, 1);
}

function updateWindowMinute(index: number, key: keyof Api.Crm.SendWindow, value: string | null) {
  const minute = parseTimeText(value);

  if (minute === null) {
    return;
  }

  formModel.sendWindows[index][key] = minute;
}

function formatMinute(value: number) {
  const hour = Math.floor(value / 60);
  const minute = value % 60;

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function parseTimeText(value: string | null) {
  const match = value?.match(/^(\d{2}):(\d{2})$/);

  if (!match) {
    return null;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }

  return hour * 60 + minute;
}
</script>

<template>
  <NCard :bordered="false" size="small" class="card-wrapper" title="客户工作时间">
    <NSpace vertical :size="12">
      <NAlert v-if="!canManageGlobalConfig" type="warning" :bordered="false">
        当前账号没有 CRM 全局配置权限，暂不能调整客户工作时间。
      </NAlert>

      <template v-else>
        <NForm :model="formModel" label-placement="top" size="small">
          <NFormItem label="工作日">
            <NCheckboxGroup v-model:value="formModel.sendWorkdays">
              <NSpace :size="8">
                <NCheckbox
                  v-for="option in workdayOptions"
                  :key="option.value"
                  :value="option.value"
                  :label="option.label"
                />
              </NSpace>
            </NCheckboxGroup>
          </NFormItem>

          <NFormItem label="客户当地时间">
            <NSpace vertical :size="8" class="work-time-window-list">
              <div v-for="(window, index) in formModel.sendWindows" :key="index" class="work-time-window">
                <NTimePicker
                  :formatted-value="formatMinute(window.startMinute)"
                  format="HH:mm"
                  value-format="HH:mm"
                  size="small"
                  class="work-time-picker"
                  @update:formatted-value="value => updateWindowMinute(index, 'startMinute', value)"
                />
                <span class="work-time-separator">至</span>
                <NTimePicker
                  :formatted-value="formatMinute(window.endMinute)"
                  format="HH:mm"
                  value-format="HH:mm"
                  size="small"
                  class="work-time-picker"
                  @update:formatted-value="value => updateWindowMinute(index, 'endMinute', value)"
                />
                <NTooltip>
                  <template #trigger>
                    <NButton
                      quaternary
                      circle
                      size="small"
                      :disabled="formModel.sendWindows.length <= 1"
                      @click="removeWindow(index)"
                    >
                      <template #icon>
                        <SvgIcon icon="material-symbols:delete-outline" />
                      </template>
                    </NButton>
                  </template>
                  删除时间段
                </NTooltip>
              </div>
            </NSpace>
          </NFormItem>
        </NForm>

        <div class="work-time-footer">
          <NText depth="3" class="updated-time">配置时间：{{ formattedUpdatedAt }}</NText>
          <NSpace :size="8">
            <NTooltip>
              <template #trigger>
                <NButton size="small" :disabled="!canAddWindow" @click="addWindow">
                  <template #icon>
                    <SvgIcon icon="ic:round-plus" />
                  </template>
                  增加时间段
                </NButton>
              </template>
              最多 4 个时间段
            </NTooltip>
            <NButton size="small" :loading="loading" @click="loadGlobalConfig()">重新加载</NButton>
            <NButton size="small" type="primary" :loading="saving" :disabled="!canSave" @click="saveWorkTime">
              保存
            </NButton>
          </NSpace>
        </div>
      </template>
    </NSpace>
  </NCard>
</template>

<style scoped>
.work-time-window-list {
  width: 100%;
}

.work-time-window {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.work-time-picker {
  width: 124px;
}

.work-time-separator {
  flex: 0 0 auto;
  color: var(--n-text-color-3);
  font-size: 13px;
}

.work-time-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.updated-time {
  font-size: 12px;
}

@media (max-width: 640px) {
  .work-time-window {
    align-items: flex-start;
    flex-direction: column;
  }

  .work-time-separator {
    display: none;
  }

  .work-time-picker {
    width: 100%;
  }

  .work-time-footer {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
