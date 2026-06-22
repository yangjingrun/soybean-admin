<script setup lang="ts">
import { computed, h } from 'vue';
import { NProgress, NTag } from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import { getMetricDisplayText } from './search-progress';
import type { LeadSearchProgressState } from './search-progress';
import { buildAiLeadCandidateImportRows, type AiLeadCandidateImportRow } from './shared';

const props = defineProps<{
  state: LeadSearchProgressState;
  loading?: boolean;
  processable?: boolean;
  showSerperDetails?: boolean;
}>();

const emit = defineEmits<{
  processCollectedLeads: [];
}>();

const statusTextMap: Record<LeadSearchProgressState['status'], string> = {
  idle: '等待开始',
  running: '采集中',
  interrupted: '已中断',
  completed: '已完成',
  failed: '失败'
};

const statusTypeMap: Record<LeadSearchProgressState['status'], 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  idle: 'default',
  running: 'info',
  interrupted: 'warning',
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
  ].filter(item => item.value !== undefined && item.value !== null && item.value !== '');
});
const candidateRows = computed(() => buildAiLeadCandidateImportRows(props.state.result?.candidates ?? []));
const showSourceColumn = computed(() => candidateRows.value.some(row => Boolean(row.candidate.sourceLabel?.trim())));
const serperResultRows = computed(() =>
  (props.showSerperDetails ? (props.state.result?.serperResults ?? []) : []).map((item, index) => ({
    key: `${item.endpoint}-${index}`,
    title: getSerperResultTitle(item, index),
    requestCode: formatJson(item.requestBody),
    resultCode: formatJson(item.result)
  }))
);
const candidateColumns = computed<DataTableColumns<AiLeadCandidateImportRow>>(() => {
  const columns: DataTableColumns<AiLeadCandidateImportRow> = [
    {
      title: '线索名称',
      key: 'title',
      minWidth: 180,
      ellipsis: { tooltip: true },
      render: row => row.candidate.title || '-'
    },
    {
      title: '网站',
      key: 'website',
      minWidth: 220,
      ellipsis: { tooltip: true },
      render: row =>
        row.candidate.website
          ? h(
              'a',
              {
                class: 'candidate-link',
                href: row.candidate.website,
                rel: 'noopener noreferrer',
                target: '_blank'
              },
              row.candidate.website
            )
          : '-'
    },
    {
      title: '线索信息',
      key: 'snippet',
      minWidth: 260,
      ellipsis: { tooltip: true },
      render: row => row.candidate.snippet || '-'
    },
    {
      title: '地区',
      key: 'address',
      minWidth: 180,
      ellipsis: { tooltip: true },
      render: row => row.candidate.address || '-'
    },
    {
      title: '电话',
      key: 'phoneNumber',
      width: 150,
      ellipsis: { tooltip: true },
      render: row => row.candidate.phoneNumber || '-'
    },
    {
      title: 'CRM 状态',
      key: 'importState',
      minWidth: 170,
      render: row =>
        h('div', { class: 'candidate-quality-cell' }, [
          h(
            NTag,
            {
              size: 'small',
              bordered: false,
              type: row.importState.canImport ? 'success' : 'warning'
            },
            { default: () => (row.importState.canImport ? '已入库' : '已过滤') }
          ),
          h('span', { class: 'candidate-quality-text' }, getImportStateText(row))
        ])
    }
  ];

  if (showSourceColumn.value) {
    columns.splice(5, 0, {
      title: '来源',
      key: 'sourceLabel',
      width: 130,
      render: row => {
        const sourceLabel = row.candidate.sourceLabel?.trim();

        if (!sourceLabel) {
          return '-';
        }

        return h(
          NTag,
          {
            size: 'small',
            bordered: false,
            type: sourceLabel.includes('本地') ? 'success' : 'info'
          },
          { default: () => sourceLabel }
        );
      }
    });
  }

  return columns;
});

function getStepIndex(index: number) {
  return String(index + 1).padStart(2, '0');
}

/** Formats Serper JSON for direct inspection in the result panel. */
function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

