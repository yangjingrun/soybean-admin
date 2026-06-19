<script setup lang="ts">
import { computed, reactive, shallowRef, watch } from 'vue';
import { useMessage } from 'naive-ui';
import SendAuditPanel from './SendAuditPanel.vue';
import {
  formatNullableText,
  formatSequenceDate,
  buildDraftReviewOperationPayload,
  buildSequencePolicyReviewHints,
  canGenerateNextSequenceDraft,
  type DraftReviewApprovePayload,
  type DraftReviewSavePayload,
  messageStatusLabelMap,
  messageStatusTagTypeMap,
  sequenceStatusLabelMap,
  sequenceStatusTagTypeMap
} from './shared';

const props = defineProps<{
  approving?: boolean;
  item: Api.Crm.SequenceReviewItem | null;
  loading?: boolean;
  nextDraftGenerating?: boolean;
  refreshing?: boolean;
  saving?: boolean;
  sendStarting?: boolean;
  show: boolean;
  stopping?: boolean;
}>();

const emit = defineEmits<{
  approveDraft: [payload: DraftReviewApprovePayload];
  generateNextDraft: [];
  refresh: [];
  saveDraft: [payload: DraftReviewSavePayload];
  startSend: [];
  stop: [];
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
const selectedMessageId = shallowRef<string | null>(null);
const reviewMessages = computed(() => {
  if (props.item?.messages.length) return props.item.messages;
  return props.item?.firstMessage ? [props.item.firstMessage] : [];
});
const currentMessage = computed(
  () => reviewMessages.value.find(item => item.id === selectedMessageId.value) ?? reviewMessages.value[0] ?? null
);
const isFirstMessageSelected = computed(() => currentMessage.value?.stepIndex === 1);
const operableFollowUpEnrollmentStatuses: Api.Crm.SequenceEnrollmentStatus[] = ['ready_to_send', 'sequence_running'];
const canOperateSelectedDraft = computed(() =>
  Boolean(
    props.item?.canOperateDraft &&
    currentMessage.value?.status === 'draft_pending_review' &&
    (isFirstMessageSelected.value || operableFollowUpEnrollmentStatuses.includes(props.item.enrollment.status))
  )
);
const canEdit = computed(() => {
  return canOperateSelectedDraft.value;
});
const canApprove = computed(() => canOperateSelectedDraft.value);
const canStartSend = computed(() =>
  Boolean(
    props.item?.canOperateDraft &&
    isFirstMessageSelected.value &&
    props.item.enrollment.status === 'ready_to_send' &&
    currentMessage.value?.status === 'draft_ready'
  )
);
const canGenerateNextDraft = computed(() => Boolean(props.item && canGenerateNextSequenceDraft(props.item)));
const policyReviewHints = computed(() =>
  props.item ? buildSequencePolicyReviewHints(props.item, currentMessage.value) : []
);
const canRefreshSequence = computed(() =>
  Boolean(props.item && ['sequence_running', 'paused', 'stopped'].includes(props.item.enrollment.status))
);
const canStopSequence = computed(() =>
  Boolean(
    props.item?.canControlSequence &&
    ['draft_review_pending', 'ready_to_send', 'sequence_running', 'paused'].includes(props.item.enrollment.status)
  )
);
const statusTip = computed(() => {
  if (props.item?.enrollment.status === 'stopped') return '序列已停止，旧发送任务会在执行前跳过';
  if (!currentMessage.value) return '暂无草稿';
  if (!isFirstMessageSelected.value && currentMessage.value.status === 'draft_pending_review')
    return '确认后会按计划时间进入发送队列';
  if (currentMessage.value.status === 'draft_pending_review') return '草稿待人工确认后才能进入发送队列';
  if (currentMessage.value.status === 'draft_ready') return '草稿已确认，可以启动首封发送';
  if (currentMessage.value.status === 'queued') return '开发信已进入发送队列';
  if (currentMessage.value.status === 'sent') return '开发信已发送';
  if (currentMessage.value.status === 'failed') return '发送失败，重试操作暂未开放';
  if (currentMessage.value.status === 'skipped') return '开发信已跳过，不会继续发送';
  return '当前邮件不可发送';
});

watch(
  () => [props.item?.enrollment.id, reviewMessages.value.map(item => item.id).join('|')] as const,
  () => {
    const stillExists = reviewMessages.value.some(item => item.id === selectedMessageId.value);
    selectedMessageId.value = stillExists
      ? selectedMessageId.value
      : (reviewMessages.value.find(item => item.status === 'draft_pending_review')?.id ??
        reviewMessages.value[0]?.id ??
        null);
  },
  { immediate: true }
);

watch(
  () => [currentMessage.value?.id, currentMessage.value?.subject, currentMessage.value?.bodyText] as const,
  () => {
    draftForm.subject = currentMessage.value?.subject ?? '';
    draftForm.bodyText = currentMessage.value?.bodyText ?? '';
  },
  { immediate: true }
);

function handleSave() {
  const messageId = currentMessage.value?.id;

  if (!messageId || !canEdit.value) {
    return;
  }

  if (!draftForm.subject.trim() || !draftForm.bodyText.trim()) {
    message.warning('请填写主题和正文');
    return;
  }

  if (draftForm.subject.trim().length > 200 || draftForm.bodyText.trim().length > 5000) {
    message.warning('主题不能超过 200 字，正文不能超过 5000 字');
    return;
  }

  emit(
    'saveDraft',
    buildDraftReviewOperationPayload(messageId, {
      subject: draftForm.subject.trim(),
      bodyText: draftForm.bodyText.trim()
    })
  );
}

function handleApprove() {
  const messageId = currentMessage.value?.id;

  if (!messageId || !canApprove.value) {
    return;
  }

  emit('approveDraft', { messageId });
}
</script>

<template>
  <NDrawer v-model:show="drawerVisible" :width="760" placement="right">
    <NDrawerContent title="开发信草稿审核" closable>
      <NSpin :show="loading">
        <NSpace v-if="item" vertical :size="16">
          <div class="review-summary">
            <NSpace align="center" :size="8">
              <NTag :type="sequenceStatusTagTypeMap[item.enrollment.status]" :bordered="false" size="small">
                {{ sequenceStatusLabelMap[item.enrollment.status] }}
              </NTag>
              <NTag
                v-if="currentMessage"
                :type="messageStatusTagTypeMap[currentMessage.status]"
                :bordered="false"
                size="small"
              >
                {{ messageStatusLabelMap[currentMessage.status] }}
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

          <NDescriptions :column="2" bordered size="small" label-placement="left">
            <NDescriptionsItem label="运行版本">{{ item.enrollment.runVersion }}</NDescriptionsItem>
            <NDescriptionsItem label="队列 Job">{{ formatNullableText(currentMessage?.bullJobId) }}</NDescriptionsItem>
            <NDescriptionsItem label="计划发送">
              {{ currentMessage?.scheduledAt ? formatSequenceDate(currentMessage.scheduledAt) : '-' }}
            </NDescriptionsItem>
            <NDescriptionsItem label="实际发送">
              {{ currentMessage?.sentAt ? formatSequenceDate(currentMessage.sentAt) : '-' }}
            </NDescriptionsItem>
          </NDescriptions>

          <div v-if="reviewMessages.length > 1" class="message-switcher">
            <NRadioGroup v-model:value="selectedMessageId" size="small">
              <NRadioButton v-for="reviewMessage in reviewMessages" :key="reviewMessage.id" :value="reviewMessage.id">
                第 {{ reviewMessage.stepIndex }} 封
              </NRadioButton>
            </NRadioGroup>
          </div>

          <SendAuditPanel :item="item" :current-message="currentMessage" />

          <NDescriptions
            v-if="policyReviewHints.length"
            :column="1"
            bordered
            size="small"
            label-placement="left"
          >
            <NDescriptionsItem v-for="hint in policyReviewHints" :key="hint.key" :label="hint.label">
              <NSpace align="center" :size="8">
                <NTag :type="hint.tagType" :bordered="false" size="small">{{ hint.status }}</NTag>
                <span class="policy-hint-text">{{ hint.description }}</span>
              </NSpace>
            </NDescriptionsItem>
          </NDescriptions>

          <div class="drawer-section">
            <div class="section-title">第 {{ currentMessage?.stepIndex ?? 1 }} 封草稿</div>
            <NAlert type="info" :bordered="false" class="status-alert">
              {{ statusTip }}
            </NAlert>
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
          <NButton
            :disabled="
              loading || saving || approving || sendStarting || stopping || nextDraftGenerating || !canRefreshSequence
            "
            :loading="refreshing"
            @click="emit('refresh')"
          >
            刷新状态
          </NButton>
          <NPopconfirm positive-text="停止" negative-text="取消" @positive-click="emit('stop')">
            <template #trigger>
              <NButton
                type="error"
                secondary
                :disabled="
                  loading ||
                    saving ||
                    approving ||
                    sendStarting ||
                    refreshing ||
                    nextDraftGenerating ||
                    !canStopSequence
                "
                :loading="stopping"
              >
                停止序列
              </NButton>
            </template>
            停止后当前序列不会继续发送，队列中的旧任务也会失效。
          </NPopconfirm>
          <NButton
            :disabled="
              loading ||
                approving ||
                refreshing ||
                sendStarting ||
                stopping ||
                nextDraftGenerating ||
                !currentMessage ||
                !canEdit
            "
            :loading="saving"
            @click="handleSave"
          >
            保存草稿
          </NButton>
          <NButton
            :disabled="
              loading ||
                saving ||
                refreshing ||
                sendStarting ||
                stopping ||
                nextDraftGenerating ||
                !currentMessage ||
                !canApprove
            "
            :loading="approving"
            @click="handleApprove"
          >
            确认草稿
          </NButton>
          <NButton
            :disabled="
              loading || saving || approving || refreshing || sendStarting || stopping || !canGenerateNextDraft
            "
            :loading="nextDraftGenerating"
            @click="emit('generateNextDraft')"
          >
            生成下一封草稿
          </NButton>
          <NButton
            type="primary"
            :disabled="
              loading ||
                saving ||
                approving ||
                refreshing ||
                stopping ||
                nextDraftGenerating ||
                !currentMessage ||
                !canStartSend
            "
            :loading="sendStarting"
            @click="emit('startSend')"
          >
            启动发送
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

.policy-hint-text {
  color: var(--n-text-color-2);
  font-size: 12px;
}

.section-title {
  color: var(--n-text-color);
  font-size: 14px;
  font-weight: 600;
}

.status-alert {
  margin-bottom: 10px;
}

.message-switcher {
  display: flex;
  justify-content: flex-start;
}
</style>
