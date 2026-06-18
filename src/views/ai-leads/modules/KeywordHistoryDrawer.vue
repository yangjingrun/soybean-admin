<script setup lang="ts">
import { computed } from 'vue';
import dayjs from 'dayjs';

const props = defineProps<{
  show: boolean;
  records: Api.AiLeads.KeywordHistoryRecord[];
  selectedId?: string;
  loading?: boolean;
}>();

const emit = defineEmits<{
  'update:show': [show: boolean];
  select: [record: Api.AiLeads.KeywordHistoryRecord];
}>();

const drawerVisible = computed({
  get: () => props.show,
  set: value => emit('update:show', value)
});

function formatTime(value: string) {
  return dayjs(value).format('YYYY-MM-DD HH:mm');
}
</script>

<template>
  <NDrawer v-model:show="drawerVisible" :width="520" placement="right">
    <NDrawerContent title="关键词优化历史" closable>
      <NSpin :show="loading">
        <NSpace v-if="records.length" vertical :size="10" class="history-list">
          <button
            v-for="record in records"
            :key="record.id"
            class="history-item"
            :class="{ active: record.id === selectedId }"
            type="button"
            @click="emit('select', record)"
          >
            <span class="history-item-main">
              <span class="history-item-title">{{ record.keywordPlan.resolvedProductKeywords || record.requirement }}</span>
              <span class="history-item-desc">{{ record.requirement }}</span>
            </span>
            <span class="history-item-meta">
              <NTag v-if="record.id === selectedId" size="small" type="success" :bordered="false">当前</NTag>
              <span>{{ formatTime(record.updatedAt) }}</span>
            </span>
          </button>
        </NSpace>
        <NEmpty v-else description="暂无历史记录" />
      </NSpin>
    </NDrawerContent>
  </NDrawer>
</template>

<style scoped>
.history-list {
  min-width: 0;
}

.history-item {
  display: flex;
  width: 100%;
  min-width: 0;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
  background: var(--n-color);
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
  background: var(--n-color-hover);
}

.history-item-main {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 6px;
}

.history-item-title {
  overflow: hidden;
  color: var(--n-text-color);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-item-desc {
  display: -webkit-box;
  overflow: hidden;
  color: var(--n-text-color-2);
  line-height: 1.5;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.history-item-meta {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 8px;
  color: var(--n-text-color-3);
  font-size: 12px;
}
</style>
