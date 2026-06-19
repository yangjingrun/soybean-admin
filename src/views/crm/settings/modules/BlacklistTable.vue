<script setup lang="ts">
import { computed, h } from 'vue';
import { NButton, NTag } from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import { blacklistReasonLabelMap, formatBlacklistDate } from './shared';

const props = defineProps<{
  records: Api.Crm.BlacklistRecord[];
  loading?: boolean;
  page: number;
  pageSize: number;
  removingId?: string | null;
  total: number;
}>();

const emit = defineEmits<{
  remove: [record: Api.Crm.BlacklistRecord];
  updatePage: [page: number];
  updatePageSize: [pageSize: number];
}>();

function renderSource(row: Api.Crm.BlacklistRecord) {
  const values = [
    row.sourceAccountId ? `线索 ${row.sourceAccountId}` : '',
    row.sourceContactId ? `联系人 ${row.sourceContactId}` : '',
    row.sourceMessageId ? `邮件 ${row.sourceMessageId}` : ''
  ].filter(Boolean);

  return h('span', { class: values.length ? 'blacklist-source-text' : 'blacklist-empty-text' }, values.join(' / ') || '-');
}

const columns = computed<DataTableColumns<Api.Crm.BlacklistRecord>>(() => [
  {
    key: 'maskedEmail',
    title: '邮箱',
    minWidth: 180,
    render: row => h('span', { class: 'blacklist-primary-text' }, row.maskedEmail)
  },
  {
    key: 'reason',
    title: '原因',
    width: 120,
    render: row =>
      h(
        NTag,
        {
          bordered: false,
          size: 'small',
          type: 'error'
        },
        { default: () => blacklistReasonLabelMap[row.reason] }
      )
  },
  {
    key: 'source',
    title: '来源',
    minWidth: 300,
    render: row => renderSource(row)
  },
  {
    key: 'createdByName',
    title: '创建人',
    minWidth: 140,
    render: row => row.createdByName || row.createdById || '-'
  },
  {
    key: 'updatedAt',
    title: '更新时间',
    minWidth: 180,
    render: row => formatBlacklistDate(row.updatedAt)
  },
  {
    key: 'operate',
    title: '操作',
    width: 100,
    fixed: 'right',
    render: row =>
      h(
        NButton,
        {
          loading: props.removingId === row.id,
          size: 'small',
          text: true,
          type: 'warning',
          onClick: () => emit('remove', row)
        },
        { default: () => '解除' }
      )
  }
]);
</script>

<template>
  <NSpace vertical :size="12">
    <NDataTable
      :columns="columns"
      :data="records"
      :loading="loading"
      :row-key="row => row.id"
      :scroll-x="1020"
      size="small"
      remote
    >
      <template #empty>
        <NEmpty description="暂无退订黑名单" />
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
</template>

<style scoped>
.blacklist-primary-text {
  color: var(--n-text-color);
  font-weight: 500;
}

.blacklist-source-text,
.blacklist-empty-text {
  color: var(--n-text-color-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.table-pagination {
  display: flex;
  justify-content: flex-end;
}
</style>
