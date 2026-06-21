<script setup lang="ts">
import { computed, h, shallowRef } from 'vue';
import { NButton, NTag } from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import {
  aiDraftTaskStatusLabelMap,
  aiDraftTaskStatusTagTypeMap,
  buildAiDraftTaskOperationDetailItems,
  buildMailboxOperationDetailItems,
  buildOperationLogDetailItems,
  buildOperationQueueDetailItems,
  formatAiDraftTaskCounts,
  formatMailboxDate,
  formatMailboxHistoryId,
  formatMailboxSyncModeDescription,
  formatMailboxWatchDescription,
  formatOperationDate,
  getMailboxWatchStatus,
  mailboxSyncModeLabelMap,
  mailboxSyncModeTagTypeMap,
  mailboxStatusLabelMap,
  mailboxStatusTagTypeMap,
  mailboxWatchStatusLabelMap,
  mailboxWatchStatusTagTypeMap,
  operationLogLevelLabelMap,
  operationLogLevelTagTypeMap,
  operationLogStatusLabelMap,
  operationLogStatusTagTypeMap,
  operationMessageStatusLabelMap,
  operationMessageStatusTagTypeMap,
  type OperationDetailItem,
  type OperationLogSummaryRow,
  type OperationQueueRow
} from './shared';
import { useCrmOperationsPanel } from './useCrmOperationsPanel';

const {
  activeAiDraftTaskCount,
  aiDraftTasks,
  canManageOperations,
  handleReconcileSendQueue,
  loadOperations,
  loading,
  logRows,
  mailboxHealth,
  mailboxes,
  operationSummaryRows,
  queueRows,
  sendQueueReconcileResult,
  sendQueueReconciling
} = useCrmOperationsPanel();
const selectedLog = shallowRef<Api.SystemLog.SystemLogRecord | null>(null);
const selectedQueueRow = shallowRef<OperationQueueRow | null>(null);
const selectedAiDraftTask = shallowRef<Api.Crm.AiDraftTaskRecord | null>(null);
const selectedMailbox = shallowRef<Api.Crm.MailboxRecord | null>(null);
const detailVisible = shallowRef(false);

const detailTitle = computed(() => {
  if (selectedAiDraftTask.value) {
    return 'AI 草稿任务详情';
  }

  if (selectedQueueRow.value) {
    return '发送队列详情';
  }

  if (selectedMailbox.value) {
    return '同步详情';
  }

  if (selectedLog.value) {
    return 'CRM 日志详情';
  }

  return '运维详情';
});

const detailItems = computed<OperationDetailItem[]>(() => {
  if (selectedAiDraftTask.value) {
    return buildAiDraftTaskOperationDetailItems(selectedAiDraftTask.value);
  }

  if (selectedQueueRow.value) {
    return buildOperationQueueDetailItems(selectedQueueRow.value);
  }

  if (selectedMailbox.value) {
    return buildMailboxOperationDetailItems(selectedMailbox.value);
  }

  if (selectedLog.value) {
    return buildOperationLogDetailItems(selectedLog.value);
  }

  return [];
});

function openQueueDetail(row: OperationQueueRow) {
  selectedLog.value = null;
  selectedQueueRow.value = row;
  selectedAiDraftTask.value = null;
  selectedMailbox.value = null;
  detailVisible.value = true;
}

function openAiDraftTaskDetail(row: Api.Crm.AiDraftTaskRecord) {
  selectedLog.value = null;
  selectedQueueRow.value = null;
  selectedAiDraftTask.value = row;
  selectedMailbox.value = null;
  detailVisible.value = true;
}

function openMailboxDetail(row: Api.Crm.MailboxRecord) {
  selectedLog.value = null;
  selectedQueueRow.value = null;
  selectedAiDraftTask.value = null;
  selectedMailbox.value = row;
  detailVisible.value = true;
}

function openLogDetail(row: Api.SystemLog.SystemLogRecord) {
  selectedLog.value = row;
  selectedQueueRow.value = null;
  selectedAiDraftTask.value = null;
  selectedMailbox.value = null;
  detailVisible.value = true;
}

