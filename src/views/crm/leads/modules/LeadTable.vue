<script setup lang="ts">
import { computed, h } from 'vue';
import { NButton, NSpace, NTag } from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import {
  formatLeadDate,
  formatLeadWebsiteDisplay,
  getLeadNextAction,
  getWebsiteHref,
  leadStatusLabelMap,
  leadStatusTagTypeMap
} from './shared';

const props = defineProps<{
  records: Api.Crm.LeadRecord[];
  loading?: boolean;
  archiveOperatingId?: string | null;
  page: number;
  pageSize: number;
  total: number;
}>();

const emit = defineEmits<{
  archive: [record: Api.Crm.LeadRecord];
  changeStatus: [record: Api.Crm.LeadRecord];
  restore: [record: Api.Crm.LeadRecord];
  view: [record: Api.Crm.LeadRecord];
  updatePage: [page: number];
  updatePageSize: [pageSize: number];
}>();

function renderCompany(row: Api.Crm.LeadRecord) {
  return h('div', { class: 'lead-company-cell' }, [
    h('span', { class: 'lead-company-name' }, row.name),
    h('span', { class: 'lead-company-id' }, row.normalizedName)
  ]);
}

function renderWebsite(row: Api.Crm.LeadRecord) {
  const displayText = formatLeadWebsiteDisplay(row);
  const websiteNode =
    row.websiteUrl && displayText !== '-'
      ? h(
          'a',
          {
            class: 'lead-website-link',
            href: getWebsiteHref(row.websiteUrl),
            target: '_blank',
            rel: 'noreferrer',
            title: row.websiteUrl
          },
          displayText
        )
      : h('span', { class: displayText === '-' ? 'lead-empty-text' : 'lead-primary-text' }, displayText);

  return h('div', { class: 'lead-stack-cell' }, [websiteNode]);
}

function renderRegion(row: Api.Crm.LeadRecord) {
  return h('div', { class: 'lead-stack-cell' }, [
    h('span', { class: row.country ? 'lead-primary-text' : 'lead-empty-text' }, row.country || '-'),
    h('span', { class: 'lead-secondary-text' }, row.customerType || '-')
  ]);
}

function renderNextAction(row: Api.Crm.LeadRecord) {
  const action = getLeadNextAction(row.status);

  return h('div', { class: 'lead-stack-cell' }, [
    h(
      NTag,
      {
        bordered: false,
        size: 'small',
        type: action.type
      },
      { default: () => action.label }
    ),
    h('span', { class: 'lead-secondary-text' }, action.description)
  ]);
}

const columns = computed<DataTableColumns<Api.Crm.LeadRecord>>(() => [
  {
    key: 'name',
    title: '公司名',
    minWidth: 220,
    render: row => renderCompany(row)
  },
  {
    key: 'website',
    title: '官网',
    minWidth: 260,
    render: row => renderWebsite(row)
  },
  {
    key: 'region',
    title: '国家 / 客户类型',
    minWidth: 160,
    render: row => renderRegion(row)
  },
  {
    key: 'status',
    title: '状态',
    width: 150,
    render: row =>
      h(
        NTag,
        {
          bordered: false,
          size: 'small',
          type: leadStatusTagTypeMap[row.status]
        },
        { default: () => leadStatusLabelMap[row.status] }
      )
  },
  {
    key: 'nextAction',
    title: '下一步',
    minWidth: 190,
    render: row => renderNextAction(row)
  },
  {
    key: 'sourceTaskId',
    title: '来源任务',
    minWidth: 190,
    ellipsis: {
      tooltip: true
    },
    render: row => row.sourceTaskId || '-'
  },
  {
    key: 'updatedAt',
    title: '更新时间',
    width: 180,
    render: row => formatLeadDate(row.updatedAt)
  },
  {
    key: 'operate',
    title: '操作',
    width: 190,
    fixed: 'right',
    render: row =>
      h(
        NSpace,
        {
          size: 8,
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
                onClick: () => emit('view', row)
              },
              { default: () => '详情' }
            ),
            h(
              NButton,
              {
                size: 'small',
                text: true,
                type: 'warning',
                onClick: () => emit('changeStatus', row)
              },
              { default: () => '跟进状态' }
            ),
            h(
              NButton,
              {
                size: 'small',
                text: true,
                type: row.status === 'archived' ? 'primary' : 'error',
                loading: props.archiveOperatingId === row.id,
                onClick: () => (row.status === 'archived' ? emit('restore', row) : emit('archive', row))
              },
              { default: () => (row.status === 'archived' ? '恢复' : '归档') }
            )
          ]
        }
      )
  }
]);
</script>

<template>
  <NCard :bordered="false" size="small" class="card-wrapper" title="客户列表">
    <NSpace vertical :size="12">
      <NDataTable
        :columns="columns"
        :data="records"
        :loading="loading"
        :row-key="row => row.id"
        :scroll-x="1540"
        size="small"
        remote
      >
        <template #empty>
          <NEmpty description="暂无客户" />
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
  </NCard>
</template>

<style scoped>
.lead-company-cell,
.lead-stack-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  line-height: 1.35;
}

.lead-company-name,
.lead-primary-text {
  color: var(--n-text-color);
  font-weight: 500;
}

.lead-company-id,
.lead-secondary-text,
.lead-empty-text {
  color: var(--n-text-color-3);
  font-size: 12px;
}

.lead-website-link {
  color: rgb(var(--primary-color));
  overflow: hidden;
  text-decoration: none;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lead-website-link:hover {
  text-decoration: underline;
}

.table-pagination {
  display: flex;
  justify-content: flex-end;
}
</style>
