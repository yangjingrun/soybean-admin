import dayjs, { type Dayjs } from 'dayjs';

const MAILBOX_WATCH_EXPIRING_SOON_HOURS = 24;

export type MailboxWatchStatus = 'not_started' | 'expired' | 'expiring_soon' | 'normal';

export const mailboxStatusOptions = [
  { label: '启用', value: 'active' },
  { label: '暂停', value: 'paused' },
  { label: '授权过期', value: 'auth_expired' }
] satisfies Array<{ label: string; value: Api.Crm.MailboxStatus }>;

export const mailboxStatusLabelMap: Record<Api.Crm.MailboxStatus, string> = {
  active: '启用',
  paused: '暂停',
  auth_expired: '授权过期'
};

export const mailboxStatusTagTypeMap: Record<Api.Crm.MailboxStatus, NaiveUI.ThemeColor> = {
  active: 'success',
  paused: 'warning',
  auth_expired: 'error'
};

export const mailboxWarmupLabelMap: Record<Api.Crm.MailboxWarmupStage, string> = {
  new: '新账号',
  warming: '预热中',
  ready: '已就绪'
};

export const mailboxWarmupTagTypeMap: Record<Api.Crm.MailboxWarmupStage, NaiveUI.ThemeColor> = {
  new: 'default',
  warming: 'info',
  ready: 'success'
};

export const mailboxWatchStatusLabelMap: Record<MailboxWatchStatus, string> = {
  not_started: '未开启',
  expired: '已过期',
  expiring_soon: '即将过期',
  normal: '正常'
};

export const mailboxWatchStatusTagTypeMap: Record<MailboxWatchStatus, NaiveUI.ThemeColor> = {
  not_started: 'default',
  expired: 'error',
  expiring_soon: 'warning',
  normal: 'success'
};

export const productLineStatusOptions = [
  { label: '启用', value: 'active' },
  { label: '已归档', value: 'archived' }
] satisfies Array<{ label: string; value: Api.Crm.ProductLineStatus }>;

export const productLineStatusLabelMap: Record<Api.Crm.ProductLineStatus, string> = {
  active: '启用',
  archived: '已归档'
};

export const productLineStatusTagTypeMap: Record<Api.Crm.ProductLineStatus, NaiveUI.ThemeColor> = {
  active: 'success',
  archived: 'default'
};

export const blacklistReasonLabelMap: Record<Api.Crm.BlacklistRecord['reason'], string> = {
  unsubscribe: '客户退订'
};

/** Create the default platform-wide CRM config form. */
export function createDefaultGlobalConfigForm(): Api.Crm.GlobalConfigFormModel {
  return {
    emailVerificationCooldownDays: 30
  };
}

/** Create the default blacklist filter object for initial load and reset. */
export function createDefaultBlacklistFilterModel(): Api.Crm.BlacklistFilterModel {
  return {
    keyword: ''
  };
}

/** Create the default mailbox filter object for initial load and reset. */
export function createDefaultMailboxFilterModel(): Api.Crm.MailboxFilterModel {
  return {
    keyword: '',
    status: null
  };
}

/** Create the default product line filter object for initial load and reset. */
export function createDefaultProductLineFilterModel(): Api.Crm.ProductLineFilterModel {
  return {
    keyword: '',
    status: null
  };
}

/** Create an empty product line form model. */
export function createDefaultProductLineForm(): Api.Crm.ProductLineFormModel {
  return {
    name: '',
    targetCustomerType: '',
    coreSellingPoints: '',
    moq: '',
    leadTime: '',
    paymentTerms: '',
    certifications: '',
    catalogUrl: '',
    websiteUrl: '',
    commonModelsText: ''
  };
}

/** Convert a product line record into the editable form model. */
export function createProductLineFormFromRecord(record: Api.Crm.ProductLineRecord): Api.Crm.ProductLineFormModel {
  return {
    name: record.name,
    targetCustomerType: record.targetCustomerType ?? '',
    coreSellingPoints: record.coreSellingPoints ?? '',
    moq: record.moq ?? '',
    leadTime: record.leadTime ?? '',
    paymentTerms: record.paymentTerms ?? '',
    certifications: record.certifications ?? '',
    catalogUrl: record.catalogUrl ?? '',
    websiteUrl: record.websiteUrl ?? '',
    commonModelsText: record.commonModelsText ?? ''
  };
}

