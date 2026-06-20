import dayjs, { type Dayjs } from 'dayjs';
import { aiDraftTaskStatusLabelMap, aiDraftTaskStatusTagTypeMap, formatAiDraftTaskCounts } from './ai-draft-queue-settings';
import { emailTemplateThreadModeLabelMap } from './email-template-settings';
import {
  formatMailboxDate,
  formatMailboxHistoryId,
  formatMailboxWatchDescription,
  getMailboxWatchStatus,
  mailboxStatusLabelMap,
  mailboxSyncModeLabelMap,
  mailboxWatchStatusLabelMap
} from './mailbox-settings';

export type OperationMessageStatus = Extract<Api.Crm.MessageStatus, 'queued' | 'failed'> | 'scheduled';
export type OperationLogCategory = 'webhook' | 'history' | 'watch' | 'send' | 'aiDraft';

interface OperationLogEvent {
  category: OperationLogCategory;
  action: string;
  summary: string;
  failureReason: string;
  maskedEmail: string;
  jobId: string;
  statusLabel: string;
  tagType: NaiveUI.ThemeColor;
  rawTime: string | null;
}

export interface OperationQueueRow {
  id: string;
  accountName: string;
  contactName: string;
  mailboxLabel: string;
  subject: string;
  stepIndex: number;
  threadMode: Api.Crm.MessageThreadMode;
  status: OperationMessageStatus;
  bullJobId: string | null;
  runVersion: number;
  providerMessageId: string | null;
  providerThreadId: string | null;
  scheduledAt: string | null;
  sentAt: string | null;
  updatedAt: string;
}

export interface OperationDetailItem {
  label: string;
  value: string;
}

export interface OperationLogSummaryRow {
  category: OperationLogCategory;
  categoryLabel: string;
  statusLabel: string;
  tagType: NaiveUI.ThemeColor;
  summary: string;
  failureReason: string;
  time: string;
  maskedEmail: string;
  jobId: string;
  action: string;
  count: number;
  empty: boolean;
}
export interface StrategyStatSection {
  key: Api.Crm.StrategyStatDimension;
  title: string;
  empty: boolean;
  rows: Api.Crm.StrategyStatRow[];
}

export const operationMessageStatusLabelMap: Record<OperationMessageStatus, string> = {
  scheduled: '待调度',
  queued: '队列中',
  failed: '发送失败'
};

export const operationMessageStatusTagTypeMap: Record<OperationMessageStatus, NaiveUI.ThemeColor> = {
  scheduled: 'warning',
  queued: 'info',
  failed: 'error'
};

export const operationLogLevelLabelMap: Record<Api.SystemLog.LogLevel, string> = {
  info: '信息',
  warn: '警告',
  error: '错误'
};

export const operationLogLevelTagTypeMap: Record<Api.SystemLog.LogLevel, NaiveUI.ThemeColor> = {
  info: 'info',
  warn: 'warning',
  error: 'error'
};

export const operationLogStatusLabelMap: Record<Api.SystemLog.LogStatus, string> = {
  processing: '处理中',
  success: '成功',
  failed: '失败'
};

export const operationLogStatusTagTypeMap: Record<Api.SystemLog.LogStatus, NaiveUI.ThemeColor> = {
  processing: 'warning',
  success: 'success',
  failed: 'error'
};
export const operationLogCategoryLabelMap: Record<OperationLogCategory, string> = {
  webhook: 'Webhook',
  history: 'History',
  watch: 'Watch',
  send: 'Send',
  aiDraft: 'AI 草稿'
};

export const operationLogCategoryEmptyTextMap: Record<OperationLogCategory, string> = {
  webhook: '暂无 webhook system-log，当前仅可从 History 入队结果侧面观察',
  history: '暂无 History 同步异常或日志',
  watch: '暂无 Watch 续订或授权日志',
  send: '暂无发送队列或发送 worker 日志',
  aiDraft: '暂无批量 AI 草稿任务'
};

const operationLogCategoryOrder: OperationLogCategory[] = ['webhook', 'history', 'watch', 'send', 'aiDraft'];
const strategyStatDimensionOrder: Api.Crm.StrategyStatDimension[] = ['template', 'policy', 'persona', 'productLine'];

export const strategyStatDimensionTitleMap: Record<Api.Crm.StrategyStatDimension, string> = {
  template: '模板效果',
  policy: '策略效果',
  persona: '画像效果',
  productLine: '产品线效果'
};

const sensitiveMetadataKeys = new Set([
  'apikey',
  'api_key',
  'authorization',
  'authheader',
  'access_token',
  'accesstoken',
  'client_secret',
  'clientsecret',
  'cookie',
  'setcookie',
  'refresh_token',
  'refreshtoken',
  'secret',
  'token',
  'password',
  'passwordhash',
  'passwordsalt',
  'body',
  'bodytext',
  'bodyhtml',
  'emailbody',
  'messagebody'
]);

