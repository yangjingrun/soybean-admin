import dayjs from 'dayjs';

export const leadStatusOptions = [
  { label: '候选线索', value: 'candidate' },
  { label: '缺少联系人', value: 'missing_contact' },
  { label: '邮箱验证中', value: 'email_verification_pending' },
  { label: '待人工复核', value: 'manual_review_pending' },
  { label: '可触达', value: 'ready' },
  { label: '邮件序列中', value: 'sequence_running' },
  { label: '待处理回复', value: 'replied_pending' },
  { label: '已跟进', value: 'followed_up' },
  { label: '商机', value: 'opportunity' },
  { label: '客户', value: 'customer' },
  { label: '无效', value: 'invalid' },
  { label: '已暂停', value: 'paused' },
  { label: '已阻止', value: 'blocked' },
  { label: '已归档', value: 'archived' }
] satisfies Array<{ label: string; value: Api.Crm.CrmAccountStatus }>;

export const leadStatusLabelMap: Record<Api.Crm.CrmAccountStatus, string> = {
  candidate: '候选线索',
  missing_contact: '缺少联系人',
  email_verification_pending: '邮箱验证中',
  manual_review_pending: '待人工复核',
  ready: '可触达',
  sequence_running: '邮件序列中',
  replied_pending: '待处理回复',
  followed_up: '已跟进',
  opportunity: '商机',
  customer: '客户',
  invalid: '无效',
  paused: '已暂停',
  blocked: '已阻止',
  archived: '已归档'
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

export const leadTimelineEventLabelMap: Record<string, string> = {
  account_imported: '账户导入',
  contact_imported: '联系人导入',
  status_changed: '状态变更',
  note_added: '备注',
  account_archived: '归档',
  customer_unsubscribed: '客户退订',
  email_bounced: '邮件退信'
};

/** Create the default lead filter object for initial load and reset. */
export function createDefaultLeadFilterModel(): Api.Crm.LeadFilterModel {
  return {
    keyword: '',
    status: null
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

  return params;
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

/** Normalize website text into a clickable href without changing displayed backend data. */
export function getWebsiteHref(value: string) {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}
