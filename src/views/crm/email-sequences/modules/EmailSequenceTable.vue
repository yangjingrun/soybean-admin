<script setup lang="ts">
import { computed, h } from 'vue';
import { NButton, NTag } from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import {
  formatNullableText,
  formatSequenceDate,
  messageStatusLabelMap,
  messageStatusTagTypeMap,
  sequenceStatusLabelMap,
  sequenceStatusTagTypeMap
} from './shared';

defineProps<{
  loading?: boolean;
  pagination: {
    current: number;
    size: number;
    total: number;
  };
  records: Api.Crm.SequenceReviewItem[];
}>();

const emit = defineEmits<{
  review: [record: Api.Crm.SequenceReviewItem];
  updatePage: [page: number];
  updatePageSize: [pageSize: number];
}>();

const columns = computed<DataTableColumns<Api.Crm.SequenceReviewItem>>(() => [
  {
    key: 'account',
    title: '线索',
    minWidth: 220,
    render: row =>
      h('div', { class: 'sequence-cell' }, [
        h('span', { class: 'sequence-primary-text' }, row.account.name),
        h('span', { class: 'sequence-secondary-text' }, formatNullableText(row.account.domain))
      ])
  },
  {
    key: 'contact',
    title: '联系人',
    minWidth: 180,
    render: row =>
      h('div', { class: 'sequence-cell' }, [
        h('span', { class: 'sequence-primary-text' }, row.contact.fullName || '-'),
        h('span', { class: 'sequence-secondary-text' }, row.contact.title || row.contact.maskedEmail)
      ])
  },
  {
    key: 'status',
    title: '序列状态',
    width: 120,
    render: row =>
      h(
        NTag,
        { bordered: false, size: 'small', type: sequenceStatusTagTypeMap[row.enrollment.status] },
        { default: () => sequenceStatusLabelMap[row.enrollment.status] }
      )
  },
  {
    key: 'message',
    title: '首封草稿',
    minWidth: 220,
    render: row => {
      const firstMessage = row.firstMessage;

      return firstMessage
        ? h('div', { class: 'sequence-cell' }, [
            h('span', { class: 'sequence-primary-text' }, firstMessage.subject),
            h(
              NTag,
              { bordered: false, size: 'small', type: messageStatusTagTypeMap[firstMessage.status] },
              { default: () => messageStatusLabelMap[firstMessage.status] }
            )
          ])
        : '-';
    }
  },
  {
    key: 'updatedAt',
    title: '更新时间',
    width: 170,
    render: row => formatSequenceDate(row.enrollment.updatedAt)
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
          size: 'small',
          text: true,
          type: 'primary',
          onClick: () => emit('review', row)
        },
        { default: () => '审核' }
      )
  }
]);

function getRowKey(row: Api.Crm.SequenceReviewItem) {
  return row.enrollment.id;
}
</script>

<template>
  <NCard :bordered="false" size="small" class="card-wrapper" title="发送前审核清单">
    <NDataTable
      :columns="columns"
      :data="records"
      :loading="loading"
      :row-key="getRowKey"
      :scroll-x="960"
      size="small"
      remote
      :pagination="{
        page: pagination.current,
        pageSize: pagination.size,
        itemCount: pagination.total,
        showSizePicker: true,
        pageSizes: [10, 20, 50]
      }"
      @update:page="emit('updatePage', $event)"
      @update:page-size="emit('updatePageSize', $event)"
    >
      <template #empty>
        <NEmpty description="暂无待审核草稿" />
      </template>
    </NDataTable>
  </NCard>
</template>

<style scoped>
.sequence-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.sequence-primary-text {
  color: var(--n-text-color);
  font-weight: 500;
}

.sequence-secondary-text {
  color: var(--n-text-color-3);
  font-size: 12px;
}
</style>
