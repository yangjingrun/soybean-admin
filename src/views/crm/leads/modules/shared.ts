import dayjs from 'dayjs';

export const leadStatusOptions = [
  { label: '候选线索', value: 'candidate' },
  { label: '缺少联系人', value: 'missing_contact' },
  { label: '邮箱验证中', value: 'email_verification_pending' },
  { label: '待人工复核', value: 'manual_review_pending' },
  { label: '可触达', value: 'ready' },
  { label: '开发信跟进中', value: 'sequence_running' },
  { label: '待处理回复', value: 'replied_pending' },
  { label: '已跟进', value: 'followed_up' },
  { label: '商机', value: 'opportunity' },
  { label: '客户', value: 'customer' },
  { label: '无效', value: 'invalid' },
  { label: '已暂停', value: 'paused' },
  { label: '已阻止', value: 'blocked' },
  { label: '暂不开发', value: 'archived' }
] satisfies Array<{ label: string; value: Api.Crm.CrmAccountStatus }>;

export const crmLeadPageGuide = {
  title: '客户管理承接 AI 获客结果',
  description: '先补齐联系人和邮箱验证；可开发客户创建开发信，暂不开发客户会保留历史记录但移出日常跟进。'
};

export const leadStatusLabelMap: Record<Api.Crm.CrmAccountStatus, string> = {
  candidate: '候选线索',
  missing_contact: '缺少联系人',
  email_verification_pending: '邮箱验证中',
  manual_review_pending: '待人工复核',
  ready: '可触达',
  sequence_running: '开发信跟进中',
  replied_pending: '待处理回复',
  followed_up: '已跟进',
  opportunity: '商机',
  customer: '客户',
  invalid: '无效',
  paused: '已暂停',
  blocked: '已阻止',
  archived: '暂不开发'
};

export const leadStatusTagTypeMap: Record<Api.Crm.CrmAccountStatus, NaiveUI.ThemeColor> = {
  candidate: 'info',
  missing_contact: 'warning',
  email_verification_pending: 'warning',
  manual_review_pending: 'warning',
  ready: 'success',
  sequence_running: 'primary',
  replied_pending: 'info',
  followed_up: 'success',
  opportunity: 'success',
  customer: 'success',
  invalid: 'error',
  paused: 'default',
  blocked: 'error',
  archived: 'default'
};

export interface LeadQueueStat {
  key: 'matched' | 'pending' | 'developable' | 'active';
  label: string;
  value: number;
}

export interface LeadNextAction {
  label: string;
  description: string;
  type: NaiveUI.ThemeColor;
}

const leadPendingStatuses = new Set<Api.Crm.CrmAccountStatus>([
  'candidate',
  'missing_contact',
  'email_verification_pending',
  'manual_review_pending',
  'replied_pending'
]);

const leadDevelopableStatuses = new Set<Api.Crm.CrmAccountStatus>(['ready']);

const leadActiveStatuses = new Set<Api.Crm.CrmAccountStatus>([
  'sequence_running',
  'followed_up',
  'opportunity',
  'customer'
]);

const leadNextActionMap: Record<Api.Crm.CrmAccountStatus, LeadNextAction> = {
  candidate: {
    label: '人工复核',
    description: '确认公司信息和开发优先级',
    type: 'warning'
  },
  missing_contact: {
    label: '缺联系人',
    description: '补齐联系人或重新获取客户信息',
    type: 'warning'
  },
  email_verification_pending: {
    label: '验证邮箱',
    description: '先确认邮箱可达性',
    type: 'warning'
  },
  manual_review_pending: {
    label: '人工复核',
    description: '处理复核结论后再推进',
    type: 'warning'
  },
  ready: {
    label: '创建开发信',
    description: '进入开发信跟进审核',
    type: 'success'
  },
  sequence_running: {
    label: '查看开发信',
    description: '跟踪当前开发信节奏',
    type: 'primary'
  },
  replied_pending: {
    label: '处理回信',
    description: '优先进入客户回信处理',
    type: 'info'
  },
  followed_up: {
    label: '继续跟进',
    description: '按沟通结果推进下一步',
    type: 'success'
  },
  opportunity: {
    label: '维护商机',
    description: '推进需求和成交机会',
    type: 'success'
  },
  customer: {
    label: '维护客户',
    description: '沉淀客户关系和后续机会',
    type: 'success'
  },
  invalid: {
    label: '暂不开发',
    description: '移出日常开发队列',
    type: 'error'
  },
  paused: {
    label: '重新开发',
    description: '确认原因后重新推进',
    type: 'default'
  },
  blocked: {
    label: '暂不开发',
    description: '保留记录并停止开发',
    type: 'error'
  },
  archived: {
    label: '重新开发',
    description: '需要时恢复到候选线索',
    type: 'default'
  }
};

