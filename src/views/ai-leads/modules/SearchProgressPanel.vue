<script setup lang="ts">
import { computed, h } from 'vue';
import { NProgress, NTag } from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import { getMetricDisplayText } from './search-progress';
import type { LeadSearchProgressState } from './search-progress';

const props = defineProps<{
  state: LeadSearchProgressState;
  loading?: boolean;
}>();

const statusTextMap: Record<LeadSearchProgressState['status'], string> = {
  idle: '等待开始',
  running: '采集中',
  completed: '已完成',
  failed: '失败'
};

const statusTypeMap: Record<LeadSearchProgressState['status'], 'default' | 'info' | 'success' | 'error'> = {
  idle: 'default',
  running: 'info',
  completed: 'success',
  failed: 'error'
};

const headline = computed(() => props.state.currentTitle || '正在采集潜在客户');
const description = computed(() => props.state.currentDescription || '系统正在整理采集方向并寻找匹配线索。');
const progressPercent = computed(() => Math.round(props.state.progressPercent ?? (props.loading ? 6 : 0)));
const progressStatus = computed(() => {
  if (props.state.status === 'completed') {
    return 'success';
  }

  if (props.state.status === 'failed') {
    return 'error';
  }

  return undefined;
});
const summaryItems = computed(() => {
  const summary = props.state.result?.summary;

  if (!summary) {
    return [];
  }

  return [
    { label: '采集动作', value: summary.actionCount },
    { label: '质量判断', value: summary.qualityCheckCount },
    { label: '候选线索', value: summary.candidateCount },
    { label: '完成原因', value: summary.stopReason }
  ];
});
const candidateRows = computed(() => props.state.result?.candidates ?? []);
const candidateColumns: DataTableColumns<Api.AiLeads.LeadSearchCandidateView> = [
  {
    title: '线索名称',
    key: 'title',
    minWidth: 180,
    ellipsis: { tooltip: true },
    render: row => row.title || '-'
  },
  {
    title: '网站',
    key: 'website',
    minWidth: 220,
    ellipsis: { tooltip: true },
    render: row =>
      row.website
        ? h(
            'a',
            {
              class: 'candidate-link',
              href: row.website,
              rel: 'noopener noreferrer',
              target: '_blank'
            },
            row.website
          )
        : '-'
  },
  {
    title: '线索信息',
    key: 'snippet',
    minWidth: 260,
    ellipsis: { tooltip: true },
    render: row => row.snippet || '-'
  },
  {
    title: '地区',
    key: 'address',
    minWidth: 180,
    ellipsis: { tooltip: true },
    render: row => row.address || '-'
  },
  {
    title: '电话',
    key: 'phoneNumber',
    width: 150,
    ellipsis: { tooltip: true },
    render: row => row.phoneNumber || '-'
  },
  {
    title: '来源',
    key: 'sourceLabel',
    width: 130,
    render: row =>
      h(
        NTag,
        {
          size: 'small',
          bordered: false,
          type: row.sourceLabel.includes('本地') ? 'success' : 'info'
        },
        { default: () => row.sourceLabel }
      )
  }
];

function getStepIndex(index: number) {
  return String(index + 1).padStart(2, '0');
}
</script>

<template>
  <NSpace vertical :size="14" class="search-progress-panel">
    <section class="workflow-panel" :class="`is-${state.status}`">
      <div class="workflow-header">
        <div class="workflow-copy">
          <div class="workflow-title-row">
            <span class="workflow-status-dot" />
            <NText strong class="workflow-title">{{ headline }}</NText>
            <NTag size="small" :type="statusTypeMap[state.status]" :bordered="false">
              {{ statusTextMap[state.status] }}
            </NTag>
          </div>
          <NText depth="3" class="workflow-description">{{ description }}</NText>
        </div>
        <NSpace v-if="state.metrics.length" :size="6" class="workflow-metrics">
          <NTag v-for="metric in state.metrics" :key="metric.key" size="small" :bordered="false">
            {{ getMetricDisplayText(metric) }}
          </NTag>
        </NSpace>
      </div>

      <NProgress
        type="line"
        :percentage="progressPercent"
        :processing="loading && state.status === 'running'"
        :status="progressStatus"
        :height="8"
        :border-radius="4"
      />
    </section>

    <NAlert v-if="state.errorMessage" type="error" :bordered="false">
      {{ state.errorMessage }}
    </NAlert>

    <section v-if="state.steps.length" class="progress-steps">
      <div
        v-for="(step, index) in state.steps"
        :key="step.key"
        class="progress-step"
        :class="`is-${step.status}`"
      >
        <div class="step-marker">{{ getStepIndex(index) }}</div>
        <div class="step-body">
          <div class="step-title-row">
            <NText strong>{{ step.title }}</NText>
            <NTag
              size="small"
              :type="step.status === 'failed' ? 'error' : step.status === 'completed' ? 'success' : 'info'"
              :bordered="false"
            >
              {{ step.status === 'completed' ? '已完成' : step.status === 'failed' ? '失败' : '进行中' }}
            </NTag>
          </div>
          <NText v-if="step.description" depth="3" class="step-description">{{ step.description }}</NText>
        </div>
      </div>
    </section>

    <section v-if="summaryItems.length" class="result-summary">
      <NGrid :x-gap="10" :y-gap="10" responsive="screen" item-responsive>
        <NGi v-for="item in summaryItems" :key="item.label" span="24 m:12 l:6">
          <div class="summary-item">
            <NText depth="3" class="summary-label">{{ item.label }}</NText>
            <NText strong class="summary-value">{{ item.value }}</NText>
          </div>
        </NGi>
      </NGrid>
    </section>

    <NAlert v-if="state.result?.warnings?.length" type="warning" :bordered="false">
      {{ state.result.warnings.join('；') }}
    </NAlert>

    <section v-if="state.result" class="candidate-section">
      <div class="section-title">候选客户</div>
      <NDataTable
        v-if="candidateRows.length"
        size="small"
        :columns="candidateColumns"
        :data="candidateRows"
        :bordered="false"
        :pagination="{ pageSize: 8 }"
      />
      <NEmpty v-else description="暂未采集到候选客户" />
    </section>
  </NSpace>
