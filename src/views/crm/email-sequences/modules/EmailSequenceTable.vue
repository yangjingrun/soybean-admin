<script setup lang="ts">
import { computed, h } from 'vue';
import { NButton, NTag } from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import {
  formatNullableText,
  formatSequenceDate,
  getCurrentSequenceMessage,
  getNextScheduledReviewMessage,
  getSequenceChecklistSummary,
  getSequenceNextAction,
  getSequenceProgressText,
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
    key: 'progress',
    title: '序列进度',
    width: 130,
    render: row => getSequenceProgressText(row.enrollment)
  },
  {
    key: 'currentMessage',
    title: '当前邮件',
    minWidth: 240,
    render: row => {
      const currentMessage = getCurrentSequenceMessage(row);

      return currentMessage
        ? h('div', { class: 'sequence-cell' }, [
            h('span', { class: 'sequence-primary-text' }, currentMessage.subject),
            h(
              NTag,
              { bordered: false, size: 'small', type: messageStatusTagTypeMap[currentMessage.status] },
              { default: () => messageStatusLabelMap[currentMessage.status] }
            )
          ])
        : '-';
    }
  },
  {
    key: 'checklist',
    title: '检查',
    width: 120,
    render: row => {
      const summary = getSequenceChecklistSummary(row);
      const hasWarning = summary.failedCount > 0;

      return h(
        NTag,
        { bordered: false, size: 'small', type: hasWarning ? 'warning' : 'success' },
        { default: () => (hasWarning ? `${summary.failedCount} 项预警` : `${summary.total} 项通过`) }
      );
    }
  },
  {
    key: 'nextAction',
    title: '下一步',
    minWidth: 190,
    render: row => {
      const nextAction = getSequenceNextAction(row);

      return h('div', { class: 'sequence-cell' }, [
        h(
          NTag,
          { bordered: false, size: 'small', type: nextAction.tagType },
          { default: () => nextAction.label }
        ),
        h('span', { class: 'sequence-secondary-text' }, nextAction.description)
      ]);
    }
  },
  {
    key: 'nextScheduledAt',
    title: '下一封计划发送',
    width: 170,
    render: row => {
      const nextMessage = getNextScheduledReviewMessage(row.messages);

      return nextMessage?.scheduledAt ? formatSequenceDate(nextMessage.scheduledAt) : '-';
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
    render: row => {
      const nextAction = getSequenceNextAction(row);

      return h(
        NButton,
        {
          size: 'small',
          text: true,
          type: nextAction.buttonLabel === '启动' ? 'success' : 'primary',
          onClick: () => emit('review', row)
        },
        { default: () => nextAction.buttonLabel }
      );
    }
  }
]);

function getRowKey(row: Api.Crm.SequenceReviewItem) {
  return row.enrollment.id;
}
</script>

<template>
  <NCard :bordered="false" size="small" class="card-wrapper" title="序列审核清单">
    <NDataTable
      :columns="columns"
      :data="records"
      :loading="loading"
      :row-key="getRowKey"
      :scroll-x="1470"
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
