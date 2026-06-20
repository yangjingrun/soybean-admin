<script setup lang="ts">
import { computed } from 'vue';
import {
  buildInboxReplyDraftMetadataItems,
  findPendingUnsubscribeReviewMessage,
  formatInboxDate,
  formatInboxMessageTime,
  formatInboxText,
  inboxMessageDirectionLabelMap,
  inboxMessageDirectionTagTypeMap,
  inboxMessageTypeLabelMap,
  inboxMessageTypeTagTypeMap,
  inboxThreadStatusLabelMap,
  inboxThreadStatusTagTypeMap
} from './shared';

const props = defineProps<{
  detail: Api.Crm.InboxThreadDetail | null;
  draftPolishing?: boolean;
  draftSaving?: boolean;
  loading?: boolean;
  replyBody: string;
  replyTopic: string;
  show: boolean;
  statusOperating?: Api.Crm.InboxThreadStatus | null;
  statusSubmitting?: boolean;
  unsubscribeConfirming?: boolean;
}>();

const emit = defineEmits<{
  confirmUnsubscribe: [messageId: string];
  reload: [];
  polishReplyDraft: [];
  saveReplyDraft: [];
  submitStatus: [status: Api.Crm.InboxThreadStatus];
  'update:replyBody': [body: string];
  'update:replyTopic': [topic: string];
  'update:show': [show: boolean];
}>();

const drawerVisible = computed({
  get: () => props.show,
  set: value => emit('update:show', value)
});
const thread = computed(() => props.detail?.thread ?? null);
const account = computed(() => props.detail?.account ?? null);
const contact = computed(() => props.detail?.contact ?? null);
const mailbox = computed(() => props.detail?.mailbox ?? null);
const enrollment = computed(() => props.detail?.enrollment ?? null);
const messages = computed(() => props.detail?.messages ?? []);
const replyDraft = computed(() => props.detail?.replyDraft ?? null);
const canReadBody = computed(() => Boolean(thread.value?.canReadBody));
const canEditDraft = computed(() => Boolean(props.detail?.canOperate));
const hasReplyBody = computed(() => Boolean(props.replyBody.trim()));
const draftMetadataItems = computed(() => buildInboxReplyDraftMetadataItems(replyDraft.value?.metadata));
const pendingUnsubscribeMessage = computed(() => findPendingUnsubscribeReviewMessage(messages.value));
const replyTopicModel = computed({
  get: () => props.replyTopic,
  set: value => emit('update:replyTopic', value)
});
const replyBodyModel = computed({
  get: () => props.replyBody,
  set: value => emit('update:replyBody', value)
});
const polishDisabled = computed(() =>
  Boolean(!canEditDraft.value || !props.replyTopic.trim() || props.draftPolishing || props.draftSaving)
);
const saveDisabled = computed(() =>
  Boolean(
    !canEditDraft.value ||
    !props.replyTopic.trim() ||
    !props.replyBody.trim() ||
    props.draftPolishing ||
    props.draftSaving
  )
);
const statusActions = [
  { label: '标记待处理', value: 'pending' },
  { label: '标记已处理', value: 'handled' },
  { label: '归档', value: 'archived' }
] satisfies Array<{ label: string; value: Api.Crm.InboxThreadStatus }>;

/** Check whether a status action should be unavailable for the current detail. */
function isStatusDisabled(status: Api.Crm.InboxThreadStatus) {
  return Boolean(
    props.loading || props.statusSubmitting || !props.detail?.canOperate || thread.value?.status === status
  );
}
</script>

