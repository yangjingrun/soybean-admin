<script setup lang="ts">
import { useAppStore } from '@/store/modules/app';
import WorkbenchHeader from './modules/WorkbenchHeader.vue';
import WorkbenchMetricCards from './modules/WorkbenchMetricCards.vue';
import WorkbenchTodoList from './modules/WorkbenchTodoList.vue';
import WorkbenchTrendChart from './modules/WorkbenchTrendChart.vue';
import RunningTaskList from './modules/RunningTaskList.vue';
import { useHomeWorkbench } from './modules/useHomeWorkbench';

const appStore = useAppStore();

const {
  overview,
  loading,
  refreshing,
  errorMessage,
  recommendation,
  metricCards,
  todoItems,
  trendOption,
  lastUpdatedText,
  refreshOverview,
  handleNavigate
} = useHomeWorkbench();
</script>

<template>
  <NSpace vertical :size="16" class="home-workbench">
    <WorkbenchHeader
      :recommendation="recommendation"
      :loading="loading"
      :refreshing="refreshing"
      :last-updated-text="lastUpdatedText"
      @navigate="handleNavigate"
      @refresh="refreshOverview"
    />

    <NAlert v-if="errorMessage" type="error" :show-icon="true">
      {{ errorMessage }}
    </NAlert>

    <WorkbenchMetricCards :cards="metricCards" :loading="loading" @navigate="handleNavigate" />

    <NGrid :x-gap="appStore.isMobile ? 0 : 16" :y-gap="16" responsive="screen" item-responsive>
      <NGi span="24 s:24 m:14">
        <WorkbenchTrendChart :option="trendOption" :loading="loading" />
      </NGi>
      <NGi span="24 s:24 m:10">
        <RunningTaskList :tasks="overview?.runningTasks ?? []" @navigate="handleNavigate" />
      </NGi>
    </NGrid>

    <WorkbenchTodoList :items="todoItems" :loading="loading" @navigate="handleNavigate" />
  </NSpace>
</template>

<style scoped>
.home-workbench {
  color: #0f172a;
}
</style>