/** Format nullable operation table datetime. */
export function formatOperationDate(value: string | null) {
  return value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-';
}

/** Build the field list used by the send queue operation detail drawer. */
export function buildOperationQueueDetailItems(row: OperationQueueRow): OperationDetailItem[] {
  return [
    { label: '状态', value: operationMessageStatusLabelMap[row.status] },
    { label: '客户', value: row.accountName },
    { label: '联系人', value: row.contactName },
    { label: '发送邮箱', value: row.mailboxLabel },
    { label: '邮件主题', value: row.subject || '-' },
    { label: '步骤', value: `第 ${row.stepIndex} 封` },
    { label: '线程方式', value: emailTemplateThreadModeLabelMap[row.threadMode] },
    { label: '队列 Job', value: row.bullJobId || '-' },
    { label: '运行版本', value: `run v${row.runVersion}` },
    { label: 'Gmail Thread', value: row.providerThreadId || '-' },
    { label: '计划发送', value: formatOperationDate(row.scheduledAt) },
    { label: '实际发送', value: formatOperationDate(row.sentAt) },
    { label: '更新时间', value: formatOperationDate(row.updatedAt) }
  ];
}

/** Build the field list used by the AI draft task operation detail drawer. */
export function buildAiDraftTaskOperationDetailItems(row: Api.Crm.AiDraftTaskRecord): OperationDetailItem[] {
  return [
    { label: '状态', value: aiDraftTaskStatusLabelMap[row.status] },
    { label: '任务编号', value: row.id },
    { label: '请求数量', value: `${row.requestedCount}` },
    { label: '生成结果', value: formatAiDraftTaskCounts(row) },
    { label: '排队中', value: `${row.pendingCount}` },
    { label: '生成中', value: `${row.runningCount}` },
    { label: '待重试', value: `${row.retryingCount}` },
    { label: '实际并发', value: `${row.effectiveConcurrency}` },
    { label: '最大尝试', value: `${row.maxAttempts}` },
    { label: 'BullMQ Job', value: row.bullJobId || '-' },
    { label: '失败原因', value: row.failureReason || '-' },
    { label: '创建时间', value: formatOperationDate(row.createdAt) },
    { label: '完成时间', value: formatOperationDate(row.finishedAt) },
    { label: '更新时间', value: formatOperationDate(row.updatedAt) }
  ];
}

/** Build the field list used by the mailbox sync operation detail drawer. */
export function buildMailboxOperationDetailItems(
  row: Api.Crm.MailboxRecord,
  now: Dayjs = dayjs()
): OperationDetailItem[] {
  const watchStatus = getMailboxWatchStatus(row.watchExpiration, now);

  return [
    { label: '邮箱', value: row.maskedEmail },
    { label: '负责人', value: row.ownerUserName || row.ownerUserId },
    { label: '授权状态', value: mailboxStatusLabelMap[row.status] },
    { label: '闭环模式', value: mailboxSyncModeLabelMap[row.syncMode] },
    { label: 'Gmail watch', value: mailboxWatchStatusLabelMap[watchStatus] },
    { label: 'Watch 到期', value: formatMailboxWatchDescription(row.watchExpiration) },
    { label: 'History checkpoint', value: formatMailboxHistoryId(row.lastHistoryId) },
    { label: '同步问题', value: row.lastSyncIssue?.message ?? '-' },
    { label: '问题时间', value: row.lastSyncIssue ? formatOperationDate(row.lastSyncIssue.happenedAt) : '-' },
    { label: '更新时间', value: formatMailboxDate(row.updatedAt ?? null) }
  ];
}

/** Build the field list used by the CRM operation log detail drawer. */
export function buildOperationLogDetailItems(row: Api.SystemLog.SystemLogRecord): OperationDetailItem[] {
  return [
    { label: '等级', value: operationLogLevelLabelMap[row.level] },
    { label: '状态', value: operationLogStatusLabelMap[row.status] },
    { label: '模块', value: row.module },
    { label: '动作', value: row.action },
    { label: '摘要', value: row.message },
    { label: '操作人', value: row.userName || row.userId || '-' },
    { label: '错误', value: row.errorMessage || row.errorCode || '-' },
    { label: 'Metadata', value: formatOperationMetadata(row.metadata) || '-' },
    { label: '时间', value: formatOperationDate(row.createdAt) }
  ];
}

