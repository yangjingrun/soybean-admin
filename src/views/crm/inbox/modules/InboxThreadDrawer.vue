<script setup lang="ts">
import { computed } from 'vue';
import {
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
  loading?: boolean;
  replyBody: string;
  replySubmitting?: boolean;
  show: boolean;
  statusOperating?: Api.Crm.InboxThreadStatus | null;
  statusSubmitting?: boolean;
}>();

const emit = defineEmits<{
  reload: [];
  submitReply: [];
  submitStatus: [status: Api.Crm.InboxThreadStatus];
  'update:replyBody': [body: string];
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
const canReadBody = computed(() => Boolean(thread.value?.canReadBody));
const replyBodyModel = computed({
  get: () => props.replyBody,
  set: value => emit('update:replyBody', value)
});
const canReply = computed(() => Boolean(props.detail?.canOperate && mailbox.value?.status === 'active'));
const statusActions = [
  { label: '标记待处理', value: 'pending' },
  { label: '标记已处理', value: 'handled' },
  { label: '归档', value: 'archived' }
] satisfies Array<{ label: string; value: Api.Crm.InboxThreadStatus }>;

/** Check whether a status action should be unavailable for the current detail. */
function isStatusDisabled(status: Api.Crm.InboxThreadStatus) {
  return Boolean(props.loading || props.statusSubmitting || !props.detail?.canOperate || thread.value?.status === status);
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

          <div class="drawer-section">
            <div class="section-title">邮件正文</div>
            <NSpace v-if="messages.length" vertical :size="10">
              <NCard v-for="item in messages" :key="item.id" size="small" embedded>
                <NSpace vertical :size="8">
                  <div class="message-header">
                    <NSpace align="center" :size="8">
                      <NTag
                        :type="inboxMessageDirectionTagTypeMap[item.direction]"
                        :bordered="false"
                        size="small"
                      >
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

          <div v-if="detail?.canOperate" class="drawer-section">
            <div class="section-title">系统内回复</div>
            <NInput
              v-model:value="replyBodyModel"
              type="textarea"
              :autosize="{ minRows: 4, maxRows: 8 }"
              :maxlength="10000"
              show-count
              :disabled="!canReply || replySubmitting"
              placeholder="输入纯文本回复"
            />
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
            <NButton
              type="primary"
              :disabled="!canReply || !replyBody.trim()"
              :loading="replySubmitting"
              @click="emit('submitReply')"
            >
              发送回复
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
.message-time {
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
