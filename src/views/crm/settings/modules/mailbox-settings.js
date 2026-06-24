import dayjs from 'dayjs';
const MAILBOX_WATCH_EXPIRING_SOON_HOURS = 24;
export const mailboxStatusOptions = [
  { label: '启用', value: 'active' },
  { label: '暂停', value: 'paused' },
  { label: '授权过期', value: 'auth_expired' },
  { label: '已取消授权', value: 'revoked' }
];
export const mailboxStatusLabelMap = {
  active: '启用',
  paused: '暂停',
  auth_expired: '授权过期',
  revoked: '已取消授权'
};
export const mailboxStatusTagTypeMap = {
  active: 'success',
  paused: 'warning',
  auth_expired: 'error',
  revoked: 'default'
};
export const mailboxSyncModeLabelMap = {
  full_sync: '完整同步',
  send_only: '仅发信',
  mock_watch: '模拟同步'
};
export const mailboxSyncModeTagTypeMap = {
  full_sync: 'success',
  send_only: 'warning',
  mock_watch: 'info'
};
export const mailboxWarmupLabelMap = {
  new: '新账号',
  warming: '预热中',
  ready: '已就绪'
};
export const mailboxWarmupTagTypeMap = {
  new: 'default',
  warming: 'info',
  ready: 'success'
};
export const mailboxWatchStatusLabelMap = {
  not_started: '未开启',
  expired: '已过期',
  expiring_soon: '即将过期',
  normal: '正常'
};
export const mailboxWatchStatusTagTypeMap = {
  not_started: 'default',
  expired: 'error',
  expiring_soon: 'warning',
  normal: 'success'
};
export const blacklistReasonLabelMap = {
  unsubscribe: '客户退订'
};
/** Create the default blacklist filter object for initial load and reset. */
export function createDefaultBlacklistFilterModel() {
  return {
    keyword: ''
  };
}
/** Create the default mailbox filter object for initial load and reset. */
export function createDefaultMailboxFilterModel() {
  return {
    keyword: '',
    status: null
  };
}
/** Build CRM mailbox list query params from pagination and current filters. */
export function buildMailboxSearchParams(options) {
  const { current, filterModel, size } = options;
  const params = {
    current,
    size
  };
  const keyword = filterModel.keyword.trim();
  if (keyword) {
    params.keyword = keyword;
  }
  if (filterModel.status) {
    params.status = filterModel.status;
  }
  return params;
}
/** Build CRM blacklist query params from pagination and current filters. */
export function buildBlacklistSearchParams(options) {
  const { current, filterModel, size } = options;
  const params = {
    current,
    size
  };
  const keyword = filterModel.keyword.trim();
  if (keyword) {
    params.keyword = keyword;
  }
  return params;
}
/** Format nullable backend ISO datetime for mailbox table display. */
export function formatMailboxDate(value) {
  return value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-';
}
/** Derive receive-sync health from its expiration time. */
export function getMailboxWatchStatus(watchExpiration, now = dayjs()) {
  if (!watchExpiration) {
    return 'not_started';
  }
  const expiration = dayjs(watchExpiration);
  if (!expiration.isAfter(now)) {
    return 'expired';
  }
  // 收信同步 24 小时内到期时提前提示。
  return expiration.diff(now, 'hour', true) <= MAILBOX_WATCH_EXPIRING_SOON_HOURS ? 'expiring_soon' : 'normal';
}
/** Format watch expiration as a short status description. */
export function formatMailboxWatchDescription(watchExpiration) {
  if (!watchExpiration) {
    return '暂无收信同步到期时间';
  }
  return `到期时间 ${formatMailboxDate(watchExpiration)}`;
}
/** Explain whether a mailbox can support the real receive-sync loop. */
export function formatMailboxSyncModeDescription(row) {
  if (row.syncMode === 'send_only') {
    return '仅承诺真实发信，不同步客户回复';
  }
  if (row.syncMode === 'mock_watch') {
    return '缺少真实收信同步，不能视为完整闭环';
  }
  return '可自动同步客户回复';
}
/** Mask Gmail history checkpoint while keeping it recognizable in the table. */
export function formatMailboxHistoryId(value) {
  if (!value) {
    return '未同步';
  }
  return value.length > 8 ? `...${value.slice(-8)}` : value;
}
/** Format sending quotas into a compact table label. */
export function formatMailboxQuota(row) {
  return `${row.dailyLimit}/日 · ${row.hourlyLimit}/时`;
}
/** Label mailbox sync action as recovery when Gmail history checkpoint is expired. */
export function formatMailboxSyncActionLabel(row) {
  return row.lastSyncIssue?.type === 'history_expired' ? '恢复同步' : '立即同步';
}
/** Check whether a mailbox is ready for sequence creation and real reply sync. */
export function isMailboxAvailableForSequence(row, now = dayjs()) {
  return (
    row.status === 'active' &&
    row.syncMode === 'full_sync' &&
    Boolean(row.lastHistoryId) &&
    !row.lastSyncIssue &&
    getMailboxWatchStatus(row.watchExpiration, now) === 'normal'
  );
}
/** Format blacklist table datetime. */
export function formatBlacklistDate(value) {
  return dayjs(value).format('YYYY-MM-DD HH:mm:ss');
}
/** Summarize mailbox sync and watch health for a compact operations header. */
export function summarizeMailboxSyncHealth(records, now = dayjs()) {
  return records.reduce(
    (summary, record) => {
      const watchStatus = getMailboxWatchStatus(record.watchExpiration, now);
      const isFullSync = record.syncMode === 'full_sync';
      summary.total += 1;
      if (record.status === 'auth_expired') {
        summary.authExpired += 1;
      }
      if (isFullSync && watchStatus !== 'normal') {
        summary.watchNeedsAttention += 1;
      }
      if (isFullSync && record.lastHistoryId) {
        summary.synced += 1;
      }
      if (record.lastSyncIssue) {
        summary.syncIssues += 1;
      }
      return summary;
    },
    {
      authExpired: 0,
      syncIssues: 0,
      synced: 0,
      total: 0,
      watchNeedsAttention: 0
    }
  );
}
