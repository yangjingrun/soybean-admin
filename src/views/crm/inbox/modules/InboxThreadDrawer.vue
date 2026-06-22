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
  replySending?: boolean;
  replyTopic: string;
  show: boolean;
  statusSubmitting?: boolean;
  unsubscribeConfirming?: boolean;
}>();

const emit = defineEmits<{
  confirmUnsubscribe: [messageId: string];
  reload: [];
  polishReplyDraft: [];
  saveReplyDraft: [];
  sendReply: [];
  submitStatus: [status: Api.Crm.InboxThreadStatus];
  'update:replyBody': [body: string];
  'update:replyTopic': [topic: string];
  'update:show': [show: boolean];
}>();

const modalVisible = computed({
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
  Boolean(
    !canEditDraft.value || !props.replyTopic.trim() || props.draftPolishing || props.draftSaving || props.replySending
  )
);
const saveDisabled = computed(() =>
  Boolean(
    !canEditDraft.value ||
    !props.replyTopic.trim() ||
    !props.replyBody.trim() ||
    props.draftPolishing ||
    props.draftSaving ||
    props.replySending
  )
);
const sendDisabled = computed(() =>
  Boolean(!canEditDraft.value || !props.replyTopic.trim() || !props.replyBody.trim() || props.loading || props.replySending)
);
const statusActions = [
  { label: '标记待处理', value: 'pending' },
  { label: '标记已处理', value: 'handled' },
  { label: '归档', value: 'archived' }
] satisfies Array<{ label: string; value: Api.Crm.InboxThreadStatus }>;
const statusDropdownOptions = computed(() =>
  statusActions.map(item => ({
    key: item.value,
    label: item.label,
    disabled: isStatusDisabled(item.value)
  }))
);

/** Check whether a status action should be unavailable for the current detail. */
function isStatusDisabled(status: Api.Crm.InboxThreadStatus) {
  return Boolean(
    props.loading || props.statusSubmitting || !props.detail?.canOperate || thread.value?.status === status
  );
}

/** Submit status changes from the compact footer dropdown. */
function handleStatusSelect(key: string | number) {
  if (typeof key !== 'string' || !['pending', 'handled', 'archived'].includes(key)) {
    return;
  }

  emit('submitStatus', key as Api.Crm.InboxThreadStatus);
}
</script>

<template>
  <NModal
    v-model:show="modalVisible"
    preset="card"
    class="inbox-reply-modal"
    :bordered="false"
    :segmented="{ content: true, footer: true }"
  >
    <template #header>
      <div class="modal-header">
        <div class="modal-heading">
          <NSpace align="center" :size="8">
            <span class="modal-title">处理客户回复</span>
            <NTag
              v-if="thread"
              :type="inboxThreadStatusTagTypeMap[thread.status]"
              :bordered="false"
              size="small"
            >
              {{ inboxThreadStatusLabelMap[thread.status] }}
            </NTag>
            <NTag v-if="thread?.unreadCount" type="error" :bordered="false" size="small">
              未读 {{ thread.unreadCount }}
            </NTag>
          </NSpace>
          <div v-if="thread" class="modal-subtitle">
            {{ thread.subject }} · 最近回复 {{ formatInboxDate(thread.lastInboundAt) }} · 共 {{ thread.messageCount }} 封
          </div>
        </div>
        <NSpace align="center" :size="8">
          <NButton size="tiny" :loading="loading" @click="emit('reload')">刷新</NButton>
          <NButton size="tiny" quaternary @click="modalVisible = false">关闭</NButton>
        </NSpace>
      </div>
    </template>

    <NSpin :show="loading">
      <NSpace v-if="thread && account" vertical :size="14" class="modal-content">
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

        <div class="reply-workspace">
          <div class="mail-thread-pane">
            <div class="drawer-section">
              <div class="section-title">邮件正文</div>
              <NSpace v-if="messages.length" vertical :size="0" class="message-list">
                <div v-for="item in messages" :key="item.id" class="message-item">
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
                </div>
              </NSpace>
              <NEmpty v-else :description="canReadBody ? '暂无邮件正文' : '当前账号不可查看邮件正文'" />
            </div>
          </div>

          <div class="reply-draft-pane">
            <div class="drawer-section">
              <div class="section-title">关联记录</div>
              <NDescriptions :column="1" label-placement="left" bordered size="small">
                <NDescriptionsItem label="客户">{{ account.name }}</NDescriptionsItem>
                <NDescriptionsItem label="联系人">
                  {{ formatInboxText(contact?.fullName || contact?.maskedEmail) }}
                </NDescriptionsItem>
                <NDescriptionsItem label="联系人邮箱">
                  {{ formatInboxText(contact?.maskedEmail) }}
                </NDescriptionsItem>
                <NDescriptionsItem label="邮箱">{{ formatInboxText(mailbox?.maskedEmail) }}</NDescriptionsItem>
                <NDescriptionsItem label="序列">{{ formatInboxText(enrollment?.name) }}</NDescriptionsItem>
                <NDescriptionsItem label="更新时间">{{ formatInboxDate(thread.updatedAt) }}</NDescriptionsItem>
              </NDescriptions>
            </div>

            <div class="drawer-section reply-draft-section">
              <div class="section-title-row">
                <div>
                  <div class="section-title">回复草稿</div>
                  <div class="section-subtitle">填写要点后可直接让 AI 润色成正式回复。</div>
                </div>
                <NPopconfirm
                  v-if="canEditDraft && hasReplyBody"
                  :disabled="polishDisabled"
                  positive-text="确认润色"
                  negative-text="取消"
                  @positive-click="emit('polishReplyDraft')"
                >
                  <template #trigger>
                    <NButton size="small" :disabled="polishDisabled" :loading="draftPolishing">AI 润色回复</NButton>
                  </template>
                  当前正文草稿会被 AI 润色结果覆盖，是否继续？
                </NPopconfirm>
                <NButton
                  v-else-if="canEditDraft"
                  size="small"
                  :disabled="polishDisabled"
                  :loading="draftPolishing"
                  @click="emit('polishReplyDraft')"
                >
                  AI 润色回复
                </NButton>
              </div>

              <NSpace vertical :size="10">
                <NInput
                  v-model:value="replyTopicModel"
                  type="textarea"
                  :autosize="{ minRows: 2, maxRows: 5 }"
                  :maxlength="2000"
                  show-count
                  :disabled="!canEditDraft || draftPolishing || draftSaving || replySending"
                  placeholder="填写回复主题、要点或希望表达的信息"
                />
                <NInput
                  v-model:value="replyBodyModel"
                  type="textarea"
                  :autosize="{ minRows: 8, maxRows: 14 }"
                  :maxlength="10000"
                  show-count
                  :disabled="!canEditDraft || draftPolishing || draftSaving || replySending"
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
          </div>
        </div>
      </NSpace>
      <NEmpty v-else description="请选择回复线程" />
    </NSpin>

    <template #footer>
      <NSpace justify="space-between" align="center" class="modal-footer">
        <NText v-if="detail && !detail.canOperate" depth="3">当前账号不可操作该回复</NText>
        <span v-else />

        <NSpace justify="end">
          <NButton @click="modalVisible = false">关闭</NButton>
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
            v-if="canEditDraft"
            type="primary"
            :disabled="sendDisabled"
            :loading="replySending"
            @click="emit('sendReply')"
          >
            发送回复
          </NButton>
          <NDropdown :options="statusDropdownOptions" trigger="click" @select="handleStatusSelect">
            <NButton :disabled="loading || statusSubmitting || !detail?.canOperate" :loading="statusSubmitting">
              状态操作
            </NButton>
          </NDropdown>
        </NSpace>
      </NSpace>
    </template>
  </NModal>
</template>

<style scoped>
.inbox-reply-modal {
  width: min(1180px, 92vw);
}

.modal-header,
.modal-footer,
.section-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.modal-heading,
.modal-content,
.drawer-section,
.message-header,
.reply-draft-section {
  display: flex;
  flex-direction: column;
}

.modal-heading {
  gap: 6px;
}

.modal-content,
.drawer-section,
.reply-draft-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.modal-title {
  color: var(--n-text-color);
  font-size: 18px;
  font-weight: 600;
  line-height: 1.35;
}

.modal-subtitle {
  color: var(--n-text-color-3);
  font-size: 12px;
}

.reply-workspace {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(360px, 0.95fr);
  gap: 18px;
  max-height: calc(86vh - 170px);
  min-height: 520px;
}

.mail-thread-pane,
.reply-draft-pane {
  min-height: 0;
  overflow: auto;
  padding-right: 2px;
}

.message-list {
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
  overflow: hidden;
}

.message-item {
  padding: 14px 16px;
}

.message-item + .message-item {
  border-top: 1px solid var(--n-divider-color);
}

.section-subtitle,
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

@media (max-width: 960px) {
  .reply-workspace {
    grid-template-columns: 1fr;
    max-height: calc(88vh - 170px);
  }
}
</style>
