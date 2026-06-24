import dayjs from 'dayjs';
import { getCrmRegionKeywords } from '@/utils/crm-region-cascader';

export const leadStatusOptions = [
  { label: '候选线索', value: 'candidate' },
  { label: '缺少联系人', value: 'missing_contact' },
  { label: '邮箱验证中', value: 'email_verification_pending' },
  { label: '待人工复核', value: 'manual_review_pending' },
  { label: '可触达', value: 'ready' },
  { label: '开发中', value: 'sequence_running' },
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
  title: '客户开发台承接 AI 获客结果',
  description: '以公司管理客户、以联系人推进触达；可开发联系人生成开发信后，可直接查看邮箱进度和调度信息。'
};

export const leadStatusLabelMap: Record<Api.Crm.CrmAccountStatus, string> = {
  candidate: '候选线索',
  missing_contact: '缺少联系人',
  email_verification_pending: '邮箱验证中',
  manual_review_pending: '待人工复核',
  ready: '可触达',
  sequence_running: '开发中',
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

export type LeadCommunicationTab = 'overview' | 'sequence' | 'inbox' | 'schedule' | 'profile';

export interface LeadNextAction {
  label: string;
  description: string;
  type: NaiveUI.ThemeColor;
}

export type LeadExpandedContactStatus = 'idle' | 'loading' | 'loaded' | 'error';

export interface LeadExpandedContactView {
  status: LeadExpandedContactStatus;
  contacts: Api.Crm.LeadContact[];
}

export interface LeadEmailProgressView {
  label: string;
  timeText: string;
  tagType: NaiveUI.ThemeColor;
}

export interface LeadSequenceTarget {
  accountId: string;
  accountName: string;
  contactId: string;
  contactName: string;
  contactTitle: string;
  maskedEmail: string;
}

export type LeadRowContactView =
  | {
      type: 'empty';
      primaryContact: null;
    }
  | {
      type: 'single';
      primaryContact: Api.Crm.LeadContact;
    }
  | {
      type: 'multiple';
      primaryContact: Api.Crm.LeadContact | null;
      count: number;
    };

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
    label: '创建开发任务',
    description: '检查邮件后加入发送队列',
    type: 'success'
  },
  sequence_running: {
    label: '查看开发任务',
    description: '检查待处理邮件和发送进度',
    type: 'primary'
  },
  replied_pending: {
    label: '处理回信',
    description: '优先进入客户回信处理',
    type: 'info'
  },
  followed_up: {
    label: '继续跟进',
    description: '按沟通结果推进后续动作',
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

const leadEmailProgressTagTypeMap: Record<Api.Crm.ContactEmailProgressStatus, NaiveUI.ThemeColor> = {
  not_generated: 'default',
  draft_pending_review: 'warning',
  draft_ready: 'info',
  queued: 'primary',
  sent: 'success',
  failed: 'error',
  skipped: 'default',
  replied: 'warning'
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
  contact_created: '新增联系人',
  contact_updated: '更新联系人',
  contact_deleted: '删除联系人',
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
    contactTitle: '',
    customerType: '',
    region: '',
    status: null,
    sourceTaskId: null,
    updatedAtRange: null
  };
}

/** Create the default manual lead import form model. */
export function createDefaultLeadImportForm(): Api.Crm.LeadImportFormModel {
  return {
    name: '',
    websiteUrl: '',
    country: '',
    city: '',
    address: '',
    timeZone: '',
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
    city: formModel.city.trim(),
    address: formModel.address.trim(),
    timeZone: formModel.timeZone.trim(),
    customerType: formModel.customerType.trim(),
    ...(hasContact ? { contact } : {})
  };
}