/** Build a four-category operations summary from existing CRM/system-log data only. */
export function buildOperationLogSummaryRows(options: {
  aiDraftTasks?: Api.Crm.AiDraftTaskRecord[];
  logs: Api.SystemLog.SystemLogRecord[];
  mailboxes: Api.Crm.MailboxRecord[];
  queueRows: OperationQueueRow[];
}): OperationLogSummaryRow[] {
  const events = [
    ...options.logs.map(toOperationLogEvent).filter((event): event is OperationLogEvent => Boolean(event)),
    ...options.mailboxes.flatMap(toMailboxHistoryEvents),
    ...options.queueRows.map(toQueueOperationEvent),
    ...(options.aiDraftTasks ?? []).map(toAiDraftTaskOperationEvent)
  ].toSorted(compareOperationLogEvents);

  return operationLogCategoryOrder.map(category => {
    const categoryEvents = events.filter(event => event.category === category);
    const latest = categoryEvents[0];

    if (!latest) {
      return {
        category,
        categoryLabel: operationLogCategoryLabelMap[category],
        statusLabel: '暂无',
        tagType: 'default',
        summary: operationLogCategoryEmptyTextMap[category],
        failureReason: '-',
        time: '-',
        maskedEmail: '-',
        jobId: '-',
        action: '-',
        count: 0,
        empty: true
      };
    }

    return {
      category,
      categoryLabel: operationLogCategoryLabelMap[category],
      statusLabel: latest.statusLabel,
      tagType: latest.tagType,
      summary: latest.summary,
      failureReason: latest.failureReason,
      time: formatOperationDate(latest.rawTime),
      maskedEmail: latest.maskedEmail,
      jobId: latest.jobId,
      action: latest.action,
      count: categoryEvents.length,
      empty: false
    };
  });
}

/** Builds the fixed CRM local strategy stat sections shown on the settings page. */
export function buildStrategyStatSections(stats: Api.Crm.StrategyStats, limit = 5): StrategyStatSection[] {
  return strategyStatDimensionOrder.map(key => {
    const rows = [...(stats.rows[key] ?? [])]
      .sort((left, right) => {
        if (right.sequenceCount !== left.sequenceCount) return right.sequenceCount - left.sequenceCount;
        return left.name.localeCompare(right.name);
      })
      .slice(0, limit);

    return {
      key,
      title: strategyStatDimensionTitleMap[key],
      empty: rows.length === 0,
      rows
    };
  });
}

/** Flatten sequence review items into the queue rows that need operational attention. */
export function collectOperationQueueRows(items: Api.Crm.SequenceReviewItem[], limit = 8): OperationQueueRow[] {
  return items
    .flatMap(item =>
      item.messages
        .filter(message => isOperationQueueMessage(item.enrollment.status, message))
        .map(message => ({
          id: message.id,
          accountName: item.account.name,
          contactName: item.contact.fullName || item.contact.email || '-',
          mailboxLabel: item.mailbox?.maskedEmail ?? '-',
          subject: message.subject,
          stepIndex: message.stepIndex,
          threadMode: message.threadMode,
          status: resolveOperationMessageStatus(item.enrollment.status, message),
          bullJobId: message.bullJobId,
          runVersion: item.enrollment.runVersion,
          providerMessageId: message.providerMessageId,
          providerThreadId: message.providerThreadId,
          scheduledAt: message.scheduledAt,
          sentAt: message.sentAt,
          updatedAt: message.updatedAt
        }))
    )
    .sort(compareOperationQueueRows)
    .slice(0, limit);
}