</template>

<style scoped>
.search-progress-panel {
  min-width: 0;
  --progress-primary: #5b75ff;
  --progress-success: #18a058;
  --progress-warning: #f0a020;
  --progress-danger: #d03050;
  --progress-border: #e4ebf7;
  --progress-surface: #fbfcff;
}

.workflow-panel,
.progress-steps,
.result-summary,
.candidate-section {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--progress-border);
  border-radius: 8px;
  background: var(--progress-surface);
}

.workflow-panel {
  background: linear-gradient(180deg, #ffffff 0%, #f7faff 100%);
}

.workflow-panel.is-completed {
  border-color: #c9ecd6;
  background: linear-gradient(180deg, #ffffff 0%, #f3fbf6 100%);
}

.workflow-panel.is-failed {
  border-color: #f2c9d1;
  background: linear-gradient(180deg, #ffffff 0%, #fff6f8 100%);
}

.workflow-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.workflow-copy {
  min-width: 0;
}

.workflow-title-row,
.step-title-row {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.workflow-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--progress-primary);
  box-shadow: 0 0 0 4px rgb(91 117 255 / 12%);
}

.is-completed .workflow-status-dot {
  background: var(--progress-success);
  box-shadow: 0 0 0 4px rgb(24 160 88 / 12%);
}

.is-failed .workflow-status-dot {
  background: var(--progress-danger);
  box-shadow: 0 0 0 4px rgb(208 48 80 / 12%);
}

.workflow-title {
  font-size: 15px;
}

.workflow-description,
.step-description {
  display: block;
  margin-top: 6px;
  line-height: 1.6;
}

.workflow-metrics {
  flex-shrink: 0;
  justify-content: flex-end;
}

.progress-steps {
  gap: 0;
  padding: 0;
  overflow: hidden;
}

.progress-step {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr);
  gap: 10px;
  padding: 12px;
  border-bottom: 1px solid #eef2f8;
}

.progress-step:last-child {
  border-bottom: 0;
}

.step-marker {
  display: inline-flex;
  width: 30px;
  height: 30px;
  align-items: center;
  justify-content: center;
  border: 1px solid #d5def0;
  border-radius: 999px;
  color: #5b6680;
  font-size: 12px;
  font-weight: 700;
  background: #ffffff;
}

.progress-step.is-active .step-marker {
  border-color: var(--progress-primary);
  color: var(--progress-primary);
  background: #f2f5ff;
}

.progress-step.is-completed .step-marker {
  border-color: #b8e4c7;
  color: var(--progress-success);
  background: #f1fbf4;
}

.progress-step.is-failed .step-marker {
  border-color: #f0b8c4;
  color: var(--progress-danger);
  background: #fff3f6;
}

.step-body {
  min-width: 0;
}

.summary-item {
  display: flex;
  min-height: 70px;
  flex-direction: column;
  justify-content: center;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid #e8eef8;
  border-radius: 8px;
  background: #ffffff;
}

.summary-label {
  font-size: 12px;
}

.summary-value {
  overflow-wrap: anywhere;
  color: #1f2937;
  font-size: 18px;
  line-height: 1.35;
}

.section-title {
  display: inline-flex;
  align-items: center;
  color: #24324b;
  font-weight: 600;
}

.section-title::before {
  width: 3px;
  height: 14px;
  margin-right: 8px;
  border-radius: 999px;
  background: var(--progress-primary);
  content: '';
}

:deep(.candidate-link) {
  color: var(--progress-primary);
  text-decoration: none;
}

:deep(.candidate-link:hover) {
  text-decoration: underline;
}

@media (max-width: 640px) {
  .workflow-header {
    flex-direction: column;
  }

  .workflow-metrics {
    justify-content: flex-start;
  }

  .progress-step {
    grid-template-columns: 34px minmax(0, 1fr);
  }
}
</style>
