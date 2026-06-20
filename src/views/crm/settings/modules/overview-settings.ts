import type { Dayjs } from 'dayjs';
import { summarizeMailboxSyncHealth } from './mailbox-settings';

export type CrmSettingsOverviewKey = 'mailbox' | 'template' | 'sendRule' | 'attention';

export interface CrmSettingsOverviewItem {
  key: CrmSettingsOverviewKey;
  label: string;
  value: string;
  description: string;
  tagType: NaiveUI.ThemeColor;
}
/** Build the user-facing overview cards for the CRM settings entry page. */
export function buildCrmSettingsOverview(options: {
  mailboxes: Api.Crm.MailboxRecord[];
  mailboxTotal: number;
  templateDefaults: Api.Crm.TemplateDefaults | null;
  now?: Dayjs;
}): CrmSettingsOverviewItem[] {
  const activeMailboxCount = options.mailboxes.filter(record => record.status === 'active').length;
  const mailboxTotal = Math.max(options.mailboxTotal, options.mailboxes.length);
  const health = summarizeMailboxSyncHealth(options.mailboxes, options.now);
  const attentionCount = health.authExpired + health.syncIssues;
  const templateStepCount = options.templateDefaults?.templateGroup.steps.length ?? 0;

  return [
    {
      key: 'mailbox',
      label: '可发送邮箱',
      value: `${activeMailboxCount} / ${mailboxTotal}`,
      description: '当前列表中的启用邮箱 / 当前筛选总数',
      tagType: activeMailboxCount > 0 ? 'success' : 'warning'
    },
    {
      key: 'template',
      label: '默认模板',
      value: options.templateDefaults?.templateGroup.name ?? '未配置',
      description: options.templateDefaults ? '新建开发信会优先使用该模板' : '需要先配置默认邮件模板',
      tagType: options.templateDefaults ? 'success' : 'warning'
    },
    {
      key: 'sendRule',
      label: '发送序列',
      value: templateStepCount > 0 ? `${templateStepCount} 步序列` : '未配置',
      description: '首封和后续跟进信的默认节奏',
      tagType: templateStepCount > 0 ? 'info' : 'warning'
    },
    {
      key: 'attention',
      label: '需要处理',
      value: `${attentionCount} 项`,
      description: '授权过期和同步异常会影响发信闭环',
      tagType: attentionCount > 0 ? 'warning' : 'success'
    }
  ];
}
