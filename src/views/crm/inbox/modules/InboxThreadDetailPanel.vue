<script setup lang="ts">
import { computed } from 'vue';
import {
  buildInboxReplyDraftMetadataItems,
  findPendingUnsubscribeReviewMessage,
  formatInboxDate,
  formatInboxMessageBody,
  formatInboxMessageTime,
  formatInboxText,
  inboxMessageDirectionLabelMap,
  inboxMessageDirectionTagTypeMap,
  inboxMessageTypeLabelMap,
  inboxMessageTypeTagTypeMap,
  inboxThreadStatusLabelMap,
  inboxThreadStatusTagTypeMap,
  shouldShowInboxMessageTypeTag
} from './shared';

const props = defineProps<{
  canRestorePolish?: boolean;
  detail: Api.Crm.InboxThreadDetail | null;
  draftPolishing?: boolean;
  draftSaving?: boolean;
  loading?: boolean;
  replyBody: string;
  replySending?: boolean;
  replyTopic: string;
  unsubscribeConfirming?: boolean;
}>();

const emit = defineEmits<{
  back: [];
  confirmUnsubscribe: [messageId: string];
  reload: [];
  polishReplyDraft: [];
  restorePolish: [];
  saveReplyDraft: [];
  sendReply: [];
  'update:replyBody': [body: string];
  'update:replyTopic': [topic: string];
}>();

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
const isReplyDraftSyncedWithInputs = computed(
  () =>
    Boolean(replyDraft.value) &&
    props.replyTopic === replyDraft.value?.topic &&
    props.replyBody === replyDraft.value?.bodyText
);
const draftMetadataItems = computed(() =>
  isReplyDraftSyncedWithInputs.value ? buildInboxReplyDraftMetadataItems(replyDraft.value?.metadata) : []
);
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
const restorePolishDisabled = computed(() =>
  Boolean(!props.canRestorePolish || props.draftPolishing || props.draftSaving || props.replySending)
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
  Boolean(
    !canEditDraft.value || !props.replyTopic.trim() || !props.replyBody.trim() || props.loading || props.replySending
  )
);
type MessageTimelineType = 'default' | 'success' | 'error' | 'warning' | 'info';

const inboxMessageTimelineTypeMap: Record<Api.Crm.InboxMessageRecord['messageType'], MessageTimelineType> = {
  customer_reply: 'info',
  bounce: 'error',
  unsubscribe_hint: 'warning',
  unsubscribe_review_pending: 'warning'
};

/** Match the timeline dot to the email direction and current message risk. */
function getMessageTimelineType(message: Api.Crm.InboxMessageRecord): MessageTimelineType {
  if (message.direction === 'outbound') return 'success';

  return inboxMessageTimelineTypeMap[message.messageType];
}
</script>