function renderQueueTarget(row: OperationQueueRow) {
  return h('div', { class: 'mailbox-stack-cell' }, [
    h('span', { class: 'mailbox-primary-text' }, row.accountName),
    h('span', { class: 'mailbox-secondary-text' }, row.contactName)
  ]);
}

function renderJob(row: OperationQueueRow) {
  return h('div', { class: 'mailbox-stack-cell' }, [
    h('span', { class: 'mailbox-primary-text' }, row.bullJobId ?? '-'),
    h('span', { class: 'mailbox-secondary-text' }, `run v${row.runVersion}`)
  ]);
}

function renderQueueTime(row: OperationQueueRow) {
  return h('div', { class: 'mailbox-stack-cell' }, [
    h('span', { class: 'mailbox-primary-text' }, formatOperationDate(row.scheduledAt)),
    h('span', { class: 'mailbox-secondary-text' }, `发送 ${formatOperationDate(row.sentAt)}`)
  ]);
}

function renderAiDraftTaskStatus(row: Api.Crm.AiDraftTaskRecord) {
  return h('div', { class: 'mailbox-stack-cell' }, [
    h(
      NTag,
      {
        bordered: false,
        size: 'small',
        type: aiDraftTaskStatusTagTypeMap[row.status]
      },
      { default: () => aiDraftTaskStatusLabelMap[row.status] }
    ),
    h('span', { class: 'mailbox-secondary-text' }, `并发 ${row.effectiveConcurrency}`)
  ]);
}

function renderAiDraftTaskProgress(row: Api.Crm.AiDraftTaskRecord) {
  const finishedCount = row.successCount + row.skippedCount + row.failedCount;

  return h('div', { class: 'mailbox-stack-cell' }, [
    h('span', { class: 'mailbox-primary-text' }, `${finishedCount} / ${row.requestedCount}`),
    h('span', { class: 'mailbox-secondary-text' }, formatAiDraftTaskCounts(row))
  ]);
}

function renderMailboxStatus(row: Api.Crm.MailboxRecord) {
  return h(
    NTag,
    {
      bordered: false,
      size: 'small',
      type: mailboxStatusTagTypeMap[row.status]
    },
    { default: () => mailboxStatusLabelMap[row.status] }
  );
}

function renderWatchStatus(row: Api.Crm.MailboxRecord) {
  if (row.syncMode !== 'full_sync') {
    return h('div', { class: 'mailbox-stack-cell' }, [
      h(
        NTag,
        {
          bordered: false,
          size: 'small',
          type: mailboxSyncModeTagTypeMap[row.syncMode]
        },
        { default: () => mailboxSyncModeLabelMap[row.syncMode] }
      ),
      h('span', { class: 'mailbox-secondary-text' }, formatMailboxSyncModeDescription(row))
    ]);
  }

  const watchStatus = getMailboxWatchStatus(row.watchExpiration);

  return h('div', { class: 'mailbox-stack-cell' }, [
    h(
      NTag,
      {
        bordered: false,
        size: 'small',
        type: mailboxWatchStatusTagTypeMap[watchStatus]
      },
      { default: () => mailboxWatchStatusLabelMap[watchStatus] }
    ),
    h('span', { class: 'mailbox-secondary-text' }, formatMailboxWatchDescription(row.watchExpiration))
  ]);
}

function renderSyncMode(row: Api.Crm.MailboxRecord) {
  return h('div', { class: 'mailbox-stack-cell' }, [
    h(
      NTag,
      {
        bordered: false,
        size: 'small',
        type: mailboxSyncModeTagTypeMap[row.syncMode]
      },
      { default: () => mailboxSyncModeLabelMap[row.syncMode] }
    ),
    h('span', { class: 'mailbox-secondary-text' }, formatMailboxSyncModeDescription(row))
  ]);
}

