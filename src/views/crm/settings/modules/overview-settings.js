import { getMailboxWatchStatus, summarizeMailboxSyncHealth } from './mailbox-settings';
/** Format the sync-health checklist hint from concrete attention items. */
function formatAttentionDescription(parts) {
  return parts.length > 0 ? `${parts.join('，')}；会影响回信入库和停发闭环` : 'Gmail 授权、watch 和 History 同步均正常';
}
/** Count active full-sync mailboxes whose Gmail watch cannot support the reply loop. */
function countActiveWatchIssues(records, now) {
  return records.filter(
    record =>
      record.status === 'active' &&
      record.syncMode === 'full_sync' &&
      getMailboxWatchStatus(record.watchExpiration, now) !== 'normal'
  ).length;
}
/** Build the user-facing overview cards for the CRM settings entry page. */
export function buildCrmSettingsOverview(options) {
  const activeMailboxCount = options.mailboxes.filter(record => record.status === 'active').length;
  const mailboxTotal = Math.max(options.mailboxTotal, options.mailboxes.length);
  const health = summarizeMailboxSyncHealth(options.mailboxes, options.now);
  const templateStepCount = options.templateDefaults?.templateGroup.steps.length ?? 0;
  const activeWatchIssues = countActiveWatchIssues(options.mailboxes, options.now);
  const syncAttentionParts = [
    health.authExpired > 0 ? `${health.authExpired} 个 Gmail 授权过期` : '',
    activeWatchIssues > 0 ? `${activeWatchIssues} 个 Gmail watch 异常` : '',
    health.syncIssues > 0 ? `${health.syncIssues} 个同步异常` : ''
  ].filter(Boolean);
  const syncAttentionCount = health.authExpired + activeWatchIssues + health.syncIssues;
  return [
    {
      key: 'mailboxConnection',
      label: '邮箱连接',
      statusLabel: activeMailboxCount > 0 ? '已连接' : '缺邮箱',
      value: activeMailboxCount > 0 ? `${activeMailboxCount} / ${mailboxTotal} 可用` : '未连接',
      description: '缺少可用 Gmail 授权时，开发信无法进入发送队列',
      tagType: activeMailboxCount > 0 ? 'success' : 'warning'
    },
    {
      key: 'writingProfile',
      label: '写信资料',
      statusLabel: options.templateDefaults ? '已配置' : '缺模板',
      value: options.templateDefaults?.templateGroup.name ?? '未配置',
      description: options.templateDefaults
        ? '默认模板会给新建开发信提供首封和跟进内容'
        : '缺少默认模板时，新建开发信没有可用写信资料',
      tagType: options.templateDefaults ? 'success' : 'warning'
    },
    {
      key: 'sendPace',
      label: '发送节奏',
      statusLabel: templateStepCount > 0 ? '已配置' : '缺节奏',
      value: templateStepCount > 0 ? `${templateStepCount} 步序列` : '未配置',
      description:
        templateStepCount > 0
          ? `当前默认模板包含 ${templateStepCount} 封，按配置节奏推进跟进`
          : '缺少发送节奏时，首封后的跟进链路无法自动推进',
      tagType: templateStepCount > 0 ? 'success' : 'warning'
    },
    {
      key: 'safetyBlock',
      label: '安全拦截',
      statusLabel: '已启用',
      value: '退订黑名单',
      description: '退订、归档指纹和邮箱验证规则会在发送前参与拦截',
      tagType: 'info'
    },
    {
      key: 'syncHealth',
      label: '同步健康',
      statusLabel: syncAttentionCount > 0 ? '待处理' : '正常',
      value: syncAttentionCount > 0 ? `${syncAttentionCount} 项待处理` : '正常',
      description: formatAttentionDescription(syncAttentionParts),
      tagType: syncAttentionCount > 0 ? 'warning' : 'success'
    }
  ];
}
