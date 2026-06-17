<script setup lang="ts">
import { computed, h } from 'vue';
import { NButton, NTag } from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import {
  formatLogDate,
  logLevelLabelMap,
  logLevelTagTypeMap,
  logStatusLabelMap,
  logStatusTagTypeMap
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
    key: 'module',
    title: '模块',
    minWidth: 120
  },
  {
    key: 'action',
    title: '动作',
    minWidth: 140
  },
  {
    key: 'userName',
    title: '用户',
    minWidth: 120,
    render: row => row.userName || row.userId || '-'
  },
  {
    key: 'message',
    title: '消息',
    minWidth: 260,
    ellipsis: {
      tooltip: true
    }
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
        :scroll-x="1180"
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
.table-pagination {
  display: flex;
  justify-content: flex-end;
}
</style>