function renderSyncCheckpoint(row: Api.Crm.MailboxRecord) {
  if (row.syncMode !== 'full_sync') {
    return h('div', { class: 'mailbox-stack-cell' }, [
      h(NTag, { bordered: false, size: 'small', type: 'default' }, { default: () => '非完整同步' }),
      h('span', { class: 'mailbox-secondary-text' }, '不计入真实收件闭环')
    ]);
  }

  if (row.lastSyncIssue) {
    return h('div', { class: 'mailbox-stack-cell' }, [
      h(NTag, { bordered: false, size: 'small', type: 'error' }, { default: () => '需处理' }),
      h('span', { class: 'mailbox-secondary-text' }, row.lastSyncIssue.message)
    ]);
  }

  return formatMailboxHistoryId(row.lastHistoryId);
}

function renderLogAction(row: Api.SystemLog.SystemLogRecord) {
  return h('div', { class: 'mailbox-stack-cell' }, [
    h('span', { class: 'mailbox-primary-text' }, row.action),
    h('span', { class: 'mailbox-secondary-text' }, row.message)
  ]);
}

function renderLogOperator(row: Api.SystemLog.SystemLogRecord) {
  return row.userName || row.userId || '-';
}

function renderOperationSummaryStatus(row: OperationLogSummaryRow) {
  return h('div', { class: 'mailbox-stack-cell' }, [
    h('span', { class: 'mailbox-primary-text' }, row.categoryLabel),
    h(
      NTag,
      {
        bordered: false,
        size: 'small',
        type: row.tagType
      },
      { default: () => row.statusLabel }
    )
  ]);
}

function renderOperationSummaryText(row: OperationLogSummaryRow) {
  return h('div', { class: 'mailbox-stack-cell' }, [
    h('span', { class: 'mailbox-primary-text' }, row.summary),
    h('span', { class: 'mailbox-secondary-text' }, row.action)
  ]);
}

const queueColumns = computed<DataTableColumns<OperationQueueRow>>(() => [
  {
    key: 'target',
    title: '客户 / 联系人',
    minWidth: 220,
    render: row => renderQueueTarget(row)
  },
  {
    key: 'mailbox',
    title: '发送邮箱',
    minWidth: 160,
    render: row => row.mailboxLabel
  },
  {
    key: 'stepIndex',
    title: '步骤',
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
        {
          bordered: false,
          size: 'small',
          type: operationMessageStatusTagTypeMap[row.status]
        },
        { default: () => operationMessageStatusLabelMap[row.status] }
      )
  },
  {
    key: 'job',
    title: '队列 Job',
    minWidth: 160,
    render: row => renderJob(row)
  },
  {
    key: 'time',
    title: '计划 / 发送',
    minWidth: 190,
    render: row => renderQueueTime(row)
  },
  {
    key: 'updatedAt',
    title: '更新时间',
    minWidth: 170,
    render: row => formatOperationDate(row.updatedAt)
  },
  {
    key: 'actions',
    title: '操作',
    width: 90,
    fixed: 'right',
    render: row =>
      h(
        NButton,
        {
          size: 'tiny',
          text: true,
          type: 'primary',
          onClick: () => openQueueDetail(row)
        },
        { default: () => '详情' }
      )
  }
]);

const aiDraftTaskColumns = computed<DataTableColumns<Api.Crm.AiDraftTaskRecord>>(() => [
  {
    key: 'status',
    title: '状态',
    minWidth: 130,
    render: row => renderAiDraftTaskStatus(row)
  },
  {
    key: 'progress',
    title: '进度 / 结果',
    minWidth: 220,
    render: row => renderAiDraftTaskProgress(row)
  },
  {
    key: 'retryingCount',
    title: '待重试',
    width: 90,
    render: row => row.retryingCount
  },
  {
    key: 'failureReason',
    title: '失败原因',
    minWidth: 180,
    ellipsis: { tooltip: true },
    render: row => row.failureReason || '-'
  },
  {
    key: 'bullJobId',
    title: '队列 Job',
    minWidth: 160,
    ellipsis: { tooltip: true },
    render: row => row.bullJobId || '-'
  },
  {
    key: 'updatedAt',
    title: '更新时间',
    minWidth: 170,
    render: row => formatOperationDate(row.updatedAt)
  },
  {
    key: 'actions',
    title: '操作',
    width: 90,
    fixed: 'right',
    render: row =>
      h(
        NButton,
        {
          size: 'tiny',
          text: true,
          type: 'primary',
          onClick: () => openAiDraftTaskDetail(row)
        },
        { default: () => '详情' }
      )
  }
]);