export const leadEmailStatusLabelMap: Record<Api.Crm.CrmEmailStatus, string> = {
  unchecked: '未检查',
  valid: '有效',
  invalid: '无效',
  risky: '有风险',
  unreachable: '不可达',
  unsubscribed: '已退订'
};

export const leadEmailStatusTagTypeMap: Record<Api.Crm.CrmEmailStatus, NaiveUI.ThemeColor> = {
  unchecked: 'default',
  valid: 'success',
  invalid: 'error',
  risky: 'warning',
  unreachable: 'error',
  unsubscribed: 'error'
};

export const leadEnrichmentProviderLabelMap: Record<Api.Crm.LeadEnrichmentProvider, string> = {
  hunter: 'Hunter',
  snovio: 'Snovio'
};

export const leadEnrichmentStatusLabelMap: Record<Api.Crm.LeadEnrichmentStatus, string> = {
  success: '成功',
  failed: '失败'
};

export const leadEnrichmentStatusTagTypeMap: Record<Api.Crm.LeadEnrichmentStatus, NaiveUI.ThemeColor> = {
  success: 'success',
  failed: 'error'
};

export const leadTimelineEventLabelMap: Record<string, string> = {
  account_imported: '账户导入',
  contact_imported: '联系人导入',
  status_changed: '状态变更',
  note_added: '备注',
  account_archived: '暂不开发',
  archived_fingerprint_matched: '历史触达提醒',
  lead_enrichment_refreshed: '重新获取联系人',
  lead_enrichment_refresh_failed: '重新获取联系人失败',
  customer_unsubscribed: '客户退订',
  email_bounced: '邮件退信'
};

export type ArchivedFingerprintType = 'domain' | 'email_hash';

export interface ArchivedFingerprintMatch {
  fingerprintType: ArchivedFingerprintType;
  maskedValue: string | null;
  archivedAt: string;
  accountName: string | null;
}

const archivedFingerprintTypeLabelMap: Record<ArchivedFingerprintType, string> = {
  domain: '域名',
  email_hash: '邮箱'
};

const archivedFingerprintMatchedEventType = 'archived_fingerprint_matched';

/** Create the default lead filter object for initial load and reset. */
export function createDefaultLeadFilterModel(): Api.Crm.LeadFilterModel {
  return {
    keyword: '',
    status: null,
    sourceTaskId: null
  };
}

/** Create the default manual lead import form model. */
export function createDefaultLeadImportForm(): Api.Crm.LeadImportFormModel {
  return {
    name: '',
    websiteUrl: '',
    country: '',
    customerType: '',
    contactFullName: '',
    contactTitle: '',
    contactEmail: ''
  };
}

/** Create a status form model from the current backend status. */
export function createDefaultLeadStatusForm(status?: Api.Crm.CrmAccountStatus) {
  return {
    status: status ?? null,
    remark: ''
  };
}

/** Create the default manual note form model. */
export function createDefaultLeadNoteForm() {
  return {
    content: ''
  };
}

