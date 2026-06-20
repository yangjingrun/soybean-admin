<script setup lang="ts">
import { formatTaskCountMeta, formatTaskProgress, formatTaskStatus } from './shared';

defineProps<{
  tasks: Api.Crm.WorkbenchRunningTask[];
}>();

defineEmits<{
  navigate: [target: { routePath: string }];
}>();
</script>

<template>
  <section class="task-panel">
    <div class="task-panel__header">
      <div>
        <h2>任务进度</h2>
        <p>批量发送、AI 草稿和 AI 获客的当前进度</p>
      </div>
    </div>

    <NEmpty v-if="tasks.length === 0" description="暂无运行或待确认任务" size="small" class="task-panel__empty" />
    <NSpace v-else vertical :size="12">
      <button v-for="task in tasks" :key="task.id" class="task-row" type="button" @click="$emit('navigate', task)">
        <div class="task-row__top">
          <div class="task-row__title">
            <span>{{ task.title }}</span>
            <NTag size="small" round>{{ formatTaskStatus(task.status) }}</NTag>
          </div>
          <SvgIcon icon="mdi:chevron-right" class="task-row__arrow" />
        </div>
        <NProgress
          type="line"
          :percentage="formatTaskProgress(task)"
          :height="8"
          :border-radius="4"
          :fill-border-radius="4"
          :show-indicator="false"
        />
        <div class="task-row__meta">
          <span>完成 {{ formatTaskCountMeta(task).completedCount }}</span>
          <span>失败 {{ formatTaskCountMeta(task).failedCount }}</span>
          <span>剩余 {{ formatTaskCountMeta(task).pendingCount }}</span>
          <span>总数 {{ formatTaskCountMeta(task).totalCount }}</span>
        </div>
      </button>
    </NSpace>
  </section>
</template>

<style scoped>
.task-panel {
  min-height: 220px;
  padding: 18px;
  border: 1px solid rgb(226 232 240);
  border-radius: 8px;
  background: #fff;
}

.task-panel__header h2 {
  margin: 0;
  color: #0f172a;
  font-size: 17px;
  font-weight: 650;
}

.task-panel__header p {
  margin: 6px 0 0;
  color: #64748b;
  font-size: 13px;
}

.task-panel__empty {
  margin-top: 28px;
}

.task-row {
  display: block;
  width: 100%;
  padding: 12px;
  border: 1px solid rgb(226 232 240);
  border-radius: 8px;
  background: #f8fafc;
  cursor: pointer;
  text-align: left;
}

.task-row:hover {
  border-color: #94a3b8;
  background: #fff;
}

.task-row__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
}

.task-row__title {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 8px;
  color: #0f172a;
  font-size: 14px;
  font-weight: 600;
}

.task-row__title span:first-child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-row__arrow {
  flex: 0 0 auto;
  color: #64748b;
}

.task-row__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  margin-top: 8px;
  color: #64748b;
  font-size: 12px;
}
</style>