/** Build a trimmed account profile update payload from the edit form. */
export function buildLeadAccountUpdatePayload(
  formModel: Api.Crm.LeadAccountUpdatePayload
): Api.Crm.LeadAccountUpdatePayload {
  return {
    name: formModel.name.trim(),
    normalizedName: formModel.normalizedName.trim(),
    websiteUrl: formModel.websiteUrl?.trim(),
    country: formModel.country?.trim(),
    city: formModel.city?.trim(),
    address: formModel.address?.trim(),
    timeZone: formModel.timeZone?.trim(),
    customerType: formModel.customerType?.trim()
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

  const contactTitle = filterModel.contactTitle?.trim();

  if (contactTitle) {
    params.contactTitle = contactTitle;
  }

  const customerType = filterModel.customerType?.trim();

  if (customerType) {
    params.customerType = customerType;
  }

  const region = filterModel.region?.trim();

  if (region) {
    const regionKeywords = getCrmRegionKeywords(region);

    if (regionKeywords.length) {
      params.regionKeywords = regionKeywords.join(',');
    } else {
      params.region = region;
    }
  }

  if (filterModel.status) {
    params.status = filterModel.status;
  }

  if (filterModel.updatedAtRange) {
    const [start, end] = filterModel.updatedAtRange;
    params.updatedFrom = dayjs(start).startOf('day').toISOString();
    params.updatedTo = dayjs(end).endOf('day').toISOString();
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

/** Derive the expanded contact table view from the cached account detail request state. */
export function buildLeadExpandedContactView(options: {
  accountId: string;
  detail?: Api.Crm.LeadDetail | null;
  loadingIds: string[];
  failedIds: string[];
}): LeadExpandedContactView {
  if (options.loadingIds.includes(options.accountId)) {
    return {
      status: 'loading',
      contacts: []
    };
  }

  if (options.failedIds.includes(options.accountId)) {
    return {
      status: 'error',
      contacts: []
    };
  }

  if (options.detail) {
    return {
      status: 'loaded',
      contacts: options.detail.contacts
    };
  }

  return {
    status: 'idle',
    contacts: []
  };
}

/** Decide how contacts should appear in one account list row. */
export function buildLeadRowContactView(
  record: Pick<Api.Crm.LeadRecord, 'contactCount' | 'primaryContact'>
): LeadRowContactView {
  if (record.contactCount <= 0) {
    return {
      type: 'empty',
      primaryContact: null
    };
  }

  if (record.contactCount === 1 && record.primaryContact) {
    return {
      type: 'single',
      primaryContact: record.primaryContact
    };
  }

  return {
    type: 'multiple',
    primaryContact: record.primaryContact,
    count: record.contactCount
  };
}

/** Contacts that opted out or failed verification should not start new outreach. */
export function canCreateSequenceFromLeadContact(contact: Api.Crm.LeadContact) {
  return !['invalid', 'unreachable', 'unsubscribed'].includes(contact.emailStatus);
}

/** Build the readonly target shown before creating first-email drafts from the customer page. */
export function buildLeadSequenceTarget(
  contact: Api.Crm.LeadContact,
  account: Pick<Api.Crm.LeadRecord, 'id' | 'name'> | null | undefined
): LeadSequenceTarget {
  return {
    accountId: contact.accountId,
    accountName: account?.name || '当前客户',
    contactId: contact.id,
    contactName: contact.fullName || contact.maskedEmail || contact.email,
    contactTitle: contact.title || '-',
    maskedEmail: contact.maskedEmail || contact.email
  };
}

/** Collect selectable primary contacts from checked customer rows. */
export function buildLeadSequenceTargetsFromCheckedRows(
  records: Api.Crm.LeadRecord[],
  checkedRowKeys: string[]
): LeadSequenceTarget[] {
  const checkedSet = new Set(checkedRowKeys);

  return records.reduce<LeadSequenceTarget[]>((targets, record) => {
    if (
      !checkedSet.has(record.id) ||
      !record.primaryContact ||
      !canCreateSequenceFromLeadContact(record.primaryContact)
    ) {
      return targets;
    }

    targets.push(buildLeadSequenceTarget(record.primaryContact, record));

    return targets;
  }, []);
}

/** Describe the next human action for one lead status. */
export function getLeadNextAction(status: Api.Crm.CrmAccountStatus) {
  return leadNextActionMap[status];
}

/** Format backend ISO datetime for the lead table. */
export function formatLeadDate(value: string) {
  return dayjs(value).format('YYYY-MM-DD HH:mm:ss');
}

/** Format nullable backend ISO datetime for email progress displays. */
export function formatLeadProgressTime(value: string | null | undefined) {
  return value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-';
}

/** Build the contact-level email progress view shown by the customer table and modal. */
export function buildLeadEmailProgressView(contact: Api.Crm.LeadContact): LeadEmailProgressView {
  return {
    label: contact.emailProgressLabel || '首封待生成',
    timeText: formatLeadProgressTime(contact.emailProgressAt),
    tagType: leadEmailProgressTagTypeMap[contact.emailProgressStatus] ?? 'default'
  };
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
