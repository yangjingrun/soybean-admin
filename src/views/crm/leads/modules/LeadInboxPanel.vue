<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue';
import { fetchCrmInboxThreadDetail, fetchCrmInboxThreads } from '@/service/api';
import {
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
} from '../../inbox/modules/shared';

const props = defineProps<{
  accountId: string;
  active?: boolean;
  contactId?: string | null;
}>();

const records = shallowRef<Api.Crm.InboxThreadRecord[]>([]);
const selectedThreadId = shallowRef<string | null>(null);
const detail = shallowRef<Api.Crm.InboxThreadDetail | null>(null);
const loading = shallowRef(false);
const detailLoading = shallowRef(false);
let latestListRequestId = 0;
let latestDetailRequestId = 0;

type MessageTimelineType = 'default' | 'success' | 'error' | 'warning' | 'info';

const inboxMessageTimelineTypeMap: Record<Api.Crm.InboxMessageRecord['messageType'], MessageTimelineType> = {
  customer_reply: 'info',
  bounce: 'error',
  unsubscribe_hint: 'warning',
  unsubscribe_review_pending: 'warning'
};

const selectedThread = computed(() => records.value.find(record => record.id === selectedThreadId.value) ?? null);
const messages = computed(() => detail.value?.messages ?? []);
const canReadBody = computed(() => Boolean(detail.value?.thread.canReadBody));

watch(
  [() => props.active, () => props.accountId, () => props.contactId],
  () => {
    if (!props.active) return;

    void loadInboxThreads();
  },
  { immediate: true }
);

/** Load inbox threads bound to the current account and optional selected contact. */
async function loadInboxThreads() {
  const requestId = latestListRequestId + 1;
  latestListRequestId = requestId;
  latestDetailRequestId += 1;
  detail.value = null;
  loading.value = true;
  detailLoading.value = false;

  try {
    const { data, error } = await fetchCrmInboxThreads({
      current: 1,
      size: 20,
      accountId: props.accountId,
      ...(props.contactId ? { contactId: props.contactId } : {})
    });

    if (error || requestId !== latestListRequestId) {
      return;
    }

    records.value = data.records;
    const nextThread = data.records.find(record => record.id === selectedThreadId.value) ?? data.records[0] ?? null;
    selectedThreadId.value = nextThread?.id ?? null;

    if (nextThread) {
      void loadThreadDetail(nextThread.id);
      return;
    }

    detail.value = null;
  } finally {
    if (requestId === latestListRequestId) {
      loading.value = false;
    }
  }
}

/** Load one inbox thread detail and ignore stale tab/contact switches. */
async function loadThreadDetail(threadId = selectedThreadId.value) {
  if (!threadId) {
    detail.value = null;
    return;
  }

  const requestId = latestDetailRequestId + 1;
  latestDetailRequestId = requestId;
  detailLoading.value = true;

  try {
    const { data, error } = await fetchCrmInboxThreadDetail(threadId);

    if (error || requestId !== latestDetailRequestId || selectedThreadId.value !== threadId) {
      return;
    }

    detail.value = data;
  } finally {
    if (requestId === latestDetailRequestId) {
      detailLoading.value = false;
    }
  }
}

function handleSelectThread(threadId: string) {
  selectedThreadId.value = threadId;
  void loadThreadDetail(threadId);
}

/** Match the timeline dot to the email direction and current message risk. */
function getMessageTimelineType(message: Api.Crm.InboxMessageRecord): MessageTimelineType {
  if (message.direction === 'outbound') return 'success';

  return inboxMessageTimelineTypeMap[message.messageType];
}
</script>

