<script setup lang="ts">
import { computed, h, inject } from 'vue';
import { NButton, NTag } from 'naive-ui';
import type { DataTableColumns, DataTableRowKey } from 'naive-ui';
import {
  buildSequenceBatchResultDisplayMap,
  formatNullableText,
  formatSequenceDate,
  getCurrentSequenceMessage,
  getMessageStatusView,
  getNextScheduledReviewMessage,
  getSequenceNextAction,
  getSequenceProgressText,
  getSequenceSendAuditSummary,
  sequenceBatchResultDisplayKey,
  sequenceStatusLabelMap,
  sequenceStatusTagTypeMap,
  summarizeSequenceBatchSelection
} from './shared';

const emit = defineEmits<{
  batchApproveDrafts: [];
  createAiDraftTask: [];
  batchGenerateNextDrafts: [];
  batchStopSequences: [];
  review: [record: Api.Crm.SequenceReviewItem];
  updateCheckedRowKeys: [keys: DataTableRowKey[]];
  updatePage: [page: number];
  updatePageSize: [pageSize: number];
}>();

const props = defineProps<{
  batchDraftApproving?: boolean;
  aiDraftTaskCreating?: boolean;
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
  Boolean(
    props.loading ||
      props.batchDraftApproving ||
      props.aiDraftTaskCreating ||
      props.batchNextDraftGenerating ||
      props.batchSequenceStopping
  )
);
const batchNextDraftResultDisplays = inject(sequenceBatchResultDisplayKey);
const recentBatchResultItems = computed(() => batchNextDraftResultDisplays?.value ?? []);
const recentBatchResultMap = computed(() => buildSequenceBatchResultDisplayMap(recentBatchResultItems.value));
const recentBatchResultSummary = computed(() => {
  if (recentBatchResultItems.value.length === 0) return null;

  const successCount = recentBatchResultItems.value.filter(item => item.status === 'success').length;
  const skippedCount = recentBatchResultItems.value.filter(item => item.status === 'skipped').length;
  const failedCount = recentBatchResultItems.value.filter(item => item.status === 'failed').length;
  const alertType = failedCount > 0 ? 'error' : skippedCount > 0 ? 'warning' : 'success';

  return {
    alertType: alertType as 'error' | 'warning' | 'success',
    text: `最近批量生成结果：成功 ${successCount} 条，跳过 ${skippedCount} 条，失败 ${failedCount} 条`
  };
});
const batchSelectionSummary = computed(() => {
  const checkedSet = new Set(props.checkedRowKeys.map(String));
  const selectedRecords = props.records.filter(record => checkedSet.has(record.enrollment.id));

  return summarizeSequenceBatchSelection(selectedRecords);
});
const tableScrollX = computed(() => (recentBatchResultItems.value.length > 0 ? 1670 : 1470));

const columns = computed<DataTableColumns<Api.Crm.SequenceReviewItem>>(() => {
  const tableColumns: DataTableColumns<Api.Crm.SequenceReviewItem> = [
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

        if (!currentMessage) {
          return '-';
        }

        const messageStatusView = getMessageStatusView(currentMessage, row.enrollment.status);

        return h('div', { class: 'sequence-cell' }, [
          h('span', { class: 'sequence-primary-text' }, currentMessage.subject),
          h(
            NTag,
            { bordered: false, size: 'small', type: messageStatusView.tagType },
            { default: () => messageStatusView.label }
          )
        ]);
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
    }
  ];

  if (recentBatchResultItems.value.length > 0) {
    tableColumns.push(
      {
        key: 'batchNextDraftResult',
        title: '最近生成结果',
        minWidth: 220,
        render: row => {
          const result = recentBatchResultMap.value.get(row.enrollment.id);

          if (!result) {
            return '-';
          }

          return h('div', { class: 'sequence-cell' }, [
            h('div', { class: 'sequence-result-line' }, [
              h(NTag, { bordered: false, size: 'small', type: result.tagType }, { default: () => result.statusLabel }),
              result.stepText ? h('span', { class: 'sequence-secondary-text' }, result.stepText) : null
            ]),
            h('span', { class: 'sequence-secondary-text' }, result.message)
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
      }
    );
  } else {
    tableColumns.push({
      key: 'nextScheduledAt',
      title: '下一封计划发送',
      width: 170,
      render: row => {
        const nextMessage = getNextScheduledReviewMessage(row.messages);

        return nextMessage?.scheduledAt ? formatSequenceDate(nextMessage.scheduledAt) : '-';
      }
    });
  }

  tableColumns.push(
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
  );

  return tableColumns;
});

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
          type="primary"
          secondary
          :disabled="batchSelectionSummary.generateNextDraftCount === 0 || batchBusy"
          :loading="aiDraftTaskCreating"
          @click="emit('createAiDraftTask')"
        >
          批量 AI 生成草稿
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

    <NAlert
      v-if="recentBatchResultSummary"
      class="sequence-batch-result-alert"
      :show-icon="false"
      :title="recentBatchResultSummary.text"
      :type="recentBatchResultSummary.alertType"
    />

    <NDataTable
      :checked-row-keys="checkedRowKeys"
      :columns="columns"
      :data="records"
      :loading="loading"
      :row-key="getRowKey"
      :scroll-x="tableScrollX"
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

.sequence-result-line {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.sequence-batch-result-alert {
  margin-bottom: 12px;
}
</style>