<template>
  <NDrawer v-model:show="drawerVisible" :width="760" placement="right">
    <NDrawerContent title="回复详情" closable>
      <NSpin :show="loading">
        <NSpace v-if="thread && account" vertical :size="16">
          <div class="drawer-toolbar">
            <NButton size="tiny" :loading="loading" @click="emit('reload')">刷新</NButton>
          </div>

          <div class="inbox-summary">
            <NSpace align="center" :size="8">
              <NTag :type="inboxThreadStatusTagTypeMap[thread.status]" :bordered="false" size="small">
                {{ inboxThreadStatusLabelMap[thread.status] }}
              </NTag>
              <NTag v-if="thread.unreadCount" type="error" :bordered="false" size="small">
                未读 {{ thread.unreadCount }}
              </NTag>
            </NSpace>
            <div class="inbox-summary-title">{{ thread.subject }}</div>
            <div class="inbox-summary-subtitle">
              最近回复 {{ formatInboxDate(thread.lastInboundAt) }} · 共 {{ thread.messageCount }} 封
            </div>
          </div>

          <div class="drawer-section">
            <div class="section-title">关联记录</div>
            <NDescriptions :column="1" label-placement="left" bordered size="small">
              <NDescriptionsItem label="线索">{{ account.name }}</NDescriptionsItem>
              <NDescriptionsItem label="联系人">
                {{ formatInboxText(contact?.fullName || contact?.maskedEmail) }}
              </NDescriptionsItem>
              <NDescriptionsItem label="联系人邮箱">
                {{ formatInboxText(contact?.maskedEmail) }}
              </NDescriptionsItem>
              <NDescriptionsItem label="邮箱">{{ formatInboxText(mailbox?.maskedEmail) }}</NDescriptionsItem>
              <NDescriptionsItem label="序列">{{ formatInboxText(enrollment?.name) }}</NDescriptionsItem>
              <NDescriptionsItem label="创建时间">{{ formatInboxDate(thread.createdAt) }}</NDescriptionsItem>
              <NDescriptionsItem label="更新时间">{{ formatInboxDate(thread.updatedAt) }}</NDescriptionsItem>
            </NDescriptions>
          </div>

          <NAlert
            v-if="pendingUnsubscribeMessage && detail?.canOperate"
            type="warning"
            :bordered="false"
            title="疑似退订"
          >
            <NSpace justify="space-between" align="center" :wrap-item="false">
              <span>这封回复可能表达退订或拒绝，确认后会拉黑该联系人并跳过后续待发邮件。</span>
              <NButton
                size="small"
                type="warning"
                :disabled="loading || unsubscribeConfirming"
                :loading="unsubscribeConfirming"
                @click="emit('confirmUnsubscribe', pendingUnsubscribeMessage.id)"
              >
                确认退订并拉黑
              </NButton>
            </NSpace>
          </NAlert>

          <div class="drawer-section">
            <div class="section-title">邮件正文</div>
            <NSpace v-if="messages.length" vertical :size="10">
              <NCard v-for="item in messages" :key="item.id" size="small" embedded>
                <NSpace vertical :size="8">
                  <div class="message-header">
                    <NSpace align="center" :size="8">
                      <NTag :type="inboxMessageDirectionTagTypeMap[item.direction]" :bordered="false" size="small">
                        {{ inboxMessageDirectionLabelMap[item.direction] }}
                      </NTag>
                      <NTag
                        v-if="item.direction === 'inbound'"
                        :type="inboxMessageTypeTagTypeMap[item.messageType]"
                        :bordered="false"
                        size="small"
                      >
                        {{ inboxMessageTypeLabelMap[item.messageType] }}
                      </NTag>
                      <span class="message-time">{{ formatInboxMessageTime(item) }}</span>
                    </NSpace>
                    <div class="message-subject">{{ item.subject }}</div>
                  </div>
                  <div class="message-body">{{ item.bodyText }}</div>
                </NSpace>
              </NCard>
            </NSpace>
            <NEmpty v-else :description="canReadBody ? '暂无邮件正文' : '当前账号不可查看邮件正文'" />
          </div>

          <div class="drawer-section">
            <div class="section-title">回复草稿</div>
            <NSpace vertical :size="10">
              <NInput
                v-model:value="replyTopicModel"
                type="textarea"
                :autosize="{ minRows: 2, maxRows: 5 }"
                :maxlength="2000"
                show-count
                :disabled="!canEditDraft || draftPolishing || draftSaving"
                placeholder="填写回复主题、要点或希望表达的信息，AI 会润色成回复草稿"
              />
              <NInput
                v-model:value="replyBodyModel"
                type="textarea"
                :autosize="{ minRows: 5, maxRows: 10 }"
                :maxlength="10000"
                show-count
                :disabled="!canEditDraft || draftPolishing || draftSaving"
                placeholder="AI 润色后的回复草稿会显示在这里，也可以人工修改后保存"
              />

              <NDescriptions v-if="draftMetadataItems.length" :column="1" label-placement="left" bordered size="small">
                <NDescriptionsItem v-for="item in draftMetadataItems" :key="item.key" :label="item.label">
                  {{ item.value }}
                </NDescriptionsItem>
              </NDescriptions>

              <NText v-if="replyDraft" depth="3" class="draft-updated-text">
                草稿更新时间 {{ formatInboxDate(replyDraft.updatedAt) }}
                <template v-if="replyDraft.updatedByName">· {{ replyDraft.updatedByName }}</template>
              </NText>
            </NSpace>
          </div>
        </NSpace>
        <NEmpty v-else description="请选择回复线程" />
      </NSpin>

      <template #footer>
        <NSpace justify="space-between" align="center">
          <NText v-if="detail && !detail.canOperate" depth="3">当前账号不可操作该回复</NText>
          <span v-else />

          <NSpace justify="end">
            <NButton @click="drawerVisible = false">关闭</NButton>
            <NPopconfirm
              v-if="canEditDraft && hasReplyBody"
              :disabled="polishDisabled"
              positive-text="确认润色"
              negative-text="取消"
              @positive-click="emit('polishReplyDraft')"
            >
              <template #trigger>
                <NButton type="primary" :disabled="polishDisabled" :loading="draftPolishing">AI 润色回复</NButton>
              </template>
              当前正文草稿会被 AI 润色结果覆盖，是否继续？
            </NPopconfirm>
            <NButton
              v-else-if="canEditDraft"
              type="primary"
              :disabled="polishDisabled"
              :loading="draftPolishing"
              @click="emit('polishReplyDraft')"
            >
              AI 润色回复
            </NButton>
            <NButton
              v-if="canEditDraft"
              type="primary"
              secondary
              :disabled="saveDisabled"
              :loading="draftSaving"
              @click="emit('saveReplyDraft')"
            >
              保存草稿
            </NButton>
            <NButton
              v-for="item in statusActions"
              :key="item.value"
              :type="item.value === 'handled' ? 'primary' : item.value === 'archived' ? 'warning' : 'default'"
              :disabled="isStatusDisabled(item.value)"
              :loading="statusSubmitting && statusOperating === item.value"
              @click="emit('submitStatus', item.value)"
            >
              {{ item.label }}
            </NButton>
          </NSpace>
        </NSpace>
      </template>
    </NDrawerContent>
  </NDrawer>
</template>

<style scoped>
.drawer-toolbar {
  display: flex;
  justify-content: flex-end;
}

.inbox-summary,
.drawer-section,
.message-header {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.inbox-summary {
  border-bottom: 1px solid var(--n-divider-color);
  padding-bottom: 14px;
}

.inbox-summary-title {
  color: var(--n-text-color);
  font-size: 18px;
  font-weight: 600;
  line-height: 1.35;
}

.inbox-summary-subtitle,
.message-time,
.draft-updated-text {
  color: var(--n-text-color-3);
  font-size: 12px;
}

.section-title {
  color: var(--n-text-color);
  font-size: 14px;
  font-weight: 600;
}

.message-subject {
  color: var(--n-text-color);
  font-weight: 600;
}

.message-body {
  color: var(--n-text-color);
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
