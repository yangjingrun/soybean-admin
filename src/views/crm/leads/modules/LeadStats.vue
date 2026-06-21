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
      <NCard :bordered="false" size="small" class="card-wrapper">
        <NStatistic :label="stat.label" :value="stat.value" />
      </NCard>
    </NGi>
  </NGrid>
</template>
