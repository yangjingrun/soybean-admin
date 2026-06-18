<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  records: Api.Crm.LeadRecord[];
  total: number;
}>();

const pageCount = computed(() => props.records.length);
const pendingCount = computed(
  () =>
    props.records.filter(record =>
      ['candidate', 'missing_contact', 'email_verification_pending', 'manual_review_pending'].includes(record.status)
    ).length
);
const readyCount = computed(() => props.records.filter(record => record.status === 'ready').length);
const opportunityCount = computed(
  () => props.records.filter(record => ['opportunity', 'customer'].includes(record.status)).length
);
</script>

<template>
  <NGrid responsive="screen" :x-gap="12" :y-gap="12" cols="1 s:2 m:4">
    <NGi>
      <NCard :bordered="false" size="small" class="card-wrapper">
        <NStatistic label="匹配线索" :value="total" />
      </NCard>
    </NGi>
    <NGi>
      <NCard :bordered="false" size="small" class="card-wrapper">
        <NStatistic label="当前页" :value="pageCount" />
      </NCard>
    </NGi>
    <NGi>
      <NCard :bordered="false" size="small" class="card-wrapper">
        <NStatistic label="本页待处理" :value="pendingCount" />
      </NCard>
    </NGi>
    <NGi>
      <NCard :bordered="false" size="small" class="card-wrapper">
        <NStatistic label="本页可转化" :value="readyCount + opportunityCount" />
      </NCard>
    </NGi>
  </NGrid>
</template>