/** Convert the manual lead form into the backend import payload. */
export function normalizeLeadImportPayload(formModel: Api.Crm.LeadImportFormModel): Api.Crm.LeadImportPayload {
  const contact = {
    fullName: formModel.contactFullName.trim(),
    title: formModel.contactTitle.trim(),
    email: formModel.contactEmail.trim()
  };
  const hasContact = Boolean(contact.fullName || contact.title || contact.email);

  return {
    name: formModel.name.trim(),
    websiteUrl: formModel.websiteUrl.trim(),
    country: formModel.country.trim(),
    customerType: formModel.customerType.trim(),
    ...(hasContact ? { contact } : {})
  };
}

/** Build CRM lead list query params from pagination and current filters. */
export function buildLeadSearchParams(options: {
  current: number;
  size: number;
  filterModel: Api.Crm.LeadFilterModel;
}): Api.Crm.LeadSearchParams {
  const { current, filterModel, size } = options;
  const params: Api.Crm.LeadSearchParams = {
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

  const sourceTaskId = filterModel.sourceTaskId?.trim();

  if (sourceTaskId) {
    params.sourceTaskId = sourceTaskId;
  }

  return params;
}

/** Build queue-oriented stats from the currently loaded leads and backend matched total. */
export function buildLeadQueueStats(records: Api.Crm.LeadRecord[], total: number): LeadQueueStat[] {
  return [
    {
      key: 'matched',
      label: '匹配客户',
      value: total
    },
    {
      key: 'pending',
      label: '待处理',
      value: records.filter(record => leadPendingStatuses.has(record.status)).length
    },
    {
      key: 'developable',
      label: '可开发',
      value: records.filter(record => leadDevelopableStatuses.has(record.status)).length
    },
    {
      key: 'active',
      label: '跟进中',
      value: records.filter(record => leadActiveStatuses.has(record.status)).length
    }
  ];
}

/** Describe the next human action for one lead status. */
export function getLeadNextAction(status: Api.Crm.CrmAccountStatus) {
  return leadNextActionMap[status];
}

/** Format backend ISO datetime for the lead table. */
export function formatLeadDate(value: string) {
  return dayjs(value).format('YYYY-MM-DD HH:mm:ss');
}

/** Format optional backend text for compact descriptions. */
export function formatLeadText(value: string | null | undefined) {
  return value || '-';
}

/** Read the timeline label from known event types, falling back to the backend title. */
export function formatLeadTimelineTitle(event: Api.Crm.LeadTimelineEvent) {
  return event.title || leadTimelineEventLabelMap[event.eventType] || event.eventType;
}

/** Read only the backend archived-fingerprint reminder event from account timeline. */
export function getArchivedFingerprintMatchEvents(events: Api.Crm.LeadTimelineEvent[]) {
  return events.filter(event => event.eventType === archivedFingerprintMatchedEventType);
}

/** Read archived fingerprint metadata that is already returned on the timeline event. */
export function readArchivedFingerprintMatches(event: Api.Crm.LeadTimelineEvent): ArchivedFingerprintMatch[] {
  const metadata = event.metadata as { matchedFingerprints?: ArchivedFingerprintMatch[] } | null;

  if (!metadata?.matchedFingerprints) {
    return [];
  }

  return metadata.matchedFingerprints;
}

/** Format an archived fingerprint type for compact reminder chips. */
export function formatArchivedFingerprintTypeLabel(type: ArchivedFingerprintType) {
  return archivedFingerprintTypeLabelMap[type];
}

/** Highlight product-critical reminder events in the lead timeline. */
export function getLeadTimelineItemType(event: Api.Crm.LeadTimelineEvent) {
  return event.eventType === archivedFingerprintMatchedEventType ? 'warning' : 'default';
}

/** Normalize website text into a clickable href without changing displayed backend data. */
export function getWebsiteHref(value: string) {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

/** Format lead website text for compact table display. */
export function formatLeadWebsiteDisplay(input: Pick<Api.Crm.LeadRecord, 'websiteUrl' | 'domain'>) {
  if (input.domain) return input.domain;
  if (!input.websiteUrl) return '-';

  return new URL(getWebsiteHref(input.websiteUrl)).hostname;
}
