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

/** Create the default lead filter object for initial load and reset. */
export function createDefaultLeadFilterModel(): Api.Crm.LeadFilterModel {
  return {
    keyword: '',
    status: null
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

/** Normalize website text into a clickable href without changing displayed backend data. */
export function getWebsiteHref(value: string) {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}
