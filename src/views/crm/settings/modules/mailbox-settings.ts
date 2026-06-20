import dayjs, { type Dayjs } from 'dayjs';

const MAILBOX_WATCH_EXPIRING_SOON_HOURS = 24;

export type MailboxWatchStatus = 'not_started' | 'expired' | 'expiring_soon' | 'normal';
export interface MailboxSyncHealthSummary {
  total: number;
  authExpired: number;
  syncIssues: number;
  watchNeedsAttention: number;
  synced: number;
}
export const mailboxStatusOptions = [
  { label: '启用', value: 'active' },
  { label: '暂停', value: 'paused' },
  { label: '授权过期', value: 'auth_expired' }
] satisfies Array<{ label: string; value: Api.Crm.MailboxStatus }>;

export const mailboxStatusLabelMap: Record<Api.Crm.MailboxStatus, string> = {
  active: '启用',
  paused: '暂停',
  auth_expired: '授权过期'
};

export const mailboxStatusTagTypeMap: Record<Api.Crm.MailboxStatus, NaiveUI.ThemeColor> = {
  active: 'success',
  paused: 'warning',
  auth_expired: 'error'
};

export const mailboxSyncModeLabelMap: Record<Api.Crm.MailboxSyncMode, string> = {
  full_sync: '完整同步',
  send_only: '仅发信',
  mock_watch: 'Mock Watch'
};

export const mailboxSyncModeTagTypeMap: Record<Api.Crm.MailboxSyncMode, NaiveUI.ThemeColor> = {
  full_sync: 'success',
  send_only: 'warning',
  mock_watch: 'info'
};

export const mailboxWarmupLabelMap: Record<Api.Crm.MailboxWarmupStage, string> = {
  new: '新账号',
  warming: '预热中',
  ready: '已就绪'
};

export const mailboxWarmupTagTypeMap: Record<Api.Crm.MailboxWarmupStage, NaiveUI.ThemeColor> = {
  new: 'default',
  warming: 'info',
  ready: 'success'
};

export const mailboxWatchStatusLabelMap: Record<MailboxWatchStatus, string> = {
  not_started: '未开启',
  expired: '已过期',
  expiring_soon: '即将过期',
  normal: '正常'
};

export const mailboxWatchStatusTagTypeMap: Record<MailboxWatchStatus, NaiveUI.ThemeColor> = {
  not_started: 'default',
  expired: 'error',
  expiring_soon: 'warning',
  normal: 'success'
};

export const blacklistReasonLabelMap: Record<Api.Crm.BlacklistRecord['reason'], string> = {
  unsubscribe: '客户退订'
};
/** Create the default blacklist filter object for initial load and reset. */
export function createDefaultBlacklistFilterModel(): Api.Crm.BlacklistFilterModel {
  return {
    keyword: ''
  };
}

/** Create the default mailbox filter object for initial load and reset. */
export function createDefaultMailboxFilterModel(): Api.Crm.MailboxFilterModel {
  return {
    keyword: '',
    status: null
  };
}

/** Build CRM mailbox list query params from pagination and current filters. */
export function buildMailboxSearchParams(options: {
  current: number;
  size: number;
  filterModel: Api.Crm.MailboxFilterModel;
}): Api.Crm.MailboxSearchParams {
  const { current, filterModel, size } = options;
  const params: Api.Crm.MailboxSearchParams = {
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
export function buildBlacklistSearchParams(options: {
  current: number;
  size: number;
  filterModel: Api.Crm.BlacklistFilterModel;
}): Api.Crm.BlacklistSearchParams {
  const { current, filterModel, size } = options;
  const params: Api.Crm.BlacklistSearchParams = {
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
export function formatMailboxDate(value: string | null) {
  return value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-';
}

/** Derive Gmail watch health from its expiration time. */
export function getMailboxWatchStatus(watchExpiration: string | null, now: Dayjs = dayjs()): MailboxWatchStatus {
  if (!watchExpiration) {
    return 'not_started';
  }

  const expiration = dayjs(watchExpiration);

  if (!expiration.isAfter(now)) {
    return 'expired';
  }

  // Gmail watch 24 小时内到期时提前提示。
  return expiration.diff(now, 'hour', true) <= MAILBOX_WATCH_EXPIRING_SOON_HOURS ? 'expiring_soon' : 'normal';
}

/** Format watch expiration as a short status description. */
export function formatMailboxWatchDescription(watchExpiration: string | null) {
  if (!watchExpiration) {
    return '暂无 watch 到期时间';
  }

  return `到期时间 ${formatMailboxDate(watchExpiration)}`;
}

/** Explain whether a mailbox can support the real receive-sync loop. */
export function formatMailboxSyncModeDescription(row: Pick<Api.Crm.MailboxRecord, 'syncMode'>) {
  if (row.syncMode === 'send_only') {
    return '仅承诺真实发信，不同步客户回复';
  }

  if (row.syncMode === 'mock_watch') {
    return '缺少真实 Pub/Sub watch，不能视为完整闭环';
  }

  return '可接入 Gmail history 增量同步';
}

/** Mask Gmail history checkpoint while keeping it recognizable in the table. */
export function formatMailboxHistoryId(value: string | null) {
  if (!value) {
    return '未同步';
  }

  return value.length > 8 ? `...${value.slice(-8)}` : value;
}

/** Format sending quotas into a compact table label. */
export function formatMailboxQuota(row: Pick<Api.Crm.MailboxRecord, 'dailyLimit' | 'hourlyLimit'>) {
  return `${row.dailyLimit}/日 · ${row.hourlyLimit}/时`;
}

/** Label mailbox sync action as recovery when Gmail history checkpoint is expired. */
export function formatMailboxSyncActionLabel(row: Pick<Api.Crm.MailboxRecord, 'lastSyncIssue'>) {
  return row.lastSyncIssue?.type === 'history_expired' ? '恢复同步' : '立即同步';
}

/** Check whether a mailbox is ready for sequence creation and real reply sync. */
export function isMailboxAvailableForSequence(row: Api.Crm.MailboxRecord, now: Dayjs = dayjs()) {
  return (
    row.status === 'active' &&
    row.syncMode === 'full_sync' &&
    Boolean(row.lastHistoryId) &&
    !row.lastSyncIssue &&
    getMailboxWatchStatus(row.watchExpiration, now) === 'normal'
  );
}

/** Format blacklist table datetime. */
export function formatBlacklistDate(value: string) {
  return dayjs(value).format('YYYY-MM-DD HH:mm:ss');
}

/** Summarize mailbox sync and watch health for a compact operations header. */
export function summarizeMailboxSyncHealth(
  records: Api.Crm.MailboxRecord[],
  now: Dayjs = dayjs()
): MailboxSyncHealthSummary {
  return records.reduce<MailboxSyncHealthSummary>(
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