/** Build CRM mailbox list query params from pagination and current filters. */
export function buildMailboxSearchParams(options: {
  current: number;
  size: number;
  filterModel: Api.Crm.MailboxFilterModel;
}): Api.Crm.MailboxSearchParams {
  const { current, filterModel, size } = options;
  const params: Api.Crm.MailboxSearchParams = {
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

/** Build CRM blacklist query params from pagination and current filters. */
export function buildBlacklistSearchParams(options: {
  current: number;
  size: number;
  filterModel: Api.Crm.BlacklistFilterModel;
}): Api.Crm.BlacklistSearchParams {
  const { current, filterModel, size } = options;
  const params: Api.Crm.BlacklistSearchParams = {
    current,
    size
  };
  const keyword = filterModel.keyword.trim();

  if (keyword) {
    params.keyword = keyword;
  }

  return params;
}

/** Build CRM product line list query params from pagination and current filters. */
export function buildProductLineSearchParams(options: {
  current: number;
  size: number;
  filterModel: Api.Crm.ProductLineFilterModel;
}): Api.Crm.ProductLineSearchParams {
  const { current, filterModel, size } = options;
  const params: Api.Crm.ProductLineSearchParams = {
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

/** Trim all product line form fields before submit. */
export function normalizeProductLinePayload(formModel: Api.Crm.ProductLineFormModel): Api.Crm.ProductLinePayload {
  return {
    name: formModel.name.trim(),
    targetCustomerType: formModel.targetCustomerType.trim(),
    coreSellingPoints: formModel.coreSellingPoints.trim(),
    moq: formModel.moq.trim(),
    leadTime: formModel.leadTime.trim(),
    paymentTerms: formModel.paymentTerms.trim(),
    certifications: formModel.certifications.trim(),
    catalogUrl: formModel.catalogUrl.trim(),
    websiteUrl: formModel.websiteUrl.trim(),
    commonModelsText: formModel.commonModelsText.trim()
  };
}

/** Check whether the platform email verification cache cooldown can be saved. */
export function isValidEmailVerificationCooldownDays(value: number | null): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 365;
}

/** Format nullable backend ISO datetime for mailbox table display. */
export function formatMailboxDate(value: string | null) {
  return value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-';
}

/** Derive Gmail watch health from its expiration time. */
export function getMailboxWatchStatus(watchExpiration: string | null, now: Dayjs = dayjs()): MailboxWatchStatus {
  if (!watchExpiration) {
    return 'not_started';
  }

  const expiration = dayjs(watchExpiration);

  if (!expiration.isAfter(now)) {
    return 'expired';
  }

  // Gmail watch 24 小时内到期时提前提示。
  return expiration.diff(now, 'hour', true) <= MAILBOX_WATCH_EXPIRING_SOON_HOURS ? 'expiring_soon' : 'normal';
}

/** Format watch expiration as a short status description. */
export function formatMailboxWatchDescription(watchExpiration: string | null) {
  if (!watchExpiration) {
    return '暂无 watch 到期时间';
  }

  return `到期时间 ${formatMailboxDate(watchExpiration)}`;
}

/** Mask Gmail history checkpoint while keeping it recognizable in the table. */
export function formatMailboxHistoryId(value: string | null) {
  if (!value) {
    return '未同步';
  }

  return value.length > 8 ? `...${value.slice(-8)}` : value;
}

/** Format sending quotas into a compact table label. */
export function formatMailboxQuota(row: Pick<Api.Crm.MailboxRecord, 'dailyLimit' | 'hourlyLimit'>) {
  return `${row.dailyLimit}/日 · ${row.hourlyLimit}/时`;
}

/** Format product line table datetime. */
export function formatProductLineDate(value: string) {
  return dayjs(value).format('YYYY-MM-DD HH:mm:ss');
}

/** Format blacklist table datetime. */
export function formatBlacklistDate(value: string) {
  return dayjs(value).format('YYYY-MM-DD HH:mm:ss');
}

/** Join MOQ and lead time into one compact table cell. */
export function formatProductLineSupply(row: Pick<Api.Crm.ProductLineRecord, 'moq' | 'leadTime'>) {
  return [row.moq, row.leadTime].filter(Boolean).join(' / ') || '-';
}
