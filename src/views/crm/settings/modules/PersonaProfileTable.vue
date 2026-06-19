<script setup lang="ts">
import { computed, h } from 'vue';
import { NButton, NPopconfirm, NSpace, NTag } from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import { formatProductLineDate, personaProfileStatusLabelMap, personaProfileStatusTagTypeMap } from './shared';

const props = defineProps<{
  canManage?: boolean;
  records: Api.Crm.PersonaProfileRecord[];
  loading?: boolean;
  operatingPersonaProfileId?: string | null;
  page: number;
  pageSize: number;
  total: number;
}>();

const emit = defineEmits<{
  archive: [record: Api.Crm.PersonaProfileRecord];
  edit: [record: Api.Crm.PersonaProfileRecord];
  setDefault: [record: Api.Crm.PersonaProfileRecord];
  updatePage: [page: number];
  updatePageSize: [pageSize: number];
}>();

function renderText(value: string | null) {
  return h('span', { class: 'persona-profile-ellipsis', title: value }, value || '-');
}

function renderProfile(row: Api.Crm.PersonaProfileRecord) {
  return h('div', { class: 'persona-profile-stack-cell' }, [
    h('span', { class: 'persona-profile-primary-text' }, row.name),
    row.isDefault
      ? h(
          NTag,
          {
            bordered: false,
            size: 'small',
            type: 'info'
          },
          { default: () => '默认' }
        )
      : null
  ]);
}

const columns = computed<DataTableColumns<Api.Crm.PersonaProfileRecord>>(() => {
  const baseColumns: DataTableColumns<Api.Crm.PersonaProfileRecord> = [
    {
      key: 'name',
      title: '画像',
      minWidth: 180,
      render: row => renderProfile(row)
    },
    {
      key: 'titleKeywordsText',
      title: '职位关键词',
      minWidth: 220,
      render: row => renderText(row.titleKeywordsText)
    },
    {
      key: 'customerTypeKeywordsText',
      title: '客户类型',
      minWidth: 180,
      render: row => renderText(row.customerTypeKeywordsText)
    },
    {
      key: 'focusText',
      title: '关注点',
      minWidth: 240,
      render: row => renderText(row.focusText)
    },
    {
      key: 'painPoints',
      title: '痛点',
      minWidth: 220,
      render: row => renderText(row.painPoints)
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
            type: personaProfileStatusTagTypeMap[row.status]
          },
          { default: () => personaProfileStatusLabelMap[row.status] }
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
      width: 210,
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
                  loading: props.operatingPersonaProfileId === row.id,
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
                        loading: props.operatingPersonaProfileId === row.id,
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
      :scroll-x="1500"
      size="small"
      remote
    >
      <template #empty>
        <NEmpty description="暂无职位/客户画像" />
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
.persona-profile-stack-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.persona-profile-primary-text {
  color: var(--n-text-color);
  font-weight: 500;
}

.persona-profile-ellipsis {
  color: var(--n-text-color-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.table-pagination {
  display: flex;
  justify-content: flex-end;
}
</style>
