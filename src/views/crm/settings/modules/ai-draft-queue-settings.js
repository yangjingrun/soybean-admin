export const aiDraftTaskStatusLabelMap = {
  queued: '排队中',
  running: '生成中',
  completed: '已完成',
  failed: '有失败',
  cancelled: '已取消'
};
export const aiDraftTaskStatusTagTypeMap = {
  queued: 'info',
  running: 'warning',
  completed: 'success',
  failed: 'error',
  cancelled: 'default'
};
export const aiDraftTaskItemStatusLabelMap = {
  pending: '待生成',
  running: '生成中',
  retrying: '待重试',
  succeeded: '已生成',
  skipped: '已跳过',
  failed: '失败'
};
export const aiDraftTaskItemStatusTagTypeMap = {
  pending: 'default',
  running: 'warning',
  retrying: 'info',
  succeeded: 'success',
  skipped: 'default',
  failed: 'error'
};
/** Create the default super-admin AI draft queue config form. */
export function createDefaultAiDraftQueueConfigForm() {
  return {
    itemConcurrency: 3,
    maxItemConcurrency: 5,
    maxActiveTasksPerUser: 1,
    maxActiveTasksPerOrg: 3,
    maxAttempts: 3,
    retryBackoffSecondsText: '30,60,120'
  };
}
/** Convert backend AI draft queue config into the editable form model. */
export function createAiDraftQueueConfigFormFromRecord(record) {
  return {
    itemConcurrency: record.itemConcurrency,
    maxItemConcurrency: record.maxItemConcurrency,
    maxActiveTasksPerUser: record.maxActiveTasksPerUser,
    maxActiveTasksPerOrg: record.maxActiveTasksPerOrg,
    maxAttempts: record.maxAttempts,
    retryBackoffSecondsText: (record.retryBackoffSeconds ?? []).join(',')
  };
}
function isPositiveInteger(value) {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}
/** Parse comma separated retry backoff seconds from the super-admin form. */
export function parseAiDraftRetryBackoffSeconds(text) {
  return text
    .split(',')
    .map(item => Number(item.trim()))
    .filter(item => Number.isInteger(item) && item > 0);
}
/** Check whether the AI draft queue config form can be saved. */
export function validateAiDraftQueueConfigForm(form) {
  if (!isPositiveInteger(form.itemConcurrency)) return '请输入大于 0 的默认并发';
  if (!isPositiveInteger(form.maxItemConcurrency)) return '请输入大于 0 的最大并发';
  if (!isPositiveInteger(form.maxActiveTasksPerUser)) return '请输入大于 0 的用户任务上限';
  if (!isPositiveInteger(form.maxActiveTasksPerOrg)) return '请输入大于 0 的组织任务上限';
  if (!isPositiveInteger(form.maxAttempts)) return '请输入大于 0 的失败重试次数';
  if (form.itemConcurrency > form.maxItemConcurrency) {
    return '默认并发不能大于最大并发';
  }
  const retryBackoffSeconds = parseAiDraftRetryBackoffSeconds(form.retryBackoffSecondsText);
  return retryBackoffSeconds.length > 0 ? null : '请填写至少一个重试间隔秒数';
}
/** Build the backend payload for saving the AI draft queue config. */
export function normalizeAiDraftQueueConfigPayload(form) {
  return {
    itemConcurrency: form.itemConcurrency ?? 3,
    maxItemConcurrency: form.maxItemConcurrency ?? 5,
    maxActiveTasksPerUser: form.maxActiveTasksPerUser ?? 1,
    maxActiveTasksPerOrg: form.maxActiveTasksPerOrg ?? 3,
    maxAttempts: form.maxAttempts ?? 3,
    retryBackoffSeconds: parseAiDraftRetryBackoffSeconds(form.retryBackoffSecondsText)
  };
}
/** Format one AI draft task count group for operation tables. */
export function formatAiDraftTaskCounts(row) {
  return `${row.successCount} 成功 / ${row.skippedCount} 跳过 / ${row.failedCount} 失败`;
}
/** Get whether an AI draft task still occupies queue resources. */
export function isActiveAiDraftTask(row) {
  return row.status === 'queued' || row.status === 'running';
}
