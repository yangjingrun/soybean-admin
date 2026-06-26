<script setup lang="ts">
import { computed, h } from 'vue';
import { NButton, NPopconfirm, NSpace, NTag } from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import {
  emailTemplateStatusLabelMap,
  emailTemplateStatusTagTypeMap,
  emailTemplateThreadModeLabelMap,
  formatProductLineDate
} from './shared';

const props = defineProps<{
  canManage?: boolean;
  loading?: boolean;
  operatingTemplateId?: string | null;
  page: number;
  pageSize: number;
  records: Api.Crm.EmailTemplateGroupRecord[];
  total: number;
}>();

const emit = defineEmits<{
  archive: [record: Api.Crm.EmailTemplateGroupRecord];
  edit: [record: Api.Crm.EmailTemplateGroupRecord];
  setDefault: [record: Api.Crm.EmailTemplateGroupRecord];
  updatePage: [page: number];
  updatePageSize: [pageSize: number];
}>();

function renderTemplateName(row: Api.Crm.EmailTemplateGroupRecord) {
  return h('div', { class: 'email-template-stack-cell' }, [
    h('span', { class: 'email-template-primary-text' }, row.name),
    h('span', { class: 'email-template-secondary-text' }, row.description || '-')
  ]);
}

function renderStepSummary(row: Api.Crm.EmailTemplateGroupRecord) {
  const firstStep = row.steps.find(step => step.stepIndex === 1);
  const sameThreadCount = row.steps.filter(step => step.threadMode === 'same_thread').length;

  return h('div', { class: 'email-template-stack-cell' }, [
    h('span', { class: 'email-template-primary-text' }, `${row.steps.length} 封 · ${sameThreadCount} 封同线程`),
    h('span', { class: 'email-template-secondary-text' }, firstStep?.subjectTemplate || '首封未配置主题')
  ]);
}

const columns = computed<DataTableColumns<Api.Crm.EmailTemplateGroupRecord>>(() => {
  const baseColumns: DataTableColumns<Api.Crm.EmailTemplateGroupRecord> = [
    {
      key: 'name',
      title: '模板',
      minWidth: 240,
      render: row => renderTemplateName(row)
    },
    {
      key: 'language',
      title: '语言',
      width: 90,
      render: row => row.language
    },
    {
      key: 'steps',
      title: '步骤',
      minWidth: 240,
      render: row => renderStepSummary(row)
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
                  type: emailTemplateStatusTagTypeMap[row.status]
                },
                { default: () => emailTemplateStatusLabelMap[row.status] }
              ),
              row.isDefault
                ? h(NTag, { bordered: false, size: 'small', type: 'info' }, { default: () => '默认' })
                : null
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
    }
  ];

  if (!props.canManage) {
    return baseColumns;
  }

  return [
    ...baseColumns,
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
                  loading: props.operatingTemplateId === row.id,
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
                        loading: props.operatingTemplateId === row.id,
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
  ];
});
</script>

<template>
  <NSpace vertical :size="12">
    <NDataTable
      :columns="columns"
      :data="records"
      :loading="loading"
      :row-key="row => row.id"
      :scroll-x="1220"
      size="small"
      remote
    >
      <template #empty>
        <NEmpty description="暂无邮件模板" />
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
.email-template-stack-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  line-height: 1.35;
}

.email-template-primary-text {
  color: var(--n-text-color);
  font-weight: 500;
}

.email-template-secondary-text {
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
