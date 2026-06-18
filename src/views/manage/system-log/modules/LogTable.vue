<script setup lang="ts">
import { computed, h } from 'vue';
import { NButton, NTag } from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import {
  formatLogDate,
  logLevelLabelMap,
  logLevelTagTypeMap,
  logStatusLabelMap,
  logStatusTagTypeMap,
  readMetadataString
} from './shared';

defineProps<{
  records: Api.SystemLog.SystemLogRecord[];
  loading?: boolean;
  page: number;
  pageSize: number;
  total: number;
}>();

const emit = defineEmits<{
  view: [record: Api.SystemLog.SystemLogRecord];
  updatePage: [page: number];
  updatePageSize: [pageSize: number];
}>();

/** Render module and action together so audit rows read like one operation. */
function renderModuleAction(row: Api.SystemLog.SystemLogRecord) {
  return h('div', { class: 'module-action-cell' }, [
    h('span', { class: 'module-name' }, row.module),
    h('span', { class: 'action-name' }, row.action)
  ]);
}

const columns = computed<DataTableColumns<Api.SystemLog.SystemLogRecord>>(() => [
  {
    key: 'createdAt',
    title: '时间',
    width: 170,
    render: row => formatLogDate(row.createdAt)
  },
  {
    key: 'level',
    title: '等级',
    width: 90,
    render: row =>
      h(
        NTag,
        {
          bordered: false,
          size: 'small',
          type: logLevelTagTypeMap[row.level]
        },
        { default: () => logLevelLabelMap[row.level] }
      )
  },
  {
    key: 'status',
    title: '状态',
    width: 90,
    render: row =>
      h(
        NTag,
        {
          bordered: false,
          size: 'small',
          type: logStatusTagTypeMap[row.status]
        },
        { default: () => logStatusLabelMap[row.status] }
      )
  },
  {
    key: 'moduleAction',
    title: '模块 / 动作',
    minWidth: 190,
    render: row => renderModuleAction(row)
  },
  {
    key: 'userName',
    title: '操作人',
    minWidth: 120,
    render: row => row.userName || row.userId || '-'
  },
  {
    key: 'ip',
    title: 'IP',
    minWidth: 140,
    render: row => readMetadataString(row.metadata, 'ip')
  },
  {
    key: 'message',
    title: '摘要',
    minWidth: 300,
    ellipsis: {
      tooltip: true
    }
  },
  {
    key: 'errorCode',
    title: '错误码',
    width: 120,
    render: row => row.errorCode || '-'
  },
  {
    key: 'operate',
    title: '操作',
    width: 88,
    fixed: 'right',
    render: row =>
      h(
        NButton,
        {
          size: 'small',
          text: true,
          type: 'primary',
          onClick: () => emit('view', row)
        },
        { default: () => '详情' }
      )
  }
]);
</script>

<template>
  <NCard :bordered="false" size="small" class="card-wrapper">
    <NSpace vertical :size="12">
      <NDataTable
        :columns="columns"
        :data="records"
        :loading="loading"
        :row-key="row => row.id"
        :scroll-x="1380"
        size="small"
        remote
      >
        <template #empty>
          <NEmpty description="暂无日志" />
        </template>
      </NDataTable>

      <div class="table-pagination">
        <NPagination
          :page="page"
          :page-size="pageSize"
          :item-count="total"
          :page-sizes="[10, 20, 50, 100]"
          show-size-picker
          @update:page="emit('updatePage', $event)"
          @update:page-size="emit('updatePageSize', $event)"
        />
      </div>
    </NSpace>
  </NCard>
</template>

<style scoped>
.module-action-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  line-height: 1.3;
}

.module-name {
  color: var(--n-text-color);
  font-weight: 500;
}

.action-name {
  color: var(--n-text-color-3);
  font-size: 12px;
}

.table-pagination {
  display: flex;
  justify-content: flex-end;
}
</style>
