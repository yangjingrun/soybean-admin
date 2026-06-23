<script setup lang="ts">
import { computed, h } from 'vue';
import { NButton, NPopconfirm, NSpace, NTag } from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import {
  formatMailboxDate,
  formatMailboxHistoryId,
  formatMailboxQuota,
  formatMailboxSyncActionLabel,
  formatMailboxSyncModeDescription,
  formatMailboxWatchDescription,
  getMailboxWatchStatus,
  mailboxSyncModeLabelMap,
  mailboxSyncModeTagTypeMap,
  mailboxStatusLabelMap,
  mailboxStatusTagTypeMap,
  mailboxWatchStatusLabelMap,
  mailboxWatchStatusTagTypeMap,
  mailboxWarmupLabelMap,
  mailboxWarmupTagTypeMap
} from './shared';
import type { MailboxOperationAction, OperatingMailboxAction } from './useMailboxTable';

const props = defineProps<{
  records: Api.Crm.MailboxRecord[];
  loading?: boolean;
  operatingMailboxAction?: OperatingMailboxAction | null;
  page: number;
  pageSize: number;
  total: number;
}>();

const emit = defineEmits<{
  deleteMailbox: [record: Api.Crm.MailboxRecord];
  reauthorize: [record: Api.Crm.MailboxRecord];
  renewWatch: [record: Api.Crm.MailboxRecord];
  revokeAuthorization: [record: Api.Crm.MailboxRecord];
  syncNow: [record: Api.Crm.MailboxRecord];
  toggle: [record: Api.Crm.MailboxRecord];
  updatePage: [page: number];
  updatePageSize: [pageSize: number];
}>();

function isOperating(row: Api.Crm.MailboxRecord, action: MailboxOperationAction) {
  return props.operatingMailboxAction?.id === row.id && props.operatingMailboxAction.action === action;
}

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

function renderAuthorizationStatus(row: Api.Crm.MailboxRecord) {
  const description =
    row.status === 'revoked' && row.pausedAt
      ? `取消于 ${formatMailboxDate(row.pausedAt)}`
      : row.status === 'paused' && row.pausedAt
        ? `暂停于 ${formatMailboxDate(row.pausedAt)}`
        : `授权于 ${formatMailboxDate(row.authorizedAt)}`;

  return h('div', { class: 'mailbox-stack-cell' }, [
    h(
      NTag,
      {
        bordered: false,
        size: 'small',
        type: mailboxStatusTagTypeMap[row.status]
      },
      { default: () => mailboxStatusLabelMap[row.status] }
    ),
    h('span', { class: 'mailbox-secondary-text' }, description)
  ]);
}

function renderWatchStatus(row: Api.Crm.MailboxRecord) {
  if (row.syncMode !== 'full_sync') {
    return h('div', { class: 'mailbox-stack-cell' }, [
      h(
        NTag,
        {
          bordered: false,
          size: 'small',
          type: mailboxSyncModeTagTypeMap[row.syncMode]
        },
        { default: () => mailboxSyncModeLabelMap[row.syncMode] }
      ),
      h('span', { class: 'mailbox-secondary-text' }, formatMailboxSyncModeDescription(row))
    ]);
  }

  const watchStatus = getMailboxWatchStatus(row.watchExpiration);

  return h('div', { class: 'mailbox-stack-cell' }, [
    h(
      NTag,
      {
        bordered: false,
        size: 'small',
        type: mailboxWatchStatusTagTypeMap[watchStatus]
      },
      { default: () => mailboxWatchStatusLabelMap[watchStatus] }
    ),
    h('span', { class: 'mailbox-secondary-text' }, formatMailboxWatchDescription(row.watchExpiration))
  ]);
}

function renderSyncMode(row: Api.Crm.MailboxRecord) {
  return h('div', { class: 'mailbox-stack-cell' }, [
    h(
      NTag,
      {
        bordered: false,
        size: 'small',
        type: mailboxSyncModeTagTypeMap[row.syncMode]
      },
      { default: () => mailboxSyncModeLabelMap[row.syncMode] }
    ),
    h('span', { class: 'mailbox-secondary-text' }, formatMailboxSyncModeDescription(row))
  ]);
}

