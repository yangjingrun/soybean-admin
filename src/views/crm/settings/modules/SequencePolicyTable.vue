<script setup lang="ts">
import { computed, h } from 'vue';
import { NButton, NPopconfirm, NSpace, NTag } from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import {
  emailTemplateThreadModeLabelMap,
  formatProductLineDate,
  sequencePolicyLinkPolicyLabelMap,
  sequencePolicySameCompanyStrategyLabelMap,
  sequencePolicyStatusLabelMap,
  sequencePolicyStatusTagTypeMap
} from './shared';

const props = defineProps<{
  loading?: boolean;
  operatingPolicyId?: string | null;
  page: number;
  pageSize: number;
  records: Api.Crm.SequencePolicyRecord[];
  total: number;
}>();

const emit = defineEmits<{
  archive: [record: Api.Crm.SequencePolicyRecord];
  edit: [record: Api.Crm.SequencePolicyRecord];
  setDefault: [record: Api.Crm.SequencePolicyRecord];
  updatePage: [page: number];
  updatePageSize: [pageSize: number];
}>();

function renderPolicyName(row: Api.Crm.SequencePolicyRecord) {
  return h('div', { class: 'sequence-policy-stack-cell' }, [
    h('span', { class: 'sequence-policy-primary-text' }, row.name),
    h('span', { class: 'sequence-policy-secondary-text' }, row.description || '-')
  ]);
}

function renderStepSummary(row: Api.Crm.SequencePolicyRecord) {
  const delays = row.steps
    .toSorted((left, right) => left.stepIndex - right.stepIndex)
    .map(step => `${step.stepIndex}:${step.delayDays}天`)
    .join(' / ');
  const sameThreadCount = row.steps.filter(step => step.threadMode === 'same_thread').length;

  return h('div', { class: 'sequence-policy-stack-cell' }, [
    h('span', { class: 'sequence-policy-primary-text' }, delays),
    h('span', { class: 'sequence-policy-secondary-text' }, `${sameThreadCount} 封同线程`)
  ]);
}

const columns = computed<DataTableColumns<Api.Crm.SequencePolicyRecord>>(() => [
  {
    key: 'name',
    title: '策略',
    minWidth: 240,
    render: row => renderPolicyName(row)
  },
  {
    key: 'steps',
    title: '发送节奏',
    minWidth: 250,
    render: row => renderStepSummary(row)
  },
  {
    key: 'rules',
    title: '规则',
    minWidth: 260,
    render: row =>
      h('div', { class: 'sequence-policy-stack-cell' }, [
        h('span', { class: 'sequence-policy-primary-text' }, sequencePolicyLinkPolicyLabelMap[row.linkPolicy]),
        h('span', { class: 'sequence-policy-secondary-text' }, sequencePolicySameCompanyStrategyLabelMap[row.sameCompanyContactStrategy])
      ])
  },
  {
    key: 'status',
    title: '状态',
    width: 150,
    render: row =>
      h(
        NSpace,
        { size: 6, align: 'center' },
        {
          default: () => [
            h(
              NTag,
              {
                bordered: false,
                size: 'small',
                type: sequencePolicyStatusTagTypeMap[row.status]
              },
              { default: () => sequencePolicyStatusLabelMap[row.status] }
            ),
            row.isDefault ? h(NTag, { bordered: false, size: 'small', type: 'info' }, { default: () => '默认' }) : null
          ]
        }
      )
  },
  {
    key: 'threadMode',
    title: '首封方式',
    width: 110,
    render: row => emailTemplateThreadModeLabelMap[row.steps[0]?.threadMode ?? 'new_subject']
  },
  {
    key: 'updatedAt',
    title: '更新时间',
    minWidth: 180,
    render: row => formatProductLineDate(row.updatedAt)
  },
  {
    key: 'operate',
    title: '操作',
    width: 220,
    fixed: 'right',
    render: row =>
      h(
        NSpace,
        {
          size: 10,
          justify: 'center'
        },
        {
          default: () => [
            h(
              NButton,
              {
                size: 'small',
                text: true,
                type: 'primary',
                onClick: () => emit('edit', row)
              },
              { default: () => '编辑' }
            ),
            h(
              NButton,
              {
                disabled: row.status !== 'active' || row.isDefault,
                loading: props.operatingPolicyId === row.id,
                size: 'small',
                text: true,
                type: 'info',
                onClick: () => emit('setDefault', row)
              },
              { default: () => '设默认' }
            ),
            h(
              NPopconfirm,
              {
                disabled: row.status === 'archived',
                onPositiveClick: () => emit('archive', row)
              },
              {
                default: () => `确认归档“${row.name}”？`,
                trigger: () =>
                  h(
                    NButton,
                    {
                      disabled: row.status === 'archived',
                      loading: props.operatingPolicyId === row.id,
                      size: 'small',
                      text: true,
                      type: 'warning'
                    },
                    { default: () => '归档' }
                  )
              }
            )
          ]
        }
      )
  }
]);
</script>

<template>
  <NSpace vertical :size="12">
    <NDataTable
      :columns="columns"
      :data="records"
      :loading="loading"
      :row-key="row => row.id"
      :scroll-x="1370"
      size="small"
      remote
    >
      <template #empty>
        <NEmpty description="暂无序列策略" />
      </template>
    </NDataTable>

    <div class="table-pagination">
      <NPagination
        :page="page"
        :page-size="pageSize"
        :item-count="total"
        :page-sizes="[10, 20, 50, 100]"
        show-size-picker
        @update:page="emit('updatePage', $event)"
        @update:page-size="emit('updatePageSize', $event)"
      />
    </div>
  </NSpace>
</template>

<style scoped>
.sequence-policy-stack-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  line-height: 1.35;
}

.sequence-policy-primary-text {
  color: var(--n-text-color);
  font-weight: 500;
}

.sequence-policy-secondary-text {
  color: var(--n-text-color-3);
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.table-pagination {
  display: flex;
  justify-content: flex-end;
}
</style>
