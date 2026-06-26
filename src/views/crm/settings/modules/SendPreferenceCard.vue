<script setup lang="ts">
import { computed, onMounted, reactive, shallowRef } from 'vue';
import { useMessage } from 'naive-ui';
import { fetchCrmSendPreference, saveCrmSendPreference } from '@/service/api';
import { createDefaultSendPreferenceForm, isValidDailySendLimit, isValidFollowUpSharePercent } from './shared';

const message = useMessage();

const formModel = reactive<Api.Crm.SendPreferenceFormModel>(createDefaultSendPreferenceForm());
const loading = shallowRef(false);
const saving = shallowRef(false);

const firstTouchSharePercent = computed<number | null>(() => {
  if (!isValidFollowUpSharePercent(formModel.followUpSharePercent)) {
    return null;
  }

  return 100 - formModel.followUpSharePercent;
});
const canSave = computed(
  () =>
    isValidDailySendLimit(formModel.dailySendLimit, formModel.ownerDailySendLimitMax) &&
    isValidFollowUpSharePercent(formModel.followUpSharePercent)
);

onMounted(() => {
  void loadSendPreference(false);
});

/** Load current owner's send scheduling preference. */
async function loadSendPreference(showMessage = true) {
  if (loading.value) {
    return;
  }

  loading.value = true;

  try {
    const { data, error } = await fetchCrmSendPreference();

    if (error) {
      return;
    }

    formModel.dailySendLimit = data.dailySendLimit;
    formModel.followUpSharePercent = data.followUpSharePercent;
    formModel.emailOpenTrackingEnabled = data.emailOpenTrackingEnabled;
    formModel.ownerDailySendLimitMax = data.ownerDailySendLimitMax;

    if (showMessage) {
      message.success('发送偏好已加载');
    }
  } finally {
    loading.value = false;
  }
}

/** Save current owner's send scheduling preference. */
async function saveSendPreference() {
  if (saving.value) {
    return;
  }

  const dailySendLimit = formModel.dailySendLimit;
  const followUpSharePercent = formModel.followUpSharePercent;

  if (!isValidDailySendLimit(dailySendLimit, formModel.ownerDailySendLimitMax)) {
    message.warning(`请输入 1-${formModel.ownerDailySendLimitMax} 的每日队列上限`);
    return;
  }

  if (!isValidFollowUpSharePercent(followUpSharePercent)) {
    message.warning('请输入 0-100 的后续开发信占比');
    return;
  }

  saving.value = true;

  try {
    const { data, error } = await saveCrmSendPreference({
      dailySendLimit,
      followUpSharePercent,
      emailOpenTrackingEnabled: formModel.emailOpenTrackingEnabled
    });

    if (error) {
      return;
    }

    formModel.dailySendLimit = data.dailySendLimit;
    formModel.followUpSharePercent = data.followUpSharePercent;
    formModel.emailOpenTrackingEnabled = data.emailOpenTrackingEnabled;
    formModel.ownerDailySendLimitMax = data.ownerDailySendLimitMax;
    message.success('发送偏好已保存');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <NCard :bordered="false" size="small" class="card-wrapper" title="我的发送偏好">
    <NSpace vertical :size="12">
      <NText depth="3">这里决定每天最多发多少封，以及发送里新客户首封和老客户跟进各占多少。</NText>

      <NForm :model="formModel" label-placement="top" size="small">
        <div class="send-preference-fields">
          <NFormItem label="每日最多进入发送队列" class="send-preference-field send-preference-field--limit">
            <NInputNumber
              v-model:value="formModel.dailySendLimit"
              :min="1"
              :max="formModel.ownerDailySendLimitMax"
              :precision="0"
              class="send-preference-number-input"
            >
              <template #suffix>封</template>
            </NInputNumber>
          </NFormItem>

          <NFormItem label="后续开发信占比" class="send-preference-field">
            <NInputNumber
              v-model:value="formModel.followUpSharePercent"
              :min="0"
              :max="100"
              :precision="0"
              class="send-preference-number-input"
            >
              <template #suffix>%</template>
            </NInputNumber>
          </NFormItem>

          <NFormItem label="首封开发信占比（自动）" class="send-preference-field">
            <NInputNumber
              :value="firstTouchSharePercent"
              :show-button="false"
              disabled
              class="send-preference-number-input"
            >
              <template #suffix>%</template>
            </NInputNumber>
          </NFormItem>

          <NFormItem label="打开追踪" class="send-preference-field">
            <NSwitch v-model:value="formModel.emailOpenTrackingEnabled" :disabled="loading || saving">
              <template #checked>开启</template>
              <template #unchecked>关闭</template>
            </NSwitch>
          </NFormItem>
        </div>
      </NForm>

      <NText depth="3" class="send-preference-summary">
        每天最多 {{ formModel.dailySendLimit }} 封 · 老客户跟进 {{ formModel.followUpSharePercent }}% · 新客户首封
        {{ firstTouchSharePercent ?? '—' }}% · 打开追踪{{ formModel.emailOpenTrackingEnabled ? '开启' : '关闭' }}
      </NText>

      <div class="send-preference-footer">
        <NText depth="3" class="send-preference-note">平台硬上限：每日 {{ formModel.ownerDailySendLimitMax }} 封</NText>
        <NSpace :size="8">
          <NButton size="small" :loading="loading" @click="loadSendPreference()">重新加载</NButton>
          <NButton size="small" type="primary" :loading="saving" :disabled="!canSave" @click="saveSendPreference">
            保存
          </NButton>
        </NSpace>
      </div>
    </NSpace>
  </NCard>
</template>

<style scoped>
.send-preference-fields {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
}

.send-preference-field {
  flex: 0 1 180px;
}

.send-preference-field--limit {
  flex-basis: 220px;
}

.send-preference-number-input {
  width: 100%;
}

.send-preference-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.send-preference-note {
  font-size: 12px;
}

.send-preference-summary {
  font-size: 13px;
}

@media (max-width: 640px) {
  .send-preference-field,
  .send-preference-field--limit {
    flex-basis: 100%;
  }

  .send-preference-footer {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
