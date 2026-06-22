export type AssistantQueueKey = 'recommended' | 'following' | 'replied' | 'needs_data' | 'paused' | 'archived';

export interface AssistantQueueTab {
  key: AssistantQueueKey;
  label: string;
  description: string;
}

export interface AssistantQueueView {
  key: AssistantQueueKey;
  label: string;
  description: string;
  records: Api.Crm.LeadRecord[];
}

export interface AssistantLeadAction {
  label: string;
  description: string;
  type: NaiveUI.ThemeColor;
}

export interface AssistantCapacitySummary {
  dailyLimit: number;
  recommendedCount: number;
  followingCount: number;
  repliedCount: number;
  needsDataCount: number;
  pausedCount: number;
  archivedCount: number;
  totalCount: number;
}

export const assistantQueueTabs: AssistantQueueTab[] = [
  {
    key: 'recommended',
    label: '今日推荐',
    description: '已经具备基本开发条件，适合人工确认后开始跟进。'
  },
  {
    key: 'following',
    label: '跟进中',
    description: '已经进入开发信节奏，等待发送、回复或下一步动作。'
  },
  {
    key: 'replied',
    label: '有回复',
    description: '客户已有回复，需要优先处理。'
  },
  {
    key: 'needs_data',
    label: '待补全',
    description: '缺联系人、邮箱验证或人工复核，暂不直接开发。'
  },
  {
    key: 'paused',
    label: '已暂停',
    description: '被人工或规则暂停，可确认后恢复。'
  },
  {
    key: 'archived',
    label: '已归档',
    description: '暂不开发、无效、阻止或历史原因保留记录。'
  }
];

const queueLabelMap = Object.fromEntries(assistantQueueTabs.map(tab => [tab.key, tab.label])) as Record<
  AssistantQueueKey,
  string
>;

const queueDescriptionMap = Object.fromEntries(assistantQueueTabs.map(tab => [tab.key, tab.description])) as Record<
  AssistantQueueKey,
  string
>;

const recommendedStatuses = new Set<Api.Crm.CrmAccountStatus>(['ready']);
const followingStatuses = new Set<Api.Crm.CrmAccountStatus>([
  'sequence_running',
  'followed_up',
  'opportunity',
  'customer'
]);
const repliedStatuses = new Set<Api.Crm.CrmAccountStatus>(['replied_pending']);
const needsDataStatuses = new Set<Api.Crm.CrmAccountStatus>([
  'candidate',
  'missing_contact',
  'email_verification_pending',
  'manual_review_pending'
]);
const archivedStatuses = new Set<Api.Crm.CrmAccountStatus>(['invalid', 'blocked', 'archived']);

const assistantLeadActionMap: Record<Api.Crm.CrmAccountStatus, AssistantLeadAction> = {
  candidate: {
    label: '补齐信息',
    description: '先确认公司是否匹配，再补联系人或邮箱。',
    type: 'warning'
  },
  missing_contact: {
    label: '补联系人',
    description: '缺少可开发联系人，建议重新补全。',
    type: 'warning'
  },
  email_verification_pending: {
    label: '验证邮箱',
    description: '邮箱还没验证，先确认可达性。',
    type: 'warning'
  },
  manual_review_pending: {
    label: '人工复核',
    description: '需要确认公司和联系人是否值得开发。',
    type: 'warning'
  },
  ready: {
    label: '开始跟进',
    description: '可以生成首封开发信草稿。',
    type: 'success'
  },
  sequence_running: {
    label: '查看跟进',
    description: '客户正在开发信节奏中。',
    type: 'primary'
  },
  replied_pending: {
    label: '处理回复',
    description: '客户已经回复，请优先处理。',
    type: 'info'
  },
  followed_up: {
    label: '继续跟进',
    description: '已有跟进记录，按沟通结果推进。',
    type: 'success'
  },
  opportunity: {
    label: '推进商机',
    description: '已经形成机会，继续维护需求。',
    type: 'success'
  },
  customer: {
    label: '维护客户',
    description: '客户已沉淀，继续维护关系。',
    type: 'success'
  },
  invalid: {
    label: '查看原因',
    description: '该客户暂不适合开发。',
    type: 'error'
  },
  paused: {
    label: '恢复确认',
    description: '确认暂停原因后再恢复开发。',
    type: 'default'
  },
  blocked: {
    label: '已阻止',
    description: '命中阻止规则，不建议继续开发。',
    type: 'error'
  },
  archived: {
    label: '已归档',
    description: '当前不在日常开发队列中。',
    type: 'default'
  }
};

/** Map one CRM account status into the assistant queue shown to ordinary users. */
export function resolveAssistantQueueKey(status: Api.Crm.CrmAccountStatus): AssistantQueueKey {
  if (recommendedStatuses.has(status)) return 'recommended';
  if (followingStatuses.has(status)) return 'following';
  if (repliedStatuses.has(status)) return 'replied';
  if (needsDataStatuses.has(status)) return 'needs_data';
  if (status === 'paused') return 'paused';
  if (archivedStatuses.has(status)) return 'archived';

  return 'needs_data';
}

/** Build queue tab view models from CRM account records. */
export function buildAssistantQueueViews(records: Api.Crm.LeadRecord[]): AssistantQueueView[] {
  return assistantQueueTabs.map(tab => ({
    ...tab,
    records: records.filter(record => resolveAssistantQueueKey(record.status) === tab.key)
  }));
}

/** Summarize capacity and queue counts without pretending to own backend quota bookkeeping. */
export function buildAssistantCapacitySummary(
  records: Api.Crm.LeadRecord[],
  sendPreference?: Pick<Api.Crm.SendPreference, 'dailySendLimit'> | null
): AssistantCapacitySummary {
  const queueKeys = records.map(record => resolveAssistantQueueKey(record.status));

  return {
    dailyLimit: sendPreference?.dailySendLimit ?? 0,
    recommendedCount: queueKeys.filter(key => key === 'recommended').length,
    followingCount: queueKeys.filter(key => key === 'following').length,
    repliedCount: queueKeys.filter(key => key === 'replied').length,
    needsDataCount: queueKeys.filter(key => key === 'needs_data').length,
    pausedCount: queueKeys.filter(key => key === 'paused').length,
    archivedCount: queueKeys.filter(key => key === 'archived').length,
    totalCount: records.length
  };
}

/** Describe the next visible action for one assistant customer card. */
export function getAssistantLeadAction(status: Api.Crm.CrmAccountStatus): AssistantLeadAction {
  return assistantLeadActionMap[status];
}

/** Create a concise recommendation reason from current CRM record fields. */
export function buildAssistantRecommendationReason(record: Api.Crm.LeadRecord): string {
  const parts = [record.customerType, record.country, record.domain].filter(Boolean);

  if (parts.length === 0) {
    return '系统已将该客户沉淀到客户库，建议查看详情后决定是否开发。';
  }

  return `匹配信号：${parts.join(' / ')}。建议结合联系人和历史动态确认优先级。`;
}

/** Return queue label for compact chips and drawer title copy. */
export function getAssistantQueueLabel(key: AssistantQueueKey): string {
  return queueLabelMap[key];
}

/** Return queue explanation for the active tab. */
export function getAssistantQueueDescription(key: AssistantQueueKey): string {
  return queueDescriptionMap[key];
}
