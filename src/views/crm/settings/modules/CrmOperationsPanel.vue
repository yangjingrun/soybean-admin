<script setup lang="ts">
import { computed, h } from 'vue';
import { NTag } from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import {
  formatMailboxDate,
  formatMailboxHistoryId,
  formatMailboxWatchDescription,
  formatOperationDate,
  getMailboxWatchStatus,
  mailboxStatusLabelMap,
  mailboxStatusTagTypeMap,
  mailboxWatchStatusLabelMap,
  mailboxWatchStatusTagTypeMap,
  operationMessageStatusLabelMap,
  operationMessageStatusTagTypeMap,
  type OperationQueueRow
} from './shared';
import { useCrmOperationsPanel } from './useCrmOperationsPanel';

const { loadOperations, loading, mailboxHealth, mailboxes, queueRows } = useCrmOperationsPanel();

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
    key: 'lastHistoryId',
    title: '同步检查点',
    minWidth: 150,
    render: row => formatMailboxHistoryId(row.lastHistoryId)
  },
  {
    key: 'updatedAt',
    title: '更新时间',
    minWidth: 170,
    render: row => formatMailboxDate(row.updatedAt)
  }
]);
</script>

<template>
  <NCard :bordered="false" size="small" class="card-wrapper" title="运维概览">
    <template #header-extra>
      <NButton size="small" :loading="loading" @click="loadOperations">刷新</NButton>
    </template>

    <NSpace vertical :size="12">
      <NGrid responsive="screen" :x-gap="12" :y-gap="12" cols="2 s:2 m:4">
        <NGi>
          <NStatistic label="待关注消息" :value="queueRows.length" />
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
      </NGrid>

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
              scroll-x="1090"
            />
          </NSpace>
        </NGi>

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
              scroll-x="840"
            />
          </NSpace>
        </NGi>
      </NGrid>
    </NSpace>
  </NCard>
</template>
