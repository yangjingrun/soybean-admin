<script setup lang="ts">
import { computed, h } from 'vue';
import { NTag } from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import { formatLeadDate, getWebsiteHref, leadStatusLabelMap, leadStatusTagTypeMap } from './shared';

defineProps<{
  records: Api.Crm.LeadRecord[];
  loading?: boolean;
  page: number;
  pageSize: number;
  total: number;
}>();

const emit = defineEmits<{
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
  return h('div', { class: 'lead-stack-cell' }, [
    row.websiteUrl
      ? h(
          'a',
          {
            class: 'lead-website-link',
            href: getWebsiteHref(row.websiteUrl),
            target: '_blank',
            rel: 'noreferrer'
          },
          row.websiteUrl
        )
      : h('span', { class: 'lead-empty-text' }, '-'),
    h('span', { class: 'lead-secondary-text' }, row.domain || '-')
  ]);
}

function renderRegion(row: Api.Crm.LeadRecord) {
  return h('div', { class: 'lead-stack-cell' }, [
    h('span', { class: row.country ? 'lead-primary-text' : 'lead-empty-text' }, row.country || '-'),
    h('span', { class: 'lead-secondary-text' }, row.customerType || '-')
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
    title: '官网 / 域名',
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
  }
]);
</script>

<template>
  <NCard :bordered="false" size="small" class="card-wrapper" title="线索列表">
    <NSpace vertical :size="12">
      <NDataTable
        :columns="columns"
        :data="records"
        :loading="loading"
        :row-key="row => row.id"
        :scroll-x="1160"
        size="small"
        remote
      >
        <template #empty>
          <NEmpty description="暂无线索" />
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
