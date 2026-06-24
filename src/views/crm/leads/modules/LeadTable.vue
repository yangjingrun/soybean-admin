<script setup lang="ts">
import { computed, h } from 'vue';
import { NButton, NDataTable, NEmpty, NSpace, NSpin, NTag } from 'naive-ui';
import type { DataTableColumns, DataTableRowKey } from 'naive-ui';
import {
  buildLeadExpandedContactView,
  buildLeadRowContactView,
  canCreateSequenceFromLeadContact,
  formatLeadDate,
  getLeadNextAction,
  getWebsiteHref,
  leadEmailStatusLabelMap,
  leadEmailStatusTagTypeMap,
  leadStatusLabelMap,
  leadStatusTagTypeMap
} from './shared';

const props = defineProps<{
  records: Api.Crm.LeadRecord[];
  loading?: boolean;
  archiveOperatingId?: string | null;
  expandedLeadDetails?: Record<string, Api.Crm.LeadDetail>;
  expandedLeadFailedIds?: string[];
  expandedLeadLoadingIds?: string[];
  expandedRowKeys?: string[];
  page: number;
  pageSize: number;
  total: number;
  verifyingContactIds?: string[];
}>();

const emit = defineEmits<{
  archive: [record: Api.Crm.LeadRecord];
  createSequence: [contact: Api.Crm.LeadContact];
  loadExpandedContacts: [accountId: string];
  restore: [record: Api.Crm.LeadRecord];
  updateExpandedRowKeys: [keys: string[]];
  view: [record: Api.Crm.LeadRecord];
  updatePage: [page: number];
  updatePageSize: [pageSize: number];
  verifyContactEmail: [contact: Api.Crm.LeadContact];
}>();

function renderCompany(row: Api.Crm.LeadRecord) {
  return h('div', { class: 'lead-company-cell' }, [
    h('span', { class: 'lead-company-name' }, row.name),
    h('span', { class: 'lead-company-id' }, row.normalizedName)
  ]);
}

function renderWebsite(row: Api.Crm.LeadRecord) {
  const websiteNode = row.websiteUrl
    ? h(
        'a',
        {
          class: 'lead-official-link',
          href: getWebsiteHref(row.websiteUrl),
          target: '_blank',
          rel: 'noreferrer',
          title: row.websiteUrl
        },
        '官网'
      )
    : h('span', { class: 'lead-empty-text' }, '-');

  return h('div', { class: 'lead-stack-cell' }, [websiteNode]);
}

function renderRegion(row: Api.Crm.LeadRecord) {
  const regionText = [row.country, row.city].filter(Boolean).join(' / ');

  return h('div', { class: 'lead-stack-cell' }, [
    h('span', { class: regionText ? 'lead-primary-text' : 'lead-empty-text' }, regionText || '-'),
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

function renderContactSummary(row: Api.Crm.LeadRecord) {
  const view = buildLeadRowContactView(row);

  if (view.type === 'empty') {
    return h(
      NTag,
      {
        bordered: false,
        size: 'small',
        type: 'warning'
      },
      { default: () => '缺联系人' }
    );
  }

  if (view.type === 'multiple') {
    return h('div', { class: 'lead-contact-summary' }, [
      h(
        NTag,
        {
          bordered: false,
          size: 'small',
          type: 'info'
        },
        { default: () => `共 ${view.count} 人` }
      ),
      view.primaryContact
        ? h('span', { class: 'lead-secondary-text' }, `首位：${formatContactPreview(view.primaryContact)}`)
        : h('span', { class: 'lead-secondary-text' }, '展开查看联系人')
    ]);
  }

  return h('div', { class: 'lead-contact-summary' }, [
    renderContactIdentity(view.primaryContact),
    h(
      NTag,
      {
        bordered: false,
        size: 'small',
        type: leadEmailStatusTagTypeMap[view.primaryContact.emailStatus]
      },
      { default: () => leadEmailStatusLabelMap[view.primaryContact.emailStatus] }
    )
  ]);
}

function isContactVerifying(contactId: string) {
  return props.verifyingContactIds?.includes(contactId) ?? false;
}

function formatContactPreview(contact: Api.Crm.LeadContact) {
  return [contact.fullName || contact.maskedEmail || contact.email, contact.title].filter(Boolean).join(' / ');
}

function renderContactIdentity(contact: Api.Crm.LeadContact) {
  return h('div', { class: 'lead-contact-cell' }, [
    h('span', { class: 'lead-primary-text' }, contact.fullName || '-'),
    h(
      'span',
      { class: 'lead-secondary-text' },
      [contact.title, contact.maskedEmail || contact.email].filter(Boolean).join(' / ')
    )
  ]);
}

const expandedContactColumns = computed<DataTableColumns<Api.Crm.LeadContact>>(() => [
  {
    key: 'contact',
    title: '联系人',
    minWidth: 170,
    render: row =>
      h('div', { class: 'lead-contact-cell' }, [
        h('span', { class: 'lead-primary-text' }, row.fullName || '-'),
        h('span', { class: 'lead-secondary-text' }, row.title || '-')
      ])
  },
  {
    key: 'email',
    title: '邮箱',
    minWidth: 200,
    render: row => row.maskedEmail || row.email
  },
  {
    key: 'emailStatus',
    title: '邮箱状态',
    width: 110,
    render: row =>
      h(
        NTag,
        {
          bordered: false,
          size: 'small',
          type: leadEmailStatusTagTypeMap[row.emailStatus]
        },
        { default: () => leadEmailStatusLabelMap[row.emailStatus] }
      )
  },
  {
    key: 'operate',
    title: '操作',
    width: 130,
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
                loading: isContactVerifying(row.id),
                disabled: isContactVerifying(row.id),
                onClick: () => emit('verifyContactEmail', row)
              },
              { default: () => '验证' }
            ),
            h(
              NButton,
              {
                size: 'small',
                text: true,
                type: 'success',
                disabled: !canCreateSequenceFromLeadContact(row),
                onClick: () => emit('createSequence', row)
              },
              { default: () => '开发信' }
            )
          ]
        }
      )
  }
]);