/** Builds a compact title for one Serper response block. */
function getSerperResultTitle(item: Api.AiLeads.LeadSearchSerperResultView, index: number) {
  const q = typeof item.requestBody.q === 'string' ? item.requestBody.q : '';

  return q ? `${getStepIndex(index)} ${item.endpoint} · ${q}` : `${getStepIndex(index)} ${item.endpoint}`;
}

/** Keeps CRM status copy user-facing and hides internal domain details after import. */
function getImportStateText(row: AiLeadCandidateImportRow) {
  if (row.importState.canImport) {
    return '已进入 CRM 客户管理';
  }

  return row.importState.reasons.join('、') || '该线索暂未进入 CRM';
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

    <NAlert v-if="state.status === 'completed'" type="success" :bordered="false" class="crm-next-step-alert">
      <div class="crm-next-step">
        <div class="crm-next-step__copy">
          <NText strong>可用线索已自动进入 CRM</NText>
          <NText depth="3">下一步处理本次客户，补齐联系人、验证邮箱，并从可开发联系人创建开发信。</NText>
        </div>
        <NButton type="primary" size="small" :disabled="!processable" @click="emit('processCollectedLeads')">
          处理本次客户
        </NButton>
      </div>
    </NAlert>

    <section v-if="state.steps.length" class="progress-steps">
      <div v-for="(step, index) in state.steps" :key="step.key" class="progress-step" :class="`is-${step.status}`">
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
        :row-key="row => row.importState.key"
        scroll-x="1220"
      />
      <NEmpty v-else description="暂未采集到候选客户" />
    </section>

    <section v-if="serperResultRows.length" class="serper-section">
      <div class="section-title">Serper 原始返回</div>
      <NCollapse accordion>
        <NCollapseItem v-for="item in serperResultRows" :key="item.key" :title="item.title" :name="item.key">
          <div class="serper-json-grid">
            <div class="serper-json-block">
              <NText depth="3" class="serper-json-title">请求参数</NText>
              <NCode :code="item.requestCode" language="json" word-wrap />
            </div>
            <div class="serper-json-block">
              <NText depth="3" class="serper-json-title">返回内容</NText>
              <NCode :code="item.resultCode" language="json" word-wrap />
            </div>
          </div>
        </NCollapseItem>
      </NCollapse>
    </section>
  </NSpace>
</template>

<style scoped>
.search-progress-panel {
  min-width: 0;
  --progress-primary: rgb(var(--primary-color));
  --progress-primary-soft: rgb(var(--primary-50-color));
  --progress-success: rgb(var(--success-color));
  --progress-warning: rgb(var(--warning-color));
  --progress-danger: rgb(var(--error-color));
  --progress-border: #e4ebf7;
  --progress-surface: #fbfcff;
}

.workflow-panel,
.progress-steps,
.result-summary,
.candidate-section,
.serper-section {
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
  background: #ffffff;
}

.workflow-panel.is-completed {
  border-color: #c9ecd6;
  background: #f8fdf9;
}

.workflow-panel.is-failed {
  border-color: #f2c9d1;
  background: #fff8fa;
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
  background: var(--progress-primary-soft);
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
  color: #24324b;
  font-weight: 600;
}

:deep(.candidate-link) {
  color: var(--progress-primary);
  text-decoration: none;
}

:deep(.candidate-link:hover) {
  text-decoration: underline;
}

:deep(.candidate-quality-cell) {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
  line-height: 1.35;
}

:deep(.candidate-quality-text) {
  color: var(--n-text-color-3);
  font-size: 12px;
}

.crm-next-step {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.crm-next-step__copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
}

.serper-json-grid {
  display: grid;
  grid-template-columns: minmax(0, 0.75fr) minmax(0, 1.25fr);
  gap: 12px;
}

.serper-json-block {
  min-width: 0;
  padding: 10px;
  border: 1px solid #e8eef8;
  border-radius: 8px;
  background: #ffffff;
}

.serper-json-title {
  display: block;
  margin-bottom: 8px;
  font-size: 12px;
}

.serper-section :deep(.n-code) {
  max-height: 420px;
  overflow: auto;
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

  .serper-json-grid {
    grid-template-columns: 1fr;
  }
}
</style>