<template>
  <NCard
    :bordered="false"
    class="card-wrapper inbox-reply-panel"
    size="small"
    :segmented="{ content: true }"
  >
    <template #header>
      <div class="panel-header">
        <div class="panel-heading">
          <NSpace align="center" :size="8">
            <span class="panel-title">处理客户回复</span>
            <NTag v-if="thread" :type="inboxThreadStatusTagTypeMap[thread.status]" :bordered="false" size="small">
              {{ inboxThreadStatusLabelMap[thread.status] }}
            </NTag>
            <NTag v-if="thread?.unreadCount" type="error" :bordered="false" size="small">
              未读 {{ thread.unreadCount }}
            </NTag>
          </NSpace>
          <div v-if="thread" class="panel-subtitle">
            {{ thread.subject }} · 最近回复 {{ formatInboxDate(thread.lastInboundAt) }} · 共
            {{ thread.messageCount }} 封
          </div>
        </div>
        <NSpace align="center" :size="8">
          <NButton size="tiny" secondary @click="emit('back')">返回列表</NButton>
          <NButton size="tiny" :loading="loading" @click="emit('reload')">刷新</NButton>
        </NSpace>
      </div>
    </template>

    <NSpin :show="loading">
      <div v-if="thread && account" class="panel-content">
        <NAlert
          v-if="pendingUnsubscribeMessage && detail?.canOperate"
          type="warning"
          :bordered="false"
          title="疑似拒绝/退订"
        >
          <NSpace justify="space-between" align="center" :wrap-item="false">
            <span>这封回复可能表达拒绝或退订，确认后会加入不再联系名单，并跳过后续待发邮件。</span>
            <NButton
              size="small"
              type="warning"
              :disabled="loading || unsubscribeConfirming"
              :loading="unsubscribeConfirming"
              @click="emit('confirmUnsubscribe', pendingUnsubscribeMessage.id)"
            >
              确认不再联系
            </NButton>
          </NSpace>
        </NAlert>

        <div class="reply-workspace">
          <div class="mail-thread-pane">
            <div class="drawer-section">
              <div class="section-title">邮件正文</div>
              <NTimeline v-if="messages.length" class="message-list" size="medium">
                <NTimelineItem
                  v-for="item in messages"
                  :key="item.id"
                  :type="getMessageTimelineType(item)"
                  :line-type="item.direction === 'outbound' ? 'dashed' : 'default'"
                >
                  <template #header>
                    <div class="message-header">
                      <NSpace align="center" :size="8">
                        <NTag :type="inboxMessageDirectionTagTypeMap[item.direction]" :bordered="false" size="small">
                          {{ inboxMessageDirectionLabelMap[item.direction] }}
                        </NTag>
                        <NTag
                          v-if="shouldShowInboxMessageTypeTag(item)"
                          :type="inboxMessageTypeTagTypeMap[item.messageType]"
                          :bordered="false"
                          size="small"
                        >
                          {{ inboxMessageTypeLabelMap[item.messageType] }}
                        </NTag>
                        <span class="message-time">{{ formatInboxMessageTime(item) }}</span>
                      </NSpace>
                    </div>
                  </template>

                  <div class="message-item" :class="`message-item--${item.direction}`">
                    <div class="message-subject">{{ item.subject }}</div>
                    <div class="message-body">
                      {{ formatInboxMessageBody(item.bodyText) }}
                    </div>
                  </div>
                </NTimelineItem>
              </NTimeline>
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
                <NDescriptionsItem label="跟进任务">{{ formatInboxText(enrollment?.name) }}</NDescriptionsItem>
                <NDescriptionsItem label="更新时间">{{ formatInboxDate(thread.updatedAt) }}</NDescriptionsItem>
              </NDescriptions>
            </div>

            <div class="drawer-section reply-draft-section">
              <div class="section-title-row">
                <div>
                  <div class="section-title">回复草稿</div>
                  <div class="section-subtitle">填写要点后可直接让 AI 润色成正式回复。</div>
                </div>
                <NSpace v-if="canEditDraft" align="center" :size="8">
                  <NButton
                    v-if="canRestorePolish"
                    size="small"
                    secondary
                    :disabled="restorePolishDisabled"
                    @click="emit('restorePolish')"
                  >
                    撤回润色
                  </NButton>
                  <NPopconfirm
                    v-if="hasReplyBody"
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
                    v-else
                    size="small"
                    :disabled="polishDisabled"
                    :loading="draftPolishing"
                    @click="emit('polishReplyDraft')"
                  >
                    AI 润色回复
                  </NButton>
                </NSpace>
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

                <NDescriptions
                  v-if="draftMetadataItems.length"
                  :column="1"
                  label-placement="left"
                  bordered
                  size="small"
                >
                  <NDescriptionsItem v-for="item in draftMetadataItems" :key="item.key" :label="item.label">
                    {{ item.value }}
                  </NDescriptionsItem>
                </NDescriptions>

                <NText v-if="replyDraft && isReplyDraftSyncedWithInputs" depth="3" class="draft-updated-text">
                  草稿更新时间 {{ formatInboxDate(replyDraft.updatedAt) }}
                  <template v-if="replyDraft.updatedByName">· {{ replyDraft.updatedByName }}</template>
                </NText>

                <div class="reply-action-row">
                  <NText v-if="detail && !detail.canOperate" depth="3">当前账号不可操作该回复</NText>
                  <span v-else />

                  <NSpace justify="end">
                    <NButton @click="emit('back')">返回列表</NButton>
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
                  </NSpace>
                </div>
              </NSpace>
            </div>
          </div>
        </div>
      </div>
      <NEmpty v-else description="请选择回复线程" />
    </NSpin>
  </NCard>
