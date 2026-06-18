<script setup lang="ts">
import { computed, h } from 'vue';
import { NButton, NPopconfirm, NSpace, NTag } from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import {
  formatMailboxDate,
  formatMailboxQuota,
  mailboxStatusLabelMap,
  mailboxStatusTagTypeMap,
  mailboxWarmupLabelMap,
  mailboxWarmupTagTypeMap
} from './shared';

const props = defineProps<{
  records: Api.Crm.MailboxRecord[];
  loading?: boolean;
  operatingMailboxId?: string | null;
  page: number;
  pageSize: number;
  total: number;
}>();

const emit = defineEmits<{
  toggle: [record: Api.Crm.MailboxRecord];
  updatePage: [page: number];
  updatePageSize: [pageSize: number];
}>();

function renderEmail(row: Api.Crm.MailboxRecord) {
  return h('div', { class: 'mailbox-stack-cell' }, [
    h('span', { class: 'mailbox-primary-text' }, row.maskedEmail),
    h('span', { class: 'mailbox-secondary-text' }, row.emailAddress)
  ]);
}

function renderOwner(row: Api.Crm.MailboxRecord) {
  return h('div', { class: 'mailbox-stack-cell' }, [
    h('span', { class: 'mailbox-primary-text' }, row.ownerUserName || '-'),
    h('span', { class: 'mailbox-secondary-text' }, row.ownerUserId)
  ]);
}

const columns = computed<DataTableColumns<Api.Crm.MailboxRecord>>(() => [
  {
    key: 'emailAddress',
    title: '邮箱',
    minWidth: 240,
    render: row => renderEmail(row)
  },
  {
    key: 'status',
    title: '状态',
    width: 120,
    render: row =>
      h(
        NTag,
        {
          bordered: false,
          size: 'small',
          type: mailboxStatusTagTypeMap[row.status]
        },
        { default: () => mailboxStatusLabelMap[row.status] }
      )
  },
  {
    key: 'owner',
    title: '负责人',
    minWidth: 180,
    render: row => renderOwner(row)
  },
  {
    key: 'quota',
    title: '额度',
    width: 130,
    render: row => formatMailboxQuota(row)
  },
  {
    key: 'warmupStage',
    title: 'warmup',
    width: 120,
    render: row =>
      h(
        NTag,
        {
          bordered: false,
          size: 'small',
          type: mailboxWarmupTagTypeMap[row.warmupStage]
        },
        { default: () => mailboxWarmupLabelMap[row.warmupStage] }
      )
  },
  {
    key: 'watchExpiration',
    title: 'watch 到期',
    minWidth: 180,
    render: row => formatMailboxDate(row.watchExpiration)
  },
  {
    key: 'updatedAt',
    title: '更新时间',
    minWidth: 180,
    render: row => formatMailboxDate(row.updatedAt)
  },
  {
    key: 'operate',
    title: '操作',
    width: 120,
    fixed: 'right',
    render: row => {
      const isActive = row.status === 'active';
      const isPaused = row.status === 'paused';
      const actionText = isActive ? '暂停' : '恢复';

      if (!isActive && !isPaused) {
        return h(
          NButton,
          {
            size: 'small',
            text: true,
            disabled: true
          },
          { default: () => '重新授权' }
        );
      }

      return h(
        NSpace,
        {
          size: 8,
          justify: 'center'
        },
        {
          default: () => [
            h(
              NPopconfirm,
              {
                onPositiveClick: () => emit('toggle', row)
              },
              {
                default: () => `确认${actionText}“${row.maskedEmail}”？`,
                trigger: () =>
                  h(
                    NButton,
                    {
                      size: 'small',
                      text: true,
                      type: isActive ? 'warning' : 'success',
                      loading: props.operatingMailboxId === row.id
                    },
                    { default: () => actionText }
                  )
              }
            )
          ]
        }
      );
    }
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
      :scroll-x="1250"
      size="small"
      remote
    >
      <template #empty>
        <NEmpty description="暂无邮箱账号" />
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
.mailbox-stack-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  line-height: 1.35;
}

.mailbox-primary-text {
  color: var(--n-text-color);
  font-weight: 500;
}

.mailbox-secondary-text {
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
