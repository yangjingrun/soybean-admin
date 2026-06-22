import dayjs from 'dayjs';
import {
  aiDraftTaskStatusLabelMap,
  aiDraftTaskStatusTagTypeMap,
  formatAiDraftTaskCounts
} from './ai-draft-queue-settings';
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
export const operationMessageStatusLabelMap = {
  scheduled: '待调度',
  queued: '队列中',
  failed: '发送失败'
};
export const operationMessageStatusTagTypeMap = {
  scheduled: 'warning',
  queued: 'info',
  failed: 'error'
};
export const operationLogLevelLabelMap = {
  info: '信息',
  warn: '警告',
  error: '错误'
};
export const operationLogLevelTagTypeMap = {
  info: 'info',
  warn: 'warning',
  error: 'error'
};
export const operationLogStatusLabelMap = {
  processing: '处理中',
  success: '成功',
  failed: '失败'
};
export const operationLogStatusTagTypeMap = {
  processing: 'warning',
  success: 'success',
  failed: 'error'
};
export const operationLogCategoryLabelMap = {
  webhook: 'Webhook',
  history: 'History',
  watch: 'Watch',
  send: 'Send',
  aiDraft: 'AI 草稿'
};
export const operationLogCategoryEmptyTextMap = {
  webhook: '暂无 webhook system-log，当前仅可从 History 入队结果侧面观察',
  history: '暂无 History 同步异常或日志',
  watch: '暂无 Watch 续订或授权日志',
  send: '暂无发送队列或发送 worker 日志',
  aiDraft: '暂无批量 AI 草稿任务'
};
const operationLogCategoryOrder = ['webhook', 'history', 'watch', 'send', 'aiDraft'];
const strategyStatDimensionOrder = ['template', 'policy', 'persona', 'productLine'];
export const strategyStatDimensionTitleMap = {
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
export function formatOperationDate(value) {
  return value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-';
}
/** Build the field list used by the send queue operation detail drawer. */
export function buildOperationQueueDetailItems(row) {
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
export function buildAiDraftTaskOperationDetailItems(row) {
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
export function buildMailboxOperationDetailItems(row, now = dayjs()) {
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
export function buildOperationLogDetailItems(row) {
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
export function buildOperationLogSummaryRows(options) {
  const events = [
    ...options.logs.map(toOperationLogEvent).filter(event => Boolean(event)),
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
export function buildStrategyStatSections(stats, limit = 5) {
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
export function collectOperationQueueRows(items, limit = 8) {
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
export function collectRecentCrmOperationLogs(records, limit = 6) {
  return records
    .filter(record => record.module === 'crm')
    .toSorted((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, limit);
}
function isOperationQueueMessage(enrollmentStatus, message) {
  return (
    message.status === 'queued' ||
    message.status === 'failed' ||
    (message.status === 'draft_ready' && Boolean(message.scheduledAt) && enrollmentStatus === 'sequence_running')
  );
}
function resolveOperationMessageStatus(enrollmentStatus, message) {
  if (message.status === 'draft_ready' && message.scheduledAt && enrollmentStatus === 'sequence_running') {
    return 'scheduled';
  }
  return message.status === 'failed' ? 'failed' : 'queued';
}
function compareOperationQueueRows(left, right) {
  if (left.status !== right.status) {
    return getOperationMessageStatusPriority(left.status) - getOperationMessageStatusPriority(right.status);
  }
  return right.updatedAt.localeCompare(left.updatedAt);
}
function getOperationMessageStatusPriority(status) {
  const priorityMap = {
    failed: 0,
    queued: 1,
    scheduled: 2
  };
  return priorityMap[status];
}
function formatOperationMetadata(metadata) {
  const safeMetadata = sanitizeOperationMetadata(metadata);
  return safeMetadata ? JSON.stringify(safeMetadata, null, 2) : '';
}
function toOperationLogEvent(record) {
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
function toMailboxHistoryEvents(mailbox) {
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
function toQueueOperationEvent(row) {
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
function toAiDraftTaskOperationEvent(row) {
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
function resolveOperationLogCategory(record) {
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
function resolveOperationFailureReason(record) {
  if (record.errorMessage || record.errorCode) {
    return record.errorMessage || record.errorCode || '-';
  }
  const reason = getMetadataString(record.metadata, 'reason');
  if (reason !== '-') {
    return reason;
  }
  return record.status === 'failed' ? record.message : '-';
}
function resolveOperationJobId(metadata) {
  const jobId = getMetadataString(metadata, 'jobId');
  return jobId !== '-' ? jobId : getMetadataString(metadata, 'pubsubMessageId');
}
function getMetadataString(metadata, key) {
  const value = metadata?.[key];
  return typeof value === 'string' && value ? value : '-';
}
function compareOperationLogEvents(left, right) {
  return (right.rawTime ?? '').localeCompare(left.rawTime ?? '');
}
function sanitizeOperationMetadata(value) {
  if (Array.isArray(value)) {
    return value.map(item => sanitizeOperationMetadata(item));
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  const entries = Object.entries(value)
    .filter(([key]) => !sensitiveMetadataKeys.has(key.toLowerCase()))
    .map(([key, item]) => [key, sanitizeOperationMetadata(item)]);
  return Object.fromEntries(entries);
}
