<script setup lang="ts">
import { watch } from 'vue';
import { useEcharts, type ECOption } from '@/hooks/common/echarts';
import type { WorkbenchTrendOption } from './shared';

const props = defineProps<{
  option: WorkbenchTrendOption;
  loading: boolean;
}>();

const { domRef, updateOptions } = useEcharts(() => props.option as unknown as ECOption);

watch(
  () => props.option,
  option => {
    void updateOptions(() => option as unknown as ECOption);
  },
  { deep: true }
);
</script>

<template>
  <section class="trend-panel">
    <div class="trend-panel__header">
      <div>
        <h2>近 7 天发送与回复</h2>
        <p>用于判断今天邮件节奏和客户反馈变化</p>
      </div>
      <NSpin v-if="loading" size="small" />
    </div>
    <div ref="domRef" class="trend-panel__chart"></div>
  </section>
</template>

<style scoped>
.trend-panel {
  min-height: 360px;
  padding: 18px;
  border: 1px solid rgb(226 232 240);
  border-radius: 8px;
  background: #fff;
}

.trend-panel__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.trend-panel h2 {
  margin: 0;
  color: #0f172a;
  font-size: 17px;
  font-weight: 650;
}

.trend-panel p {
  margin: 6px 0 0;
  color: #64748b;
  font-size: 13px;
}

.trend-panel__chart {
  width: 100%;
  height: 278px;
  margin-top: 14px;
}
</style>
