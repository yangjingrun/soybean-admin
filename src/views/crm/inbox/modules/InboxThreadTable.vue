<script setup lang="ts">
import { computed, h } from 'vue';
import { NBadge, NButton, NSpace, NTag } from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import { formatInboxDate, formatInboxText, inboxThreadStatusLabelMap, inboxThreadStatusTagTypeMap } from './shared';

defineProps<{
  loading?: boolean;
  page: number;
  pageSize: number;
  records: Api.Crm.InboxThreadRecord[];
  total: number;
}>();

const emit = defineEmits<{
  updatePage: [page: number];
  updatePageSize: [pageSize: number];
  view: [record: Api.Crm.InboxThreadRecord];
}>();

function renderSubject(row: Api.Crm.InboxThreadRecord) {
  return h('div', { class: 'inbox-subject-cell' }, [
    h('div', { class: 'inbox-subject-line' }, [
      h('span', { class: 'inbox-subject-text' }, row.subject),
      row.unreadCount
        ? h(NBadge, {
            class: 'inbox-unread-badge',
            value: row.unreadCount,
            max: 99,
            type: 'error'
          })
        : null
    ]),
    h('span', { class: 'inbox-secondary-text' }, row.lastMessageSnippet)
  ]);
}

function renderRelation(row: Api.Crm.InboxThreadRecord) {
  return h('div', { class: 'inbox-stack-cell' }, [
    h('span', { class: 'inbox-primary-text' }, row.account.name),
    h('span', { class: 'inbox-secondary-text' }, row.contact?.fullName || row.contact?.maskedEmail || '-')
  ]);
}

function renderMailbox(row: Api.Crm.InboxThreadRecord) {
  return h('div', { class: 'inbox-stack-cell' }, [
    h('span', { class: 'inbox-primary-text' }, formatInboxText(row.mailbox?.maskedEmail)),
    h('span', { class: 'inbox-secondary-text' }, row.enrollment?.name || '-')
  ]);
}

const columns = computed<DataTableColumns<Api.Crm.InboxThreadRecord>>(() => [
  {
    key: 'subject',
    title: '主题 / 最近正文',
    minWidth: 300,
    render: row => renderSubject(row)
  },
  {
    key: 'relation',
    title: '关联客户 / 联系人',
    minWidth: 220,
    render: row => renderRelation(row)
  },
  {
    key: 'mailbox',
    title: '邮箱 / 序列',
    minWidth: 210,
    render: row => renderMailbox(row)
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
          type: inboxThreadStatusTagTypeMap[row.status]
        },
        { default: () => inboxThreadStatusLabelMap[row.status] }
      )
  },
  {
    key: 'messageCount',
    title: '回复数',
    width: 90,
    render: row => row.messageCount
  },
  {
    key: 'lastInboundAt',
    title: '最近回复',
    width: 180,
    render: row => formatInboxDate(row.lastInboundAt)
  },
  {
    key: 'operate',
    title: '操作',
    width: 90,
    fixed: 'right',
    render: row =>
      h(
        NSpace,
        {
          justify: 'center',
          size: 8
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
            )
          ]
        }
      )
  }
]);
</script>

<template>
  <NCard :bordered="false" size="small" class="card-wrapper" title="客户回复">
    <NSpace vertical :size="12">
      <NDataTable
        :columns="columns"
        :data="records"
        :loading="loading"
        :row-key="row => row.id"
        :scroll-x="1200"
        size="small"
        remote
      >
        <template #empty>
          <NEmpty description="暂无客户回复" />
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
.inbox-subject-cell,
.inbox-stack-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  line-height: 1.35;
}

.inbox-subject-line {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.inbox-subject-text,
.inbox-primary-text {
  color: var(--n-text-color);
  font-weight: 500;
}

.inbox-subject-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.inbox-secondary-text {
  color: var(--n-text-color-3);
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.inbox-unread-badge {
  flex: 0 0 auto;
}

.table-pagination {
  display: flex;
  justify-content: flex-end;
}
</style>
