<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import { useMessage } from 'naive-ui';
import {
  formatNullableText,
  formatSequenceDate,
  messageStatusLabelMap,
  messageStatusTagTypeMap,
  sequenceStatusLabelMap,
  sequenceStatusTagTypeMap
} from './shared';

const props = defineProps<{
  approving?: boolean;
  item: Api.Crm.SequenceReviewItem | null;
  loading?: boolean;
  saving?: boolean;
  show: boolean;
}>();

const emit = defineEmits<{
  approve: [];
  save: [payload: Api.Crm.MessageDraftPayload];
  'update:show': [show: boolean];
}>();

const message = useMessage();
const drawerVisible = computed({
  get: () => props.show,
  set: value => emit('update:show', value)
});
const draftForm = reactive<Api.Crm.MessageDraftPayload>({
  subject: '',
  bodyText: ''
});
const currentMessage = computed(() => props.item?.firstMessage ?? null);
const canEdit = computed(() => {
  const status = currentMessage.value?.status;
  return Boolean(props.item?.canOperateDraft && status === 'draft_pending_review');
});
const canApprove = computed(() => Boolean(props.item?.canOperateDraft && currentMessage.value?.status === 'draft_pending_review'));

watch(
  () => props.item?.firstMessage?.id,
  () => {
    draftForm.subject = props.item?.firstMessage?.subject ?? '';
    draftForm.bodyText = props.item?.firstMessage?.bodyText ?? '';
  },
  { immediate: true }
);

function handleSave() {
  if (!draftForm.subject.trim() || !draftForm.bodyText.trim()) {
    message.warning('请填写主题和正文');
    return;
  }

  if (draftForm.subject.trim().length > 200 || draftForm.bodyText.trim().length > 5000) {
    message.warning('主题不能超过 200 字，正文不能超过 5000 字');
    return;
  }

  emit('save', {
    subject: draftForm.subject.trim(),
    bodyText: draftForm.bodyText.trim()
  });
}
</script>

<template>
  <NDrawer v-model:show="drawerVisible" :width="760" placement="right">
    <NDrawerContent title="首封草稿审核" closable>
      <NSpin :show="loading">
        <NSpace v-if="item" vertical :size="16">
          <div class="review-summary">
            <NSpace align="center" :size="8">
              <NTag :type="sequenceStatusTagTypeMap[item.enrollment.status]" :bordered="false" size="small">
                {{ sequenceStatusLabelMap[item.enrollment.status] }}
              </NTag>
              <NTag
                v-if="item.firstMessage"
                :type="messageStatusTagTypeMap[item.firstMessage.status]"
                :bordered="false"
                size="small"
              >
                {{ messageStatusLabelMap[item.firstMessage.status] }}
              </NTag>
            </NSpace>
            <div class="review-title">{{ item.account.name }}</div>
            <div class="review-subtitle">
              {{ formatNullableText(item.contact.fullName || item.contact.title) }} · {{ item.contact.maskedEmail }}
            </div>
          </div>

          <NDescriptions :column="1" bordered size="small" label-placement="left">
            <NDescriptionsItem label="产品线">{{ item.productLine?.name || '-' }}</NDescriptionsItem>
            <NDescriptionsItem label="发送邮箱">{{ item.mailbox?.maskedEmail || '-' }}</NDescriptionsItem>
            <NDescriptionsItem label="更新时间">{{ formatSequenceDate(item.enrollment.updatedAt) }}</NDescriptionsItem>
          </NDescriptions>

          <div class="drawer-section">
            <div class="section-title">发送前检查</div>
            <NSpace vertical :size="8">
              <NAlert
                v-for="check in item.checklist"
                :key="check.key"
                :type="check.passed ? 'success' : 'warning'"
                :bordered="false"
              >
                <span class="check-label">{{ check.label }}</span>
                <span>{{ check.message }}</span>
              </NAlert>
            </NSpace>
          </div>

          <div class="drawer-section">
            <div class="section-title">首封草稿</div>
            <NForm :model="draftForm" label-placement="top" size="small">
              <NFormItem label="主题">
                <NInput v-model:value="draftForm.subject" :disabled="!canEdit" maxlength="200" show-count />
              </NFormItem>
              <NFormItem label="正文">
                <NInput
                  v-model:value="draftForm.bodyText"
                  type="textarea"
                  :disabled="!canEdit"
                  maxlength="5000"
                  show-count
                  :autosize="{ minRows: 12, maxRows: 18 }"
                />
              </NFormItem>
            </NForm>
          </div>
        </NSpace>
        <NEmpty v-else description="请选择审核项" />
      </NSpin>

      <template #footer>
        <NSpace justify="end">
          <NButton @click="drawerVisible = false">关闭</NButton>
          <NButton :disabled="loading || approving || !item?.firstMessage || !canEdit" :loading="saving" @click="handleSave">
            保存草稿
          </NButton>
          <NButton
            type="primary"
            :disabled="loading || saving || !item?.firstMessage || !canApprove"
            :loading="approving"
            @click="emit('approve')"
          >
            确认草稿
          </NButton>
        </NSpace>
      </template>
    </NDrawerContent>
  </NDrawer>
</template>

<style scoped>
.review-summary,
.drawer-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.review-summary {
  border-bottom: 1px solid var(--n-divider-color);
  padding-bottom: 14px;
}

.review-title {
  color: var(--n-text-color);
  font-size: 18px;
  font-weight: 600;
}

.review-subtitle {
  color: var(--n-text-color-3);
  font-size: 12px;
}

.section-title {
  color: var(--n-text-color);
  font-size: 14px;
  font-weight: 600;
}

.check-label {
  margin-right: 8px;
  font-weight: 600;
}
</style>
