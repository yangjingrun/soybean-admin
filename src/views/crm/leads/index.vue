<script setup lang="ts">
import type { DataTableColumns } from 'naive-ui';

interface LeadRow {
  id: string;
  companyName: string;
  contactName: string;
  source: string;
  status: string;
  updatedAt: string;
}

const leadColumns: DataTableColumns<LeadRow> = [
  {
    key: 'companyName',
    title: '公司名称',
    minWidth: 180
  },
  {
    key: 'contactName',
    title: '联系人',
    width: 140
  },
  {
    key: 'source',
    title: '线索来源',
    width: 140
  },
  {
    key: 'status',
    title: '跟进状态',
    width: 120
  },
  {
    key: 'updatedAt',
    title: '更新时间',
    width: 180
  }
];

const leadRows: LeadRow[] = [];

/** Use a stable id once backend records are connected. */
function getLeadRowKey(row: LeadRow) {
  return row.id;
}
</script>

<template>
  <NSpace vertical :size="16">
    <NPageHeader title="线索库" subtitle="集中管理 AI 获客和手动录入的潜在线索">
      <template #extra>
        <NTag type="info" :bordered="false">占位版</NTag>
      </template>
    </NPageHeader>

    <NGrid responsive="screen" :x-gap="12" :y-gap="12" cols="1 s:2 m:4">
      <NGi>
        <NCard :bordered="false" size="small" class="card-wrapper">
          <NStatistic label="全部线索" value="0" />
        </NCard>
      </NGi>
      <NGi>
        <NCard :bordered="false" size="small" class="card-wrapper">
          <NStatistic label="待跟进" value="0" />
        </NCard>
      </NGi>
      <NGi>
        <NCard :bordered="false" size="small" class="card-wrapper">
          <NStatistic label="已联系" value="0" />
        </NCard>
      </NGi>
      <NGi>
        <NCard :bordered="false" size="small" class="card-wrapper">
          <NStatistic label="已转化" value="0" />
        </NCard>
      </NGi>
    </NGrid>

    <NCard :bordered="false" size="small" class="card-wrapper" title="线索列表">
      <NDataTable :columns="leadColumns" :data="leadRows" :row-key="getLeadRowKey" size="small" :scroll-x="760">
        <template #empty>
          <NEmpty description="暂无线索，后续将接入 CRM 线索接口" />
        </template>
      </NDataTable>
    </NCard>
  </NSpace>
</template>
