<script setup lang="ts">
import { computed, h } from 'vue';
import { NTag } from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import {
  aiDraftTaskItemStatusLabelMap,
  aiDraftTaskItemStatusTagTypeMap,
  aiDraftTaskStatusLabelMap,
  aiDraftTaskStatusTagTypeMap
} from '../../settings/modules/shared';

const emit = defineEmits<{
  cancel: [];
  read: [];
  refresh: [];
  retry: [];
  'update:show': [show: boolean];
}>();

const props = defineProps<{
  cancelling?: boolean;
  detail: Api.Crm.AiDraftTaskDetail | null;
  loading?: boolean;
  reading?: boolean;
  retrying?: boolean;
  show: boolean;
}>();

const task = computed(() => props.detail?.task ?? null);
const items = computed(() => props.detail?.items ?? []);
const isActiveTask = computed(() => task.value && ['queued', 'running'].includes(task.value.status));
const hasRetryableFailures = computed(() =>
  items.value.some(item => item.status === 'failed' && item.failureType === 'retryable')
);
const progressText = computed(() => {
  if (!task.value) return '0 / 0';

  const finishedCount = task.value.successCount + task.value.skippedCount + task.value.failedCount;

  return `${finishedCount} / ${task.value.requestedCount}`;
});

const columns: DataTableColumns<Api.Crm.AiDraftTaskItemRecord> = [
  {
    key: 'stepIndex',
    title: '第几封',
    width: 80,
    render: row => `第 ${row.stepIndex} 封`
  },
  {
    key: 'status',
    title: '状态',
    width: 110,
    render: row =>
      h(
        NTag,
        { bordered: false, size: 'small', type: aiDraftTaskItemStatusTagTypeMap[row.status] },
        { default: () => aiDraftTaskItemStatusLabelMap[row.status] }
      )
  },
  {
    key: 'attemptCount',
    title: '尝试',
    width: 80,
    render: row => `${row.attemptCount}/${row.maxAttempts}`
  },
  {
    key: 'draftSubject',
    title: '草稿主题',
    minWidth: 220,
    ellipsis: { tooltip: true },
    render: row => row.draftSubject || '-'
  },
  {
    key: 'failureReason',
    title: '原因',
    minWidth: 260,
    ellipsis: { tooltip: true },
    render: row => row.failureReason || '-'
  }
];
</script>

<template>
  <NDrawer :show="show" :width="720" placement="right" @update:show="emit('update:show', $event)">
    <NDrawerContent title="批量 AI 草稿任务">
      <NSpin :show="loading">
        <NEmpty v-if="!task" description="暂无批量 AI 草稿任务" />

        <NSpace v-else vertical :size="16">
          <NSpace align="center" justify="space-between">
            <NSpace align="center">
              <NTag :bordered="false" :type="aiDraftTaskStatusTagTypeMap[task.status]">
                {{ aiDraftTaskStatusLabelMap[task.status] }}
              </NTag>
              <NText depth="3">进度 {{ progressText }}</NText>
              <NText depth="3">并发 {{ task.effectiveConcurrency }}</NText>
            </NSpace>
            <NSpace :size="8">
              <NButton size="small" :loading="loading" @click="emit('refresh')">刷新</NButton>
              <NButton
                v-if="hasRetryableFailures"
                size="small"
                type="primary"
                secondary
                :loading="retrying"
                :disabled="Boolean(isActiveTask)"
                @click="emit('retry')"
              >
                重试失败项
              </NButton>
              <NButton
                v-if="isActiveTask"
                size="small"
                type="warning"
                secondary
                :loading="cancelling"
                @click="emit('cancel')"
              >
                取消
              </NButton>
              <NButton v-if="!isActiveTask" size="small" type="primary" :loading="reading" @click="emit('read')">
                知道了
              </NButton>
            </NSpace>
          </NSpace>

          <NGrid :cols="3" :x-gap="12" :y-gap="12">
            <NGi>
              <NStatistic label="成功" :value="task.successCount" />
            </NGi>
            <NGi>
              <NStatistic label="跳过" :value="task.skippedCount" />
            </NGi>
            <NGi>
              <NStatistic label="失败" :value="task.failedCount" />
            </NGi>
            <NGi>
              <NStatistic label="待生成" :value="task.pendingCount" />
            </NGi>
            <NGi>
              <NStatistic label="生成中" :value="task.runningCount" />
            </NGi>
            <NGi>
              <NStatistic label="待重试" :value="task.retryingCount" />
            </NGi>
          </NGrid>

          <NAlert v-if="task.failureReason" type="warning" :show-icon="false">
            {{ task.failureReason }}
          </NAlert>

          <NDataTable
            :columns="columns"
            :data="items"
            :pagination="{ pageSize: 8 }"
            :row-key="row => row.id"
            :scroll-x="760"
            size="small"
          />
        </NSpace>
      </NSpin>
    </NDrawerContent>
  </NDrawer>
</template>
