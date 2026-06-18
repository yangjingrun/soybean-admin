<script setup lang="ts">
import type { DataTableColumns } from 'naive-ui';

interface InboxMessageRow {
  id: string;
  sender: string;
  subject: string;
  relatedLead: string;
  status: string;
  receivedAt: string;
}

const messageColumns: DataTableColumns<InboxMessageRow> = [
  {
    key: 'sender',
    title: '发件人',
    minWidth: 180
  },
  {
    key: 'subject',
    title: '主题',
    minWidth: 240,
    ellipsis: {
      tooltip: true
    }
  },
  {
    key: 'relatedLead',
    title: '关联线索',
    minWidth: 160
  },
  {
    key: 'status',
    title: '处理状态',
    width: 120
  },
  {
    key: 'receivedAt',
    title: '接收时间',
    width: 180
  }
];

const messageRows: InboxMessageRow[] = [];

/** Use message id as the row identity once mailbox sync is available. */
function getMessageRowKey(row: InboxMessageRow) {
  return row.id;
}
</script>

<template>
  <NSpace vertical :size="16">
    <NPageHeader title="收件箱" subtitle="统一查看客户回复，并关联到线索跟进记录">
      <template #extra>
        <NTag type="info" :bordered="false">占位版</NTag>
      </template>
    </NPageHeader>

    <NGrid responsive="screen" :x-gap="12" :y-gap="12" cols="1 s:3">
      <NGi>
        <NCard :bordered="false" size="small" class="card-wrapper">
          <NStatistic label="未读回复" value="0" />
        </NCard>
      </NGi>
      <NGi>
        <NCard :bordered="false" size="small" class="card-wrapper">
          <NStatistic label="待处理" value="0" />
        </NCard>
      </NGi>
      <NGi>
        <NCard :bordered="false" size="small" class="card-wrapper">
          <NStatistic label="已归档" value="0" />
        </NCard>
      </NGi>
    </NGrid>

    <NCard :bordered="false" size="small" class="card-wrapper" title="邮件回复">
      <NDataTable
        :columns="messageColumns"
        :data="messageRows"
        :row-key="getMessageRowKey"
        size="small"
        :scroll-x="900"
      >
        <template #empty>
          <NEmpty description="暂无客户回复" />
        </template>
      </NDataTable>
    </NCard>
  </NSpace>
</template>