</template>

<style scoped>
.inbox-reply-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  width: 100%;
}

.inbox-reply-panel :deep(.n-card__content) {
  flex: 1 1 0;
  display: flex;
  flex-direction: column;
  height: 0;
  min-height: 0;
  overflow: hidden;
}

.inbox-reply-panel :deep(.n-spin-container),
.inbox-reply-panel :deep(.n-spin-content) {
  flex: 1 1 0;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.panel-header,
.reply-action-row,
.section-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
}

.reply-action-row {
  position: sticky;
  bottom: 0;
  z-index: 1;
  padding-top: 8px;
  background: rgb(var(--layout-bg-color));
}

.panel-heading,
.panel-content,
.drawer-section,
.message-header,
.reply-draft-section {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.panel-heading {
  gap: 6px;
}

.panel-content,
.drawer-section,
.reply-draft-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.panel-content {
  flex: 1 1 0;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.panel-title {
  color: var(--n-text-color);
  font-size: 18px;
  font-weight: 600;
  line-height: 1.35;
}

.panel-subtitle {
  color: var(--n-text-color-3);
  font-size: 12px;
  overflow-wrap: anywhere;
}

.reply-workspace {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(340px, 0.95fr);
  gap: 18px;
  flex: 1 1 0;
  height: auto;
  min-height: 0;
  overflow: hidden;
}

.mail-thread-pane,
.reply-draft-pane {
  min-height: 0;
  min-width: 0;
  overflow: auto;
  padding-right: 2px;
}

.mail-thread-pane {
  display: flex;
}

.mail-thread-pane > .drawer-section {
  flex: 1;
}

.message-list {
  box-sizing: border-box;
  flex: 1;
  max-width: 100%;
  min-width: 0;
  min-height: 0;
  overflow: auto;
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
  background-color: rgb(var(--layout-bg-color));
  padding: 14px 14px 2px;
}

.message-list :deep(.n-timeline-item-content__title) {
  min-width: 0;
  margin-bottom: 6px;
}

.message-list :deep(.n-timeline-item) {
  min-width: 0;
}

.message-list :deep(.n-timeline-item-content) {
  min-width: 0;
  width: auto;
}

.message-list :deep(.n-timeline-item-content__content) {
  min-width: 0;
  width: auto;
}

.message-header,
.message-item {
  width: 100%;
}

.message-item {
  box-sizing: border-box;
  position: relative;
  overflow: hidden;
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
  background: linear-gradient(90deg, rgb(var(--primary-color) / 0.055), rgb(var(--container-bg-color)) 46%);
  padding: 12px 14px;
}

.message-item--outbound {
  border-color: rgb(var(--success-color) / 0.2);
  background: linear-gradient(90deg, rgb(var(--success-color) / 0.08), rgb(var(--container-bg-color)) 46%);
}

.section-subtitle,
.message-time,
.draft-updated-text {
  color: rgb(var(--base-text-color) / 0.52);
  font-size: 12px;
}

.section-title {
  color: rgb(var(--base-text-color));
  font-size: 14px;
  font-weight: 600;
}

.message-subject {
  color: rgb(var(--base-text-color));
  font-weight: 600;
}

.message-body {
  color: rgb(var(--base-text-color) / 0.82);
  line-height: 1.7;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  word-break: break-word;
}

@media (max-width: 960px) {
  .reply-workspace {
    height: auto;
    grid-template-columns: 1fr;
    max-height: none;
    overflow: auto;
  }
}
</style>