function renderSyncCheckpoint(row: Api.Crm.MailboxRecord) {
  if (row.syncMode !== 'full_sync') {
    return h('div', { class: 'mailbox-stack-cell' }, [
      h(NTag, { bordered: false, size: 'small', type: 'default' }, { default: () => '非完整同步' }),
      h('span', { class: 'mailbox-secondary-text' }, '不展示为真实闭环')
    ]);
  }

  if (row.lastSyncIssue) {
    return h('div', { class: 'mailbox-stack-cell' }, [
      h(
        NTag,
        {
          bordered: false,
          size: 'small',
          type: 'error'
        },
        { default: () => '需人工处理' }
      ),
      h('span', { class: 'mailbox-secondary-text' }, row.lastSyncIssue.message),
      h('span', { class: 'mailbox-secondary-text' }, `发生于 ${formatMailboxDate(row.lastSyncIssue.happenedAt)}`)
    ]);
  }

  const hasSynced = Boolean(row.lastHistoryId);

  return h('div', { class: 'mailbox-stack-cell' }, [
    h(
      NTag,
      {
        bordered: false,
        size: 'small',
        type: hasSynced ? 'info' : 'default'
      },
      { default: () => formatMailboxHistoryId(row.lastHistoryId) }
    ),
    h('span', { class: 'mailbox-secondary-text' }, hasSynced ? 'Gmail historyId' : '等待首次同步')
  ]);
}

function renderRevokeAuthorizationAction(row: Api.Crm.MailboxRecord, enabled: boolean) {
  return h(
    NPopconfirm,
    {
      onPositiveClick: () => {
        if (enabled) {
          emit('revokeAuthorization', row);
        }
      }
    },
    {
      default: () =>
        `取消后“${row.maskedEmail}”会保留在当前账号，停止发送和同步；删除邮箱后其他用户才可绑定。确认取消授权？`,
      trigger: () =>
        h(
          NButton,
          {
            disabled: !enabled,
            loading: isOperating(row, 'revokeAuthorization'),
            size: 'small',
            text: true,
            type: 'error'
          },
          { default: () => '取消授权' }
        )
    }
  );
}

function renderDeleteAction(row: Api.Crm.MailboxRecord, enabled: boolean) {
  return h(
    NPopconfirm,
    {
      onPositiveClick: () => {
        if (enabled) {
          emit('deleteMailbox', row);
        }
      }
    },
    {
      default: () => `删除后“${row.maskedEmail}”会从当前账号移除，其他用户可重新绑定。确认删除？`,
      trigger: () =>
        h(
          NButton,
          {
            disabled: !enabled,
            loading: isOperating(row, 'delete'),
            size: 'small',
            text: true,
            type: 'error'
          },
          { default: () => '删除' }
        )
    }
  );
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
    title: '授权状态',
    minWidth: 170,
    render: row => renderAuthorizationStatus(row)
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
    title: '收信同步',
    minWidth: 180,
    render: row => renderWatchStatus(row)
  },
  {
    key: 'syncMode',
    title: '闭环模式',
    minWidth: 190,
    render: row => renderSyncMode(row)
  },
  {
    key: 'lastHistoryId',
    title: '同步进度',
    minWidth: 150,
    render: row => renderSyncCheckpoint(row)
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
    width: 320,
    fixed: 'right',
    render: row => {
      const isActive = row.status === 'active';
      const isPaused = row.status === 'paused';
      const canReauthorize = (row.status === 'auth_expired' || row.status === 'revoked') && row.provider === 'gmail';
      const canRenewWatch = isActive && row.provider === 'gmail';
      const canRevokeAuthorization = row.provider === 'gmail' && row.status !== 'revoked';
      const canDelete = row.status === 'auth_expired' || row.status === 'revoked';
      const canSyncNow = isActive && row.provider === 'gmail';
      const actionText = isActive ? '暂停' : '恢复';

      if (!isActive && !isPaused) {
        return h(
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
                  type: canReauthorize ? 'primary' : 'default',
                  disabled: !canReauthorize,
                  loading: isOperating(row, 'reauthorize'),
                  onClick: () => {
                    if (canReauthorize) {
                      emit('reauthorize', row);
                    }
                  }
                },
                { default: () => '重新授权' }
              ),
              canRevokeAuthorization ? renderRevokeAuthorizationAction(row, canRevokeAuthorization) : null,
              canDelete ? renderDeleteAction(row, canDelete) : null
            ]
          }
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
            canRenewWatch
              ? h(
                  NButton,
                  {
                    size: 'small',
                    text: true,
                    type: 'primary',
                    loading: isOperating(row, 'renewWatch'),
                    onClick: () => emit('renewWatch', row)
                  },
                  { default: () => '续期收信' }
                )
              : null,
            canSyncNow
              ? h(
                  NButton,
                  {
                    size: 'small',
                    text: true,
                    type: 'info',
                    loading: isOperating(row, 'syncNow'),
                    onClick: () => emit('syncNow', row)
                  },
                  { default: () => formatMailboxSyncActionLabel(row) }
                )
              : null,
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
                      loading: isOperating(row, 'toggle')
                    },
                    { default: () => actionText }
                  )
              }
            ),
            renderRevokeAuthorizationAction(row, canRevokeAuthorization)
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
      :scroll-x="1720"
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
