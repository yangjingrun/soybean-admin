<script setup lang="ts">
import { computed, h } from 'vue';
import { NButton, NDataTable, NDropdown, NEmpty, NSpace, NSpin, NTag } from 'naive-ui';
import type { DataTableColumns, DataTableRowKey } from 'naive-ui';
import {
  buildLeadEmailProgressView,
  buildLeadExpandedContactView,
  buildLeadRowContactView,
  canCreateSequenceFromLeadContact,
  formatLeadDate,
  getWebsiteHref,
  leadEmailStatusLabelMap,
  leadEmailStatusTagTypeMap,
  leadStatusLabelMap,
  leadStatusTagTypeMap,
  type LeadCommunicationTab
} from './shared';

const props = defineProps<{
  checkedRowKeys?: string[];
  checkedSequenceTargetCount?: number;
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
  batchCreateSequence: [];
  createSequence: [contact: Api.Crm.LeadContact];
  loadExpandedContacts: [accountId: string];
  restore: [record: Api.Crm.LeadRecord];
  openCommunication: [record: Api.Crm.LeadRecord, tab: LeadCommunicationTab, contactId?: string];
  updateCheckedRowKeys: [keys: string[]];
  updateExpandedRowKeys: [keys: string[]];
  updatePage: [page: number];
  updatePageSize: [pageSize: number];
  verifyContactEmail: [contact: Api.Crm.LeadContact];
}>();