const operationSummaryColumns = computed<DataTableColumns<OperationLogSummaryRow>>(() => [
  {
    key: 'category',
    title: '类型',
    width: 120,
    render: row => renderOperationSummaryStatus(row)
  },
  {
    key: 'summary',
    title: '日志摘要',
    minWidth: 240,
    render: row => renderOperationSummaryText(row)
  },
  {
    key: 'failureReason',
    title: '失败原因',
    minWidth: 180,
    render: row => row.failureReason
  },
  {
    key: 'maskedEmail',
    title: '脱敏邮箱',
    minWidth: 150,
    render: row => row.maskedEmail
  },
  {
    key: 'jobId',
    title: 'jobId',
    minWidth: 160,
    render: row => row.jobId
  },
  {
    key: 'time',
    title: '时间',
    minWidth: 170,
    render: row => row.time
  },
  {
    key: 'count',
    title: '条数',
    width: 80,
    render: row => row.count
  }
]);

const syncColumns = computed<DataTableColumns<Api.Crm.MailboxRecord>>(() => [
  {
    key: 'email',
    title: '邮箱',
    minWidth: 220,
    render: row =>
      h('div', { class: 'mailbox-stack-cell' }, [
        h('span', { class: 'mailbox-primary-text' }, row.maskedEmail),
        h('span', { class: 'mailbox-secondary-text' }, row.ownerUserName || row.ownerUserId)
      ])
  },
  {
    key: 'status',
    title: '授权',
    width: 110,
    render: row => renderMailboxStatus(row)
  },
  {
    key: 'watchExpiration',
    title: 'Gmail watch',
    minWidth: 190,
    render: row => renderWatchStatus(row)
  },
  {
    key: 'syncMode',
    title: '闭环模式',
    minWidth: 190,
    render: row => renderSyncMode(row)
  },
  {
    key: 'lastHistoryId',
    title: '同步检查点',
    minWidth: 150,
    render: row => renderSyncCheckpoint(row)
  },
  {
    key: 'updatedAt',
    title: '更新时间',
    minWidth: 170,
    render: row => formatMailboxDate(row.updatedAt)
  },
  {
    key: 'actions',
    title: '操作',
    width: 90,
    fixed: 'right',
    render: row =>
      h(
        NButton,
        {
          size: 'tiny',
          text: true,
          type: 'primary',
          onClick: () => openMailboxDetail(row)
        },
        { default: () => '详情' }
      )
  }
]);

const logColumns = computed<DataTableColumns<Api.SystemLog.SystemLogRecord>>(() => [
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
          type: operationLogLevelTagTypeMap[row.level]
        },
        { default: () => operationLogLevelLabelMap[row.level] }
      )
  },
  {
    key: 'status',
    title: '状态',
    width: 100,
    render: row =>
      h(
        NTag,
        {
          bordered: false,
          size: 'small',
          type: operationLogStatusTagTypeMap[row.status]
        },
        { default: () => operationLogStatusLabelMap[row.status] }
      )
  },
  {
    key: 'action',
    title: '动作 / 摘要',
    minWidth: 240,
    render: row => renderLogAction(row)
  },
  {
    key: 'operator',
    title: '操作人',
    minWidth: 120,
    render: row => renderLogOperator(row)
  },
  {
    key: 'createdAt',
    title: '时间',
    minWidth: 170,
    render: row => formatOperationDate(row.createdAt)
  },
  {
    key: 'actions',
    title: '操作',
    width: 90,
    fixed: 'right',
    render: row =>
      h(
        NButton,
        {
          size: 'tiny',
          text: true,
          type: 'primary',
          onClick: () => openLogDetail(row)
        },
        { default: () => '详情' }
      )
  }
]);
</script>

