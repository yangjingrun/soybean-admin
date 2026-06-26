<script setup lang="ts">
import { computed } from 'vue';
import {
  formatNullableText,
  formatSequenceDate,
  getFailedSequenceMessages,
  getMessageStatusView,
  getSequenceSendAuditSummary
} from './shared';

const props = defineProps<{
  currentMessage: Api.Crm.MessageRecord | null;
  item: Api.Crm.SequenceReviewItem;
}>();

const auditSummary = computed(() => getSequenceSendAuditSummary(props.item));
const failedMessages = computed(() => getFailedSequenceMessages(props.item.messages));
const currentMessageStatusView = computed(() =>
  props.currentMessage ? getMessageStatusView(props.currentMessage, props.item.enrollment.status) : null
);
const isCurrentMessageFailed = computed(() => props.currentMessage?.status === 'failed');
const recoveryHint = computed(() => {
  if (!isCurrentMessageFailed.value) return '当前邮件没有发送失败，无需处理失败重试';
  return '这封邮件尚未成功发出，可在底部选择“修改后再发送”或“直接重试”。';
});
</script>

<template>
  <div class="send-audit-panel">
    <div class="section-heading">
      <div>
        <div class="section-title">发送条件</div>
        <div class="section-subtitle">
          {{ auditSummary.description }}
        </div>
      </div>
      <NTag :type="auditSummary.tagType" :bordered="false" size="small">
        {{ auditSummary.label }}
      </NTag>
    </div>

    <NGrid responsive="screen" :x-gap="8" :y-gap="8">
      <NGi span="8">
        <NStatistic label="通过项" :value="auditSummary.passedCheckCount" />
      </NGi>
      <NGi span="8">
        <NStatistic label="预警项" :value="auditSummary.failedCheckCount" />
      </NGi>
      <NGi span="8">
        <NStatistic label="失败邮件" :value="auditSummary.failedMessageCount" />
      </NGi>
    </NGrid>

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
      <NEmpty v-if="!item.checklist.length" description="暂无发送条件" size="small" />
    </NSpace>

    <NAlert v-if="failedMessages.length" type="error" :bordered="false">
      <template #header>发送失败状态</template>
      <NSpace vertical :size="8">
        <div v-for="failedMessage in failedMessages" :key="failedMessage.id" class="failed-message-row">
          <div class="failed-message-title">第 {{ failedMessage.stepIndex }} 封 · {{ failedMessage.subject }}</div>
          <div class="failed-message-meta">
            Job {{ formatNullableText(failedMessage.bullJobId) }} · 更新时间
            {{ formatSequenceDate(failedMessage.updatedAt) }}
          </div>
        </div>
        <div class="failed-message-meta">失败邮件尚未成功发出，可修改内容后再发送，也可以直接重试。</div>
      </NSpace>
    </NAlert>

    <div class="retry-entry">
      <div>
        <div class="retry-title">失败处理</div>
        <div class="section-subtitle">{{ recoveryHint }}</div>
      </div>
    </div>

    <NAlert v-if="currentMessage" type="info" :bordered="false">
      当前选中第 {{ currentMessage.stepIndex }} 封：
      <NTag :type="currentMessageStatusView?.tagType" :bordered="false" size="small">
        {{ currentMessageStatusView?.label }}
      </NTag>
    </NAlert>
  </div>
</template>

<style scoped>
.send-audit-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-heading,
.retry-entry {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.section-title,
.retry-title {
  color: var(--n-text-color);
  font-size: 14px;
  font-weight: 600;
}

.section-subtitle,
.failed-message-meta {
  color: var(--n-text-color-3);
  font-size: 12px;
}

.check-label,
.failed-message-title {
  font-weight: 600;
}

.check-label {
  margin-right: 8px;
}

.failed-message-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
</style>