function renderCompany(row: Api.Crm.LeadRecord) {
  const href = row.websiteUrl || row.domain ? getWebsiteHref(row.websiteUrl || row.domain || '') : '';
  const companyNode = href
    ? h(
        'a',
        {
          class: 'lead-company-link',
          href,
          target: '_blank',
          rel: 'noreferrer',
          title: `打开官网：${row.name}`
        },
        row.name
      )
    : h('span', { class: 'lead-company-name' }, row.name);

  return h('div', { class: 'lead-company-cell' }, companyNode);
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

function renderEmailProgress(contact: Api.Crm.LeadContact | null) {
  if (!contact) {
    return h('span', { class: 'lead-empty-text' }, '-');
  }

  const progress = buildLeadEmailProgressView(contact);

  return h('div', { class: 'lead-stack-cell' }, [
    h(
      NTag,
      {
        bordered: false,
        size: 'small',
        type: progress.tagType
      },
      { default: () => progress.label }
    ),
    h('span', { class: 'lead-secondary-text' }, progress.timeText)
  ]);
}

function renderRecentInteraction(row: Api.Crm.LeadRecord) {
  const contactProgressAt = row.primaryContact?.emailProgressAt;

  return h('div', { class: 'lead-stack-cell' }, [
    h('span', { class: 'lead-primary-text' }, contactProgressAt ? '邮箱进度更新' : '客户资料更新'),
    h('span', { class: 'lead-secondary-text' }, formatLeadDate(contactProgressAt || row.updatedAt))
  ]);
}

function isContactVerifying(contactId: string) {
  return props.verifyingContactIds?.includes(contactId) ?? false;
}

function formatContactPreview(contact: Api.Crm.LeadContact) {
  return [contact.fullName || contact.email, contact.title].filter(Boolean).join(' / ');
}

function renderContactIdentity(contact: Api.Crm.LeadContact) {
  const contactEmail = contact.email;

  return h('div', { class: 'lead-contact-cell' }, [
    h('span', { class: 'lead-primary-text' }, contact.fullName || '-'),
    contact.title ? h('span', { class: 'lead-secondary-text' }, contact.title) : null,
    contactEmail ? h('span', { class: 'lead-secondary-text' }, contactEmail) : null
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
    render: row => row.email
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
    key: 'emailProgress',
    title: '邮箱进度',
    minWidth: 190,
    render: row => renderEmailProgress(row)
  },
  {
    key: 'operate',
    title: '操作',
    width: 240,
    fixed: 'right',
    render: row =>
      h(
        NSpace,
        {
          size: 8,
          justify: 'center',
          wrap: true
        },
        {
          default: () => [
            h(
              NButton,
              {
                size: 'small',
                text: true,
                type: 'primary',
                onClick: () => openContactCommunication(row, 'profile')
              },
              { default: () => '详情' }
            ),
            h(
              NButton,
              {
                size: 'small',
                text: true,
                type: 'success',
                onClick: () => openContactCommunication(row, 'sequence')
              },
              { default: () => '进度' }
            ),
            h(
              NButton,
              {
                size: 'small',
                text: true,
                type: 'info',
                onClick: () => openContactCommunication(row, 'inbox')
              },
              { default: () => '邮件' }
            ),
            h(
              NButton,
              {
                size: 'small',
                text: true,
                type: 'primary',
                onClick: () => openContactCommunication(row, 'schedule')
              },
              { default: () => '调度' }
            ),
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

function openContactCommunication(contact: Api.Crm.LeadContact, tab: LeadCommunicationTab) {
  const record = props.records.find(item => item.id === contact.accountId);

  if (!record) {
    return;
  }

  emit('openCommunication', record, tab, contact.id);
}

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
      scrollX: 980,
      size: 'small'
    })
  ]);
}

function handleExpandedRowKeysUpdate(keys: DataTableRowKey[]) {
  emit('updateExpandedRowKeys', keys.map(String));
}

function handleCheckedRowKeysUpdate(keys: DataTableRowKey[]) {
  emit('updateCheckedRowKeys', keys.map(String));
}

function handleMoreAction(key: string | number, row: Api.Crm.LeadRecord) {
  if (key === 'createSequence' && row.primaryContact) {
    emit('createSequence', row.primaryContact);
    return;
  }

  if (key === 'restore') {
    emit('restore', row);
    return;
  }

  if (key === 'archive') {
    emit('archive', row);
  }
}

const hasMultipleContactRows = computed(() =>
  props.records.some(row => buildLeadRowContactView(row).type === 'multiple')
);

const columns = computed<DataTableColumns<Api.Crm.LeadRecord>>(() => {
  const selectionColumn: DataTableColumns<Api.Crm.LeadRecord>[number] = {
    type: 'selection',
    width: 44,
    disabled: row => !row.primaryContact || !canCreateSequenceFromLeadContact(row.primaryContact)
  };
  const tableColumns: DataTableColumns<Api.Crm.LeadRecord> = [
    selectionColumn,
    {
      key: 'name',
      title: '公司 / 官网',
      width: 220,
      render: row => renderCompany(row)
    },
    {
      key: 'contacts',
      title: '联系人',
      width: 220,
      render: row => renderContactSummary(row)
    },
    {
      key: 'status',
      title: '客户阶段',
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
      key: 'emailProgress',
      title: '邮箱进度',
      width: 150,
      render: row => renderEmailProgress(row.primaryContact)
    },
    {
      key: 'latestInteraction',
      title: '最近互动',
      width: 150,
      render: row => renderRecentInteraction(row)
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
      width: 260,
      fixed: 'right',
      render: row =>
        h(
          NSpace,
          {
            size: 8,
            justify: 'center',
            wrap: true
          },
          {
            default: () => [
              h(
                NButton,
                {
                  size: 'small',
                  text: true,
                  type: 'primary',
                  onClick: () => emit('openCommunication', row, 'profile', row.primaryContact?.id)
                },
                { default: () => '详情' }
              ),
              h(
                NButton,
                {
                  size: 'small',
                  text: true,
                  type: 'success',
                  onClick: () => emit('openCommunication', row, 'sequence', row.primaryContact?.id)
                },
                { default: () => '进度' }
              ),
              h(
                NButton,
                {
                  size: 'small',
                  text: true,
                  type: 'info',
                  onClick: () => emit('openCommunication', row, 'inbox', row.primaryContact?.id)
                },
                { default: () => '邮件' }
              ),
              h(
                NButton,
                {
                  size: 'small',
                  text: true,
                  type: 'primary',
                  onClick: () => emit('openCommunication', row, 'schedule', row.primaryContact?.id)
                },
                { default: () => '调度' }
              ),
              h(
                NDropdown,
                {
                  options: [
                    {
                      label: '生成开发信',
                      key: 'createSequence',
                      disabled: !row.primaryContact || !canCreateSequenceFromLeadContact(row.primaryContact)
                    },
                    {
                      label: row.status === 'archived' ? '重新开发' : '暂不开发',
                      key: row.status === 'archived' ? 'restore' : 'archive',
                      disabled: props.archiveOperatingId === row.id
                    }
                  ],
                  onSelect: (key: string | number) => handleMoreAction(key, row)
                },
                {
                  default: () =>
                    h(
                      NButton,
                      {
                        size: 'small',
                        text: true,
                        type: 'primary',
                        loading: props.archiveOperatingId === row.id
                      },
                      { default: () => '更多' }
                    )
                }
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
  <NCard :bordered="false" size="small" class="card-wrapper" title="客户开发台">
    <NSpace vertical :size="12">
      <div class="table-toolbar">
        <span class="lead-secondary-text">已选 {{ checkedSequenceTargetCount ?? 0 }} 个可生成联系人</span>
        <NButton
          size="small"
          type="primary"
          :disabled="!checkedSequenceTargetCount"
          @click="emit('batchCreateSequence')"
        >
          批量生成开发信
        </NButton>
      </div>

      <NDataTable
        :columns="columns"
        :data="records"
        :checked-row-keys="checkedRowKeys"
        :expanded-row-keys="expandedRowKeys"
        :loading="loading"
        :row-key="row => row.id"
        :scroll-x="1420"
        size="small"
        remote
        @update:checked-row-keys="handleCheckedRowKeysUpdate"
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
:deep(.lead-company-cell),
:deep(.lead-stack-cell),
:deep(.lead-contact-cell),
:deep(.lead-contact-summary) {
  display: flex;
  align-items: flex-start;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  line-height: 1.35;
  white-space: normal;
}

:deep(.lead-company-cell) {
  max-width: 200px;
}

:deep(.lead-contact-cell),
:deep(.lead-contact-summary) {
  max-width: 200px;
}

:deep(.lead-stack-cell) {
  max-width: 140px;
}

:deep(.lead-company-name),
:deep(.lead-company-link),
:deep(.lead-primary-text) {
  color: var(--n-text-color);
  font-weight: 500;
}

:deep(.lead-company-link) {
  align-self: flex-start;
  text-decoration: none;
}

:deep(.lead-company-name),
:deep(.lead-company-link),
:deep(.lead-primary-text),
:deep(.lead-secondary-text),
:deep(.lead-empty-text) {
  max-width: 100%;
  overflow-wrap: anywhere;
  word-break: break-word;
}

:deep(.lead-secondary-text),
:deep(.lead-empty-text) {
  color: var(--n-text-color-3);
  font-size: 12px;
}

:deep(.lead-company-link:hover) {
  color: rgb(var(--primary-color) / 0.82);
}

.table-pagination {
  display: flex;
  justify-content: flex-end;
}

.table-toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
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