function renderExpandedContacts(row: Api.Crm.LeadRecord) {
  const view = buildLeadExpandedContactView({
    accountId: row.id,
    detail: props.expandedLeadDetails?.[row.id] ?? null,
    loadingIds: props.expandedLeadLoadingIds ?? [],
    failedIds: props.expandedLeadFailedIds ?? []
  });

  if (view.status === 'loading' || view.status === 'idle') {
    return h(
      'div',
      { class: 'lead-expanded-panel lead-expanded-loading' },
      h(NSpin, { size: 'small', show: true }, { description: () => '正在加载联系人' })
    );
  }

  if (view.status === 'error') {
    return h('div', { class: 'lead-expanded-panel lead-expanded-empty' }, [
      h('span', { class: 'lead-secondary-text' }, '联系人加载失败'),
      h(
        NButton,
        {
          size: 'tiny',
          secondary: true,
          type: 'primary',
          onClick: () => emit('loadExpandedContacts', row.id)
        },
        { default: () => '重试' }
      )
    ]);
  }

  if (!view.contacts.length) {
    return h('div', { class: 'lead-expanded-panel' }, h(NEmpty, { description: '暂无联系人' }));
  }

  return h('div', { class: 'lead-expanded-panel' }, [
    h(NDataTable, {
      columns: expandedContactColumns.value,
      data: view.contacts,
      rowKey: (contact: Api.Crm.LeadContact) => contact.id,
      scrollX: 760,
      size: 'small'
    })
  ]);
}

function handleExpandedRowKeysUpdate(keys: DataTableRowKey[]) {
  emit('updateExpandedRowKeys', keys.map(String));
}

const hasMultipleContactRows = computed(() =>
  props.records.some(row => buildLeadRowContactView(row).type === 'multiple')
);

const columns = computed<DataTableColumns<Api.Crm.LeadRecord>>(() => {
  const tableColumns: DataTableColumns<Api.Crm.LeadRecord> = [
    {
      key: 'name',
      title: '公司名',
      minWidth: 260,
      render: row => renderCompany(row)
    },
    {
      key: 'contacts',
      title: '联系人',
      minWidth: 260,
      render: row => renderContactSummary(row)
    },
    {
      key: 'website',
      title: '官网',
      width: 90,
      render: row => renderWebsite(row)
    },
    {
      key: 'region',
      title: '地区 / 客户类型',
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
      key: 'updatedAt',
      title: '更新时间',
      width: 180,
      render: row => formatLeadDate(row.updatedAt)
    },
    {
      key: 'operate',
      title: '操作',
      width: 150,
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
                  type: row.status === 'archived' ? 'primary' : 'error',
                  loading: props.archiveOperatingId === row.id,
                  onClick: () => (row.status === 'archived' ? emit('restore', row) : emit('archive', row))
                },
                { default: () => (row.status === 'archived' ? '重新开发' : '暂不开发') }
              )
            ]
          }
        )
    }
  ];

  if (!hasMultipleContactRows.value) {
    return tableColumns;
  }

  return [
    {
      type: 'expand',
      width: 44,
      expandable: row => buildLeadRowContactView(row).type === 'multiple',
      renderExpand: row => renderExpandedContacts(row)
    },
    ...tableColumns
  ];
});
</script>

<template>
  <NCard :bordered="false" size="small" class="card-wrapper" title="客户管理">
    <NSpace vertical :size="12">
      <NDataTable
        :columns="columns"
        :data="records"
        :expanded-row-keys="expandedRowKeys"
        :loading="loading"
        :row-key="row => row.id"
        :scroll-x="1580"
        size="small"
        remote
        @update:expanded-row-keys="handleExpandedRowKeysUpdate"
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
.lead-stack-cell,
.lead-contact-cell,
.lead-contact-summary {
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

.lead-official-link {
  align-self: flex-start;
  color: rgb(var(--primary-color));
  font-weight: 500;
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 3px;
}

.lead-official-link:hover {
  color: rgb(var(--primary-color) / 0.82);
}

.table-pagination {
  display: flex;
  justify-content: flex-end;
}

.lead-expanded-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 12px 10px 48px;
  background-color: rgb(var(--layout-bg-color));
}

.lead-expanded-loading,
.lead-expanded-empty {
  align-items: flex-start;
  flex-direction: row;
}
</style>
