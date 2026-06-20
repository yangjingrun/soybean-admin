<script setup lang="ts">
import type { WorkbenchRouteTarget, WorkbenchTodoItem } from './shared';

defineProps<{
  items: WorkbenchTodoItem[];
  loading: boolean;
}>();

defineEmits<{
  navigate: [target: WorkbenchRouteTarget];
}>();

const startAiLeadTarget: WorkbenchRouteTarget = {
  routePath: '/ai-leads',
  query: { mode: 'new' }
};
</script>

<template>
  <section class="todo-panel">
    <div class="todo-panel__header">
      <div>
        <h2>今日待办</h2>
        <p>按处理优先级聚合，不展示低价值流水记录</p>
      </div>
    </div>

    <NSkeleton v-if="loading" text :repeat="5" class="todo-panel__skeleton" />
    <NEmpty v-else-if="items.length === 0" description="今天暂无待办" size="small" class="todo-panel__empty">
      <template #extra>
        <NButton type="primary" size="small" @click="$emit('navigate', startAiLeadTarget)">
          <template #icon>
            <SvgIcon icon="mdi:target-account" />
          </template>
          开始获客
        </NButton>
      </template>
    </NEmpty>
    <NSpace v-else vertical :size="10">
      <button v-for="item in items" :key="item.key" class="todo-row" type="button" @click="$emit('navigate', item)">
        <span class="todo-row__icon">
          <SvgIcon :icon="item.icon" />
        </span>
        <span class="todo-row__content">
          <span class="todo-row__title">{{ item.title }}</span>
          <span class="todo-row__desc">{{ item.description }}</span>
        </span>
        <NTag :type="item.tagType" size="small" round>{{ item.count }}</NTag>
      </button>
    </NSpace>
  </section>
</template>

<style scoped>
.todo-panel {
  min-height: 360px;
  padding: 18px;
  border: 1px solid rgb(226 232 240);
  border-radius: 8px;
  background: #fff;
}

.todo-panel__header h2 {
  margin: 0;
  color: #0f172a;
  font-size: 17px;
  font-weight: 650;
}

.todo-panel__header p {
  margin: 6px 0 0;
  color: #64748b;
  font-size: 13px;
}

.todo-panel__skeleton,
.todo-panel__empty {
  margin-top: 28px;
}

.todo-row {
  display: grid;
  align-items: center;
  grid-template-columns: 36px minmax(0, 1fr) auto;
  width: 100%;
  padding: 12px;
  border: 1px solid rgb(226 232 240);
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  text-align: left;
  gap: 10px;
}

.todo-row:hover {
  border-color: #94a3b8;
  background: #f8fafc;
}

.todo-row__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  color: #2563eb;
  background: #eff6ff;
  font-size: 18px;
}

.todo-row__content {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
}

.todo-row__title {
  overflow: hidden;
  color: #0f172a;
  font-size: 14px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.todo-row__desc {
  overflow: hidden;
  color: #64748b;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
