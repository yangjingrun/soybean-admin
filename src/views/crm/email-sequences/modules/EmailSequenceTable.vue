<script setup lang="ts">
import { computed, h } from 'vue';
import { NButton, NTag } from 'naive-ui';
import type { DataTableColumns, DataTableRowKey } from 'naive-ui';
import {
  formatNullableText,
  formatSequenceDate,
  getCurrentSequenceMessage,
  getNextScheduledReviewMessage,
  getSequenceNextAction,
  getSequenceProgressText,
  getSequenceSendAuditSummary,
  messageStatusLabelMap,
  messageStatusTagTypeMap,
  sequenceStatusLabelMap,
  sequenceStatusTagTypeMap,
  summarizeSequenceBatchSelection
} from './shared';

const emit = defineEmits<{
  batchApproveDrafts: [];
  batchGenerateNextDrafts: [];
  batchStopSequences: [];
  review: [record: Api.Crm.SequenceReviewItem];
  updateCheckedRowKeys: [keys: DataTableRowKey[]];
  updatePage: [page: number];
  updatePageSize: [pageSize: number];
}>();

const props = defineProps<{
  batchDraftApproving?: boolean;
  batchNextDraftGenerating?: boolean;
  batchSequenceStopping?: boolean;
  checkedRowKeys: DataTableRowKey[];
  loading?: boolean;
  pagination: {
    current: number;
    size: number;
    total: number;
  };
  records: Api.Crm.SequenceReviewItem[];
}>();

const batchBusy = computed(() =>
  Boolean(props.loading || props.batchDraftApproving || props.batchNextDraftGenerating || props.batchSequenceStopping)
);
const batchSelectionSummary = computed(() => {
  const checkedSet = new Set(props.checkedRowKeys.map(String));
  const selectedRecords = props.records.filter(record => checkedSet.has(record.enrollment.id));

  return summarizeSequenceBatchSelection(selectedRecords);
});

const columns = computed<DataTableColumns<Api.Crm.SequenceReviewItem>>(() => [
  {
    type: 'selection',
    width: 48
  },
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
    title: '发送审核',
    minWidth: 180,
    render: row => {
      const summary = getSequenceSendAuditSummary(row);

      return h('div', { class: 'sequence-cell' }, [
        h(
          NTag,
          { bordered: false, size: 'small', type: summary.tagType },
          { default: () => summary.label }
        ),
        h('span', { class: 'sequence-secondary-text' }, summary.description)
      ]);
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
          type: ['启动', '生成'].includes(nextAction.buttonLabel) ? 'success' : 'primary',
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
    <template #header-extra>
      <NSpace align="center" :size="8">
        <NText v-if="batchSelectionSummary.selectedCount > 0" depth="3">
          已选 {{ batchSelectionSummary.selectedCount }} 条
        </NText>
        <NButton
          size="small"
          type="primary"
          secondary
          :disabled="batchSelectionSummary.approveDraftCount === 0 || batchBusy"
          :loading="batchDraftApproving"
          @click="emit('batchApproveDrafts')"
        >
          批量确认草稿
        </NButton>
        <NButton
          size="small"
          type="success"
          secondary
          :disabled="batchSelectionSummary.generateNextDraftCount === 0 || batchBusy"
          :loading="batchNextDraftGenerating"
          @click="emit('batchGenerateNextDrafts')"
        >
          生成下一封
        </NButton>
        <NButton
          size="small"
          type="warning"
          secondary
          :disabled="batchSelectionSummary.stopCount === 0 || batchBusy"
          :loading="batchSequenceStopping"
          @click="emit('batchStopSequences')"
        >
          停止序列
        </NButton>
      </NSpace>
    </template>

    <NDataTable
      :checked-row-keys="checkedRowKeys"
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
      @update:checked-row-keys="emit('updateCheckedRowKeys', $event)"
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
