<script setup lang="ts">
import { computed, h, onMounted, shallowRef } from 'vue';
import type { DataTableColumns } from 'naive-ui';
import { fetchCrmStrategyStats } from '@/service/api';
import { buildStrategyStatSections, formatOperationDate, type StrategyStatSection } from './shared';

const loading = shallowRef(false);
const stats = shallowRef<Api.Crm.StrategyStats | null>(null);

const sections = computed<StrategyStatSection[]>(() =>
  stats.value
    ? buildStrategyStatSections(stats.value, 5)
    : buildStrategyStatSections({
        generatedAt: '',
        rows: {
          template: [],
          policy: [],
          persona: [],
          productLine: []
        }
      })
);
const generatedAtText = computed(() => (stats.value ? formatOperationDate(stats.value.generatedAt) : '-'));

const columns = computed<DataTableColumns<Api.Crm.StrategyStatRow>>(() => [
  {
    key: 'name',
    title: '名称',
    minWidth: 150,
    ellipsis: { tooltip: true },
    render: row => row.name
  },
  {
    key: 'sequenceCount',
    title: '序列',
    width: 72,
    align: 'right'
  },
  {
    key: 'draftPendingCount',
    title: '待审',
    width: 72,
    align: 'right'
  },
  {
    key: 'readyCount',
    title: '待发送',
    width: 72,
    align: 'right'
  },
  {
    key: 'queuedCount',
    title: '队列',
    width: 78,
    align: 'right'
  },
  {
    key: 'sentCount',
    title: '已发送',
    width: 72,
    align: 'right'
  },
  {
    key: 'failedCount',
    title: '失败',
    width: 78,
    align: 'right'
  },
  {
    key: 'terminal',
    title: '终态',
    width: 100,
    align: 'right',
    render: row => h('span', `${row.repliedCount} / ${row.stoppedCount}`)
  }
]);

/** Refreshes local CRM strategy stats without touching Gmail send state. */
async function loadStats() {
  if (loading.value) return;

  loading.value = true;
  try {
    const { data, error } = await fetchCrmStrategyStats();
    if (!error) {
      stats.value = data;
    }
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void loadStats();
});
</script>

<template>
  <NCard :bordered="false" size="small" class="card-wrapper" title="本地策略效果统计">
    <template #header-extra>
      <NSpace align="center" :size="8">
        <NText depth="3" class="text-12px">更新 {{ generatedAtText }}</NText>
        <NButton size="tiny" :loading="loading" @click="loadStats">刷新</NButton>
      </NSpace>
    </template>

    <NSpin :show="loading">
      <NGrid responsive="screen" :x-gap="12" :y-gap="12" cols="1 s:2">
        <NGi v-for="section in sections" :key="section.key">
          <NSpace vertical :size="8">
            <NText strong>{{ section.title }}</NText>
            <NDataTable
              size="small"
              :bordered="false"
              :single-line="false"
              :columns="columns"
              :data="section.rows"
              :pagination="false"
              :max-height="260"
            >
              <template #empty>
                <NEmpty size="small" description="暂无本地序列数据" />
              </template>
            </NDataTable>
          </NSpace>
        </NGi>
      </NGrid>
    </NSpin>
  </NCard>
</template>
