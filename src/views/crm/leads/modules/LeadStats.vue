<script setup lang="ts">
import { computed } from 'vue';
import { buildLeadQueueStats } from './shared';

const props = defineProps<{
  records: Api.Crm.LeadRecord[];
  total: number;
}>();

const stats = computed(() => buildLeadQueueStats(props.records, props.total));
</script>

<template>
  <NGrid responsive="screen" :x-gap="12" :y-gap="12" cols="1 s:2 m:4">
    <NGi v-for="stat in stats" :key="stat.key">
      <NCard :bordered="false" size="small" class="card-wrapper lead-stat-card">
        <NStatistic :label="stat.label" :value="stat.value" />
      </NCard>
    </NGi>
  </NGrid>
</template>

<style scoped>
.lead-stat-card :deep(.n-card__content) {
  padding: 12px 16px;
}

.lead-stat-card :deep(.n-statistic .n-statistic__label) {
  font-size: 13px;
  line-height: 18px;
}

.lead-stat-card :deep(.n-statistic .n-statistic-value) {
  margin-top: 8px;
  font-size: 26px;
  line-height: 30px;
}
</style>
