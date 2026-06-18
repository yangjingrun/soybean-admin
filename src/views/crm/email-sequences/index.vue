<script setup lang="ts">
import type { DataTableColumns } from 'naive-ui';

interface EmailSequenceRow {
  id: string;
  name: string;
  status: string;
  stepCount: number;
  targetGroup: string;
  updatedAt: string;
}

const sequenceColumns: DataTableColumns<EmailSequenceRow> = [
  {
    key: 'name',
    title: '序列名称',
    minWidth: 180
  },
  {
    key: 'status',
    title: '状态',
    width: 120
  },
  {
    key: 'stepCount',
    title: '邮件步骤',
    width: 120
  },
  {
    key: 'targetGroup',
    title: '目标线索',
    minWidth: 160
  },
  {
    key: 'updatedAt',
    title: '更新时间',
    width: 180
  }
];

const sequenceRows: EmailSequenceRow[] = [];

/** Keep table identity stable before email sequence APIs are connected. */
function getSequenceRowKey(row: EmailSequenceRow) {
  return row.id;
}
</script>

<template>
  <NSpace vertical :size="16">
    <NPageHeader title="邮件序列" subtitle="规划多步骤开发信节奏，后续接入发送任务和效果统计">
      <template #extra>
        <NTag type="info" :bordered="false">占位版</NTag>
      </template>
    </NPageHeader>

    <NAlert type="default" :bordered="false">
      当前版本仅展示邮件序列入口，暂不创建发送任务，也不会请求后端接口。
    </NAlert>

    <NCard :bordered="false" size="small" class="card-wrapper" title="序列列表">
      <NDataTable
        :columns="sequenceColumns"
        :data="sequenceRows"
        :row-key="getSequenceRowKey"
        size="small"
        :scroll-x="760"
      >
        <template #empty>
          <NEmpty description="暂无邮件序列" />
        </template>
      </NDataTable>
    </NCard>
  </NSpace>
</template>