<template>
  <NCard :bordered="false" size="small" class="card-wrapper" title="运维概览">
    <template #header-extra>
      <NSpace :size="8">
        <NButton
          v-if="canManageOperations"
          size="small"
          type="warning"
          secondary
          :loading="sendQueueReconciling"
          :disabled="loading || sendQueueReconciling"
          @click="handleReconcileSendQueue"
        >
          发送队列修复
        </NButton>
        <NButton size="small" :loading="loading" @click="loadOperations">刷新</NButton>
      </NSpace>
    </template>

    <NSpace vertical :size="12">
      <NAlert v-if="sendQueueReconcileResult" type="info" :bordered="false">
        发送队列修复结果：扫描 {{ sendQueueReconcileResult.scannedCount }} 条，修复
        {{ sendQueueReconcileResult.repairedCount }} 条，跳过 {{ sendQueueReconcileResult.skippedCount }} 条。
      </NAlert>

      <NGrid responsive="screen" :x-gap="12" :y-gap="12" cols="2 s:2 m:6">
        <NGi>
          <NStatistic label="待关注消息" :value="queueRows.length" />
        </NGi>
        <NGi>
          <NStatistic label="AI 活跃任务" :value="activeAiDraftTaskCount" />
        </NGi>
        <NGi>
          <NStatistic label="邮箱总数" :value="mailboxHealth.total" />
        </NGi>
        <NGi>
          <NStatistic label="授权过期" :value="mailboxHealth.authExpired" />
        </NGi>
        <NGi>
          <NStatistic label="Watch 待处理" :value="mailboxHealth.watchNeedsAttention" />
        </NGi>
        <NGi>
          <NStatistic label="同步需处理" :value="mailboxHealth.syncIssues" />
        </NGi>
      </NGrid>

      <NSpace vertical :size="8">
        <NText strong>Webhook / History / Watch / Send 摘要</NText>
        <NDataTable
          size="small"
          :columns="operationSummaryColumns"
          :data="operationSummaryRows"
          :loading="loading"
          :pagination="false"
          :row-key="row => row.category"
          scroll-x="1100"
        />
      </NSpace>

      <NGrid responsive="screen" :x-gap="12" :y-gap="12" cols="1 l:2">
        <NGi>
          <NSpace vertical :size="8">
            <NText strong>发送队列</NText>
            <NDataTable
              size="small"
              :columns="queueColumns"
              :data="queueRows"
              :loading="loading"
              :pagination="false"
              :row-key="row => row.id"
              scroll-x="1180"
            />
          </NSpace>
        </NGi>

        <NGi>
          <NSpace vertical :size="8">
            <NText strong>AI 草稿任务</NText>
            <NDataTable
              size="small"
              :columns="aiDraftTaskColumns"
              :data="aiDraftTasks"
              :loading="loading"
              :pagination="false"
              :row-key="row => row.id"
              scroll-x="1040"
            />
          </NSpace>
        </NGi>
      </NGrid>

      <NGrid responsive="screen" :x-gap="12" :y-gap="12" cols="1 l:2">
        <NGi>
          <NSpace vertical :size="8">
            <NText strong>同步 / 续订</NText>
            <NDataTable
              size="small"
              :columns="syncColumns"
              :data="mailboxes"
              :loading="loading"
              :pagination="false"
              :row-key="row => row.id"
              scroll-x="1120"
            />
          </NSpace>
        </NGi>
      </NGrid>

      <NSpace v-if="canManageOperations" vertical :size="8">
        <NText strong>最近 CRM 日志</NText>
        <NDataTable
          size="small"
          :columns="logColumns"
          :data="logRows"
          :loading="loading"
          :pagination="false"
          :row-key="row => row.id"
          scroll-x="810"
        />
      </NSpace>
    </NSpace>

    <NDrawer v-model:show="detailVisible" :width="420" placement="right">
      <NDrawerContent :title="detailTitle" closable>
        <NDescriptions :column="1" bordered size="small" label-placement="left">
          <NDescriptionsItem v-for="item in detailItems" :key="item.label" :label="item.label">
            <span class="operation-detail-value">{{ item.value }}</span>
          </NDescriptionsItem>
        </NDescriptions>
      </NDrawerContent>
    </NDrawer>
  </NCard>
</template>

<style scoped>
.operation-detail-value {
  word-break: break-word;
}
</style>