<template>
  <div class="lead-inbox-panel">
    <div class="drawer-section inbox-thread-list-section">
      <div class="section-title-row">
        <div class="section-title">邮件线程</div>
        <NButton size="tiny" :loading="loading" @click="loadInboxThreads">刷新</NButton>
      </div>

      <NSpin :show="loading">
        <div v-if="records.length" class="inbox-thread-list">
          <button
            v-for="thread in records"
            :key="thread.id"
            class="inbox-thread-item"
            :class="{ 'inbox-thread-item--active': selectedThreadId === thread.id }"
            type="button"
            @click="handleSelectThread(thread.id)"
          >
            <span class="inbox-thread-title">{{ thread.subject }}</span>
            <span class="inbox-thread-snippet">{{ formatInboxText(thread.lastMessageSnippet) }}</span>
            <span class="inbox-thread-meta">
              <NTag :type="inboxThreadStatusTagTypeMap[thread.status]" :bordered="false" size="small">
                {{ inboxThreadStatusLabelMap[thread.status] }}
              </NTag>
              <span>{{ formatInboxDate(thread.lastInboundAt) }}</span>
              <span>共 {{ thread.messageCount }} 封</span>
            </span>
          </button>
        </div>
        <NEmpty v-else description="暂无邮件往来" />
      </NSpin>
    </div>

    <div class="drawer-section inbox-message-section">
      <div class="section-title-row">
        <div>
          <div class="section-title">邮件正文</div>
          <div v-if="selectedThread" class="section-subtitle">
            {{ selectedThread.subject }} · 最近回复 {{ formatInboxDate(selectedThread.lastInboundAt) }}
          </div>
        </div>
        <NTag
          v-if="selectedThread"
          :type="inboxThreadStatusTagTypeMap[selectedThread.status]"
          :bordered="false"
          size="small"
        >
          {{ inboxThreadStatusLabelMap[selectedThread.status] }}
        </NTag>
      </div>

      <NSpin :show="detailLoading">
        <NTimeline v-if="messages.length" class="inbox-message-list" size="medium">
          <NTimelineItem
            v-for="item in messages"
            :key="item.id"
            :type="getMessageTimelineType(item)"
            :line-type="item.direction === 'outbound' ? 'dashed' : 'default'"
          >
            <template #header>
              <div class="inbox-message-header">
                <NSpace align="center" :size="8" wrap>
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
                  <span class="inbox-message-time">{{ formatInboxMessageTime(item) }}</span>
                </NSpace>
              </div>
            </template>

            <div class="inbox-message-item" :class="`inbox-message-item--${item.direction}`">
              <div class="inbox-message-subject">{{ item.subject }}</div>
              <div class="inbox-message-body">{{ formatInboxMessageBody(item.bodyText) }}</div>
            </div>
          </NTimelineItem>
        </NTimeline>
        <NEmpty v-else :description="canReadBody ? '暂无邮件正文' : '当前账号不可查看邮件正文'" />
      </NSpin>
    </div>
  </div>
</template>

<style scoped>
.lead-inbox-panel {
  display: grid;
  min-height: 360px;
  gap: 14px;
  grid-template-columns: minmax(260px, 0.42fr) minmax(0, 1fr);
}

.drawer-section,
.inbox-thread-list,
.inbox-thread-item,
.inbox-message-header {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.drawer-section {
  gap: 8px;
}

.section-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
}

.section-title {
  color: rgb(var(--base-text-color));
  font-size: 14px;
  font-weight: 600;
}

.section-subtitle,
.inbox-thread-snippet,
.inbox-thread-meta,
.inbox-message-time {
  color: var(--n-text-color-3);
  font-size: 12px;
}

.inbox-thread-list {
  max-height: 520px;
  gap: 8px;
  overflow: auto;
  padding-right: 2px;
}

.inbox-thread-item {
  width: 100%;
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
  background: var(--n-color);
  cursor: pointer;
  gap: 6px;
  padding: 10px 12px;
  text-align: left;
}

.inbox-thread-item--active {
  border-color: rgb(var(--primary-color));
  background: rgb(var(--primary-color) / 0.07);
}

.inbox-thread-title {
  overflow: hidden;
  color: var(--n-text-color);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.inbox-thread-snippet {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.inbox-thread-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.inbox-message-list {
  box-sizing: border-box;
  max-height: 520px;
  overflow: auto;
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
  background-color: rgb(var(--layout-bg-color));
  padding: 14px 14px 2px;
}

.inbox-message-list :deep(.n-timeline-item-content__title) {
  min-width: 0;
  margin-bottom: 6px;
}

.inbox-message-list :deep(.n-timeline-item-content),
.inbox-message-list :deep(.n-timeline-item-content__content) {
  min-width: 0;
}

.inbox-message-item {
  box-sizing: border-box;
  overflow: hidden;
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
  background: linear-gradient(90deg, rgb(var(--primary-color) / 0.055), rgb(var(--container-bg-color)) 46%);
  padding: 12px 14px;
}

.inbox-message-item--outbound {
  border-color: rgb(var(--success-color) / 0.2);
  background: linear-gradient(90deg, rgb(var(--success-color) / 0.08), rgb(var(--container-bg-color)) 46%);
}

.inbox-message-subject {
  color: rgb(var(--base-text-color));
  font-weight: 600;
}

.inbox-message-body {
  color: rgb(var(--base-text-color) / 0.82);
  line-height: 1.7;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  word-break: break-word;
}

@media (max-width: 960px) {
  .lead-inbox-panel {
    grid-template-columns: 1fr;
  }
}
</style>
