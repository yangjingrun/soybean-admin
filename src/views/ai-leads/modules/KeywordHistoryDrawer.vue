<script setup lang="ts">
import { computed } from 'vue';
import dayjs from 'dayjs';
import { formatHistorySubjectTokens, type HistorySubjectToken } from './history-display';

const props = defineProps<{
  show: boolean;
  records: Api.AiLeads.KeywordHistoryRecord[];
  selectedId?: string;
  loading?: boolean;
  deletingId?: string;
}>();

const emit = defineEmits<{
  'update:show': [show: boolean];
  select: [record: Api.AiLeads.KeywordHistoryRecord];
  delete: [record: Api.AiLeads.KeywordHistoryRecord];
}>();

const drawerVisible = computed({
  get: () => props.show,
  set: value => emit('update:show', value)
});

function formatTime(value: string) {
  return dayjs(value).format('YYYY-MM-DD HH:mm');
}

function resolveHistorySubjectTokens(record: Api.AiLeads.KeywordHistoryRecord): HistorySubjectToken[] {
  const tokens = formatHistorySubjectTokens(record.keywordPlan);

  if (tokens.length) {
    return tokens;
  }

  return [{ type: 'product', text: record.requirement }];
}
</script>

<template>
  <NDrawer v-model:show="drawerVisible" :width="520" placement="right">
    <NDrawerContent title="关键词优化历史" closable>
      <NSpin :show="loading">
        <NSpace v-if="records.length" vertical :size="10" class="history-list">
          <div
            v-for="record in records"
            :key="record.id"
            class="history-item"
            :class="{ active: record.id === selectedId }"
            role="button"
            tabindex="0"
            @click="emit('select', record)"
            @keydown.enter.prevent="emit('select', record)"
            @keydown.space.prevent="emit('select', record)"
          >
            <span class="history-item-main">
              <span class="history-item-subject">
                <span
                  v-for="token in resolveHistorySubjectTokens(record)"
                  :key="`${record.id}-${token.type}`"
                  class="history-item-subject-token"
                  :class="`history-item-subject-token--${token.type}`"
                >
                  {{ token.text }}
                </span>
              </span>
              <span class="history-item-desc">{{ record.requirement }}</span>
            </span>
            <span class="history-item-side">
              <span class="history-item-meta">
                <NTag v-if="record.id === selectedId" size="small" type="success" :bordered="false">当前</NTag>
                <span>{{ formatTime(record.updatedAt) }}</span>
              </span>
              <NPopconfirm @positive-click="emit('delete', record)">
                <template #trigger>
                  <NButton
                    quaternary
                    circle
                    size="tiny"
                    type="error"
                    :loading="deletingId === record.id"
                    :disabled="Boolean(deletingId)"
                    @click.stop
                    @keydown.enter.stop
                    @keydown.space.stop
                  >
                    <template #icon>
                      <SvgIcon icon="material-symbols:delete-outline" />
                    </template>
                  </NButton>
                </template>
                删除这条关键词优化历史？
              </NPopconfirm>
            </span>
          </div>
        </NSpace>
        <NEmpty v-else description="暂无历史记录" />
      </NSpin>
    </NDrawerContent>
  </NDrawer>
</template>

<style scoped>
.history-list {
  --history-item-bg: #ffffff;
  --history-item-bg-hover: #f3f6ff;
  --history-item-border: #dbe5f3;
  --history-item-text: #1f2937;
  --history-item-text-secondary: #475569;
  --history-item-text-tertiary: #64748b;

  min-width: 0;
}

.history-item {
  position: relative;
  display: block;
  width: 100%;
  min-width: 0;
  border: 1px solid var(--history-item-border);
  border-radius: 8px;
  background: var(--history-item-bg);
  cursor: pointer;
  padding: 12px;
  text-align: left;
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease;
}

.history-item:hover,
.history-item.active {
  border-color: var(--n-primary-color);
  background: var(--history-item-bg-hover);
}

.history-item:focus-visible {
  outline: 2px solid var(--n-primary-color);
  outline-offset: 2px;
}

.history-item-main {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 6px;
}

.history-item-subject {
  display: flex;
  max-width: calc(100% - 168px);
  min-width: 0;
  align-items: center;
  gap: 8px;
  overflow: hidden;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.25;
  white-space: nowrap;
}

.history-item-subject-token {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-item-subject-token--product {
  flex-shrink: 0;
  color: var(--history-item-text);
}

.history-item-subject-token--region {
  flex-shrink: 0;
  color: #2563eb;
}

.history-item-subject-token--customer {
  color: #7c3aed;
}

.history-item-desc {
  display: -webkit-box;
  overflow: hidden;
  color: var(--history-item-text-secondary);
  line-height: 1.5;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.history-item-side {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  align-items: flex-start;
  gap: 6px;
}

.history-item-meta {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 8px;
  color: var(--history-item-text-tertiary);
  font-size: 12px;
}
</style>
