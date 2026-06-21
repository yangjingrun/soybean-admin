<script setup lang="ts">
import { computed, h } from 'vue';
import { NButton, NPopconfirm, NSpace, NTag } from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import {
  formatProductLineDate,
  formatProductLineSupply,
  productLineStatusLabelMap,
  productLineStatusTagTypeMap
} from './shared';

const props = defineProps<{
  canManage?: boolean;
  records: Api.Crm.ProductLineRecord[];
  loading?: boolean;
  operatingProductLineId?: string | null;
  page: number;
  pageSize: number;
  total: number;
}>();

const emit = defineEmits<{
  archive: [record: Api.Crm.ProductLineRecord];
  edit: [record: Api.Crm.ProductLineRecord];
  updatePage: [page: number];
  updatePageSize: [pageSize: number];
}>();

function renderText(value: string | null) {
  return h('span', { class: 'product-line-ellipsis', title: value }, value || '-');
}

function renderProductLine(row: Api.Crm.ProductLineRecord) {
  return h('div', { class: 'product-line-stack-cell' }, [
    h('span', { class: 'product-line-primary-text' }, row.name),
    h('span', { class: 'product-line-secondary-text' }, row.commonModelsText || '-')
  ]);
}

const columns = computed<DataTableColumns<Api.Crm.ProductLineRecord>>(() => {
  const baseColumns: DataTableColumns<Api.Crm.ProductLineRecord> = [
    {
      key: 'name',
      title: '产品线',
      minWidth: 220,
      render: row => renderProductLine(row)
    },
    {
      key: 'targetCustomerType',
      title: '目标客户',
      minWidth: 160,
      render: row => renderText(row.targetCustomerType)
    },
    {
      key: 'coreSellingPoints',
      title: '核心卖点',
      minWidth: 240,
      render: row => renderText(row.coreSellingPoints)
    },
    {
      key: 'supply',
      title: 'MOQ/交期',
      minWidth: 150,
      render: row => formatProductLineSupply(row)
    },
    {
      key: 'certifications',
      title: '认证',
      minWidth: 150,
      render: row => renderText(row.certifications)
    },
    {
      key: 'status',
      title: '状态',
      width: 110,
      render: row =>
        h(
          NTag,
          {
            bordered: false,
            size: 'small',
            type: productLineStatusTagTypeMap[row.status]
          },
          { default: () => productLineStatusLabelMap[row.status] }
        )
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
      width: 150,
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
                        size: 'small',
                        text: true,
                        type: 'warning',
                        disabled: row.status === 'archived',
                        loading: props.operatingProductLineId === row.id
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
      :scroll-x="1400"
      size="small"
      remote
    >
      <template #empty>
        <NEmpty description="暂无产品线资料" />
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
.product-line-stack-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  line-height: 1.35;
}

.product-line-primary-text {
  color: var(--n-text-color);
  font-weight: 500;
}

.product-line-secondary-text,
.product-line-ellipsis {
  color: var(--n-text-color-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.product-line-secondary-text {
  font-size: 12px;
}

.table-pagination {
  display: flex;
  justify-content: flex-end;
}
</style>
