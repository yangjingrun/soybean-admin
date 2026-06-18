<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  pendingTotal: number;
  records: Api.Crm.InboxThreadRecord[];
  total: number;
}>();

const currentPageReplyCount = computed(() => props.records.reduce((sum, record) => sum + record.messageCount, 0));
</script>

<template>
  <NGrid responsive="screen" :x-gap="12" :y-gap="12" cols="1 s:3">
    <NGi>
      <NCard :bordered="false" size="small" class="card-wrapper">
        <NStatistic label="未处理" :value="pendingTotal" />
      </NCard>
    </NGi>
    <NGi>
      <NCard :bordered="false" size="small" class="card-wrapper">
        <NStatistic label="当前筛选" :value="total" />
      </NCard>
    </NGi>
    <NGi>
      <NCard :bordered="false" size="small" class="card-wrapper">
        <NStatistic label="当前页回复数" :value="currentPageReplyCount" />
      </NCard>
    </NGi>
  </NGrid>
</template>