/** Keep only recent CRM module system logs for the operations panel. */
export function collectRecentCrmOperationLogs(records: Api.SystemLog.SystemLogRecord[], limit = 6) {
  return records
    .filter(record => record.module === 'crm')
    .toSorted((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, limit);
}

function isOperationQueueMessage(
  enrollmentStatus: Api.Crm.SequenceEnrollmentStatus,
  message: Api.Crm.MessageRecord
): message is Api.Crm.MessageRecord & {
  status: Extract<Api.Crm.MessageStatus, 'draft_ready' | 'queued' | 'failed'>;
} {
  return (
    message.status === 'queued' ||
    message.status === 'failed' ||
    (message.status === 'draft_ready' && Boolean(message.scheduledAt) && enrollmentStatus === 'sequence_running')
  );
}

function resolveOperationMessageStatus(
  enrollmentStatus: Api.Crm.SequenceEnrollmentStatus,
  message: Api.Crm.MessageRecord
): OperationMessageStatus {
  if (message.status === 'draft_ready' && message.scheduledAt && enrollmentStatus === 'sequence_running') {
    return 'scheduled';
  }

  return message.status === 'failed' ? 'failed' : 'queued';
}

function compareOperationQueueRows(left: OperationQueueRow, right: OperationQueueRow) {
  if (left.status !== right.status) {
    return getOperationMessageStatusPriority(left.status) - getOperationMessageStatusPriority(right.status);
  }

  return right.updatedAt.localeCompare(left.updatedAt);
}

function getOperationMessageStatusPriority(status: OperationMessageStatus) {
  const priorityMap: Record<OperationMessageStatus, number> = {
    failed: 0,
    queued: 1,
    scheduled: 2
  };

  return priorityMap[status];
}

function formatOperationMetadata(metadata: Record<string, unknown> | null) {
  const safeMetadata = sanitizeOperationMetadata(metadata);

  return safeMetadata ? JSON.stringify(safeMetadata, null, 2) : '';
}

function toOperationLogEvent(record: Api.SystemLog.SystemLogRecord): OperationLogEvent | null {
  const category = resolveOperationLogCategory(record);

  if (!category) {
    return null;
  }

  return {
    category,
    action: record.action,
    summary: record.message,
    failureReason: resolveOperationFailureReason(record),
    maskedEmail: getMetadataString(record.metadata, 'maskedEmail'),
    jobId: resolveOperationJobId(record.metadata),
    statusLabel: operationLogStatusLabelMap[record.status],
    tagType: operationLogStatusTagTypeMap[record.status],
    rawTime: record.createdAt
  };
}

function toMailboxHistoryEvents(mailbox: Api.Crm.MailboxRecord): OperationLogEvent[] {
  if (!mailbox.lastSyncIssue) {
    return [];
  }

  return [
    {
      category: 'history',
      action: mailbox.lastSyncIssue.type,
      summary: mailbox.lastSyncIssue.message,
      failureReason: mailbox.lastSyncIssue.message,
      maskedEmail: mailbox.maskedEmail,
      jobId: '-',
      statusLabel: '失败',
      tagType: 'error',
      rawTime: mailbox.lastSyncIssue.happenedAt
    }
  ];
}

function toQueueOperationEvent(row: OperationQueueRow): OperationLogEvent {
  return {
    category: 'send',
    action: `message-${row.status}`,
    summary: `${row.accountName} / ${row.contactName}`,
    failureReason: row.status === 'failed' ? operationMessageStatusLabelMap[row.status] : '-',
    maskedEmail: row.mailboxLabel,
    jobId: row.bullJobId || '-',
    statusLabel: operationMessageStatusLabelMap[row.status],
    tagType: operationMessageStatusTagTypeMap[row.status],
    rawTime: row.updatedAt
  };
}

function toAiDraftTaskOperationEvent(row: Api.Crm.AiDraftTaskRecord): OperationLogEvent {
  return {
    category: 'aiDraft',
    action: `task-${row.status}`,
    summary: `请求 ${row.requestedCount} 条，${formatAiDraftTaskCounts(row)}`,
    failureReason: row.failureReason || '-',
    maskedEmail: '-',
    jobId: row.bullJobId || '-',
    statusLabel: aiDraftTaskStatusLabelMap[row.status],
    tagType: aiDraftTaskStatusTagTypeMap[row.status],
    rawTime: row.updatedAt
  };
}

function resolveOperationLogCategory(record: Api.SystemLog.SystemLogRecord): OperationLogCategory | null {
  const text = `${record.action} ${record.message}`.toLowerCase();

  if (text.includes('webhook') || text.includes('pubsub')) {
    return 'webhook';
  }

  if (text.includes('history')) {
    return 'history';
  }

  if (text.includes('watch') || text.includes('auth')) {
    return 'watch';
  }

  if (text.includes('ai draft') || text.includes('aidraft') || text.includes('草稿任务')) {
    return 'aiDraft';
  }

  if (text.includes('send') || text.includes('worker') || text.includes('job')) {
    return 'send';
  }

  return null;
}

function resolveOperationFailureReason(record: Api.SystemLog.SystemLogRecord) {
  if (record.errorMessage || record.errorCode) {
    return record.errorMessage || record.errorCode || '-';
  }

  const reason = getMetadataString(record.metadata, 'reason');

  if (reason !== '-') {
    return reason;
  }

  return record.status === 'failed' ? record.message : '-';
}

function resolveOperationJobId(metadata: Record<string, unknown> | null) {
  const jobId = getMetadataString(metadata, 'jobId');

  return jobId !== '-' ? jobId : getMetadataString(metadata, 'pubsubMessageId');
}

function getMetadataString(metadata: Record<string, unknown> | null, key: string) {
  const value = metadata?.[key];

  return typeof value === 'string' && value ? value : '-';
}

function compareOperationLogEvents(left: OperationLogEvent, right: OperationLogEvent) {
  return (right.rawTime ?? '').localeCompare(left.rawTime ?? '');
}

function sanitizeOperationMetadata(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(item => sanitizeOperationMetadata(item));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([key]) => !sensitiveMetadataKeys.has(key.toLowerCase()))
    .map(([key, item]) => [key, sanitizeOperationMetadata(item)]);

  return Object.fromEntries(entries);
}
