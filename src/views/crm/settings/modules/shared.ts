import dayjs, { type Dayjs } from 'dayjs';

const MAILBOX_WATCH_EXPIRING_SOON_HOURS = 24;

export type MailboxWatchStatus = 'not_started' | 'expired' | 'expiring_soon' | 'normal';
export type OperationMessageStatus = Extract<Api.Crm.MessageStatus, 'queued' | 'failed'>;
export type OperationLogCategory = 'webhook' | 'history' | 'watch' | 'send';

interface OperationLogEvent {
  category: OperationLogCategory;
  action: string;
  summary: string;
  failureReason: string;
  maskedEmail: string;
  jobId: string;
  statusLabel: string;
  tagType: NaiveUI.ThemeColor;
  rawTime: string | null;
}

export interface OperationQueueRow {
  id: string;
  accountName: string;
  contactName: string;
  mailboxLabel: string;
  subject: string;
  stepIndex: number;
  threadMode: Api.Crm.MessageThreadMode;
  status: OperationMessageStatus;
  bullJobId: string | null;
  runVersion: number;
  providerMessageId: string | null;
  providerThreadId: string | null;
  scheduledAt: string | null;
  sentAt: string | null;
  updatedAt: string;
}

export interface OperationDetailItem {
  label: string;
  value: string;
}

export interface OperationLogSummaryRow {
  category: OperationLogCategory;
  categoryLabel: string;
  statusLabel: string;
  tagType: NaiveUI.ThemeColor;
  summary: string;
  failureReason: string;
  time: string;
  maskedEmail: string;
  jobId: string;
  action: string;
  count: number;
  empty: boolean;
}

export interface MailboxSyncHealthSummary {
  total: number;
  authExpired: number;
  syncIssues: number;
  watchNeedsAttention: number;
  synced: number;
}

export interface StrategyStatSection {
  key: Api.Crm.StrategyStatDimension;
  title: string;
  empty: boolean;
  rows: Api.Crm.StrategyStatRow[];
}

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

export const operationMessageStatusLabelMap: Record<OperationMessageStatus, string> = {
  queued: '队列中',
  failed: '发送失败'
};

export const operationMessageStatusTagTypeMap: Record<OperationMessageStatus, NaiveUI.ThemeColor> = {
  queued: 'info',
  failed: 'error'
};

export const operationLogLevelLabelMap: Record<Api.SystemLog.LogLevel, string> = {
  info: '信息',
  warn: '警告',
  error: '错误'
};

export const operationLogLevelTagTypeMap: Record<Api.SystemLog.LogLevel, NaiveUI.ThemeColor> = {
  info: 'info',
  warn: 'warning',
  error: 'error'
};

export const operationLogStatusLabelMap: Record<Api.SystemLog.LogStatus, string> = {
  processing: '处理中',
  success: '成功',
  failed: '失败'
};

export const operationLogStatusTagTypeMap: Record<Api.SystemLog.LogStatus, NaiveUI.ThemeColor> = {
  processing: 'warning',
  success: 'success',
  failed: 'error'
};

export const operationLogCategoryLabelMap: Record<OperationLogCategory, string> = {
  webhook: 'Webhook',
  history: 'History',
  watch: 'Watch',
  send: 'Send'
};

export const operationLogCategoryEmptyTextMap: Record<OperationLogCategory, string> = {
  webhook: '暂无 webhook system-log，当前仅可从 History 入队结果侧面观察',
  history: '暂无 History 同步异常或日志',
  watch: '暂无 Watch 续订或授权日志',
  send: '暂无发送队列或发送 worker 日志'
};

const operationLogCategoryOrder: OperationLogCategory[] = ['webhook', 'history', 'watch', 'send'];
const strategyStatDimensionOrder: Api.Crm.StrategyStatDimension[] = ['template', 'policy', 'persona', 'productLine'];

export const strategyStatDimensionTitleMap: Record<Api.Crm.StrategyStatDimension, string> = {
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

export const productLineStatusOptions = [
  { label: '启用', value: 'active' },
  { label: '已归档', value: 'archived' }
] satisfies Array<{ label: string; value: Api.Crm.ProductLineStatus }>;

export const emailTemplateStatusOptions = [
  { label: '启用', value: 'active' },
  { label: '已归档', value: 'archived' }
] satisfies Array<{ label: string; value: Api.Crm.EmailTemplateStatus }>;

export const personaProfileStatusOptions = [
  { label: '启用', value: 'active' },
  { label: '已归档', value: 'archived' }
] satisfies Array<{ label: string; value: Api.Crm.PersonaProfileStatus }>;

export const sequencePolicyStatusOptions = [
  { label: '启用', value: 'active' },
  { label: '已归档', value: 'archived' }
] satisfies Array<{ label: string; value: Api.Crm.SequencePolicyStatus }>;

export const emailTemplateThreadModeOptions = [
  { label: '新主题', value: 'new_subject' },
  { label: '同线程', value: 'same_thread' }
] satisfies Array<{ label: string; value: Api.Crm.MessageThreadMode }>;

export const sequencePolicyLinkPolicyOptions = [
  { label: '保留模板链接', value: 'preserve_template_links' },
  { label: '阻止新增链接', value: 'block_new_links' }
] satisfies Array<{ label: string; value: Api.Crm.SequencePolicyLinkPolicy }>;

export const sequencePolicySameCompanyStrategyOptions = [
  { label: '同公司只保留一条活跃序列', value: 'single_active_per_company' },
  { label: '允许多个联系人并行', value: 'allow_multiple_contacts' }
] satisfies Array<{ label: string; value: Api.Crm.SequencePolicySameCompanyStrategy }>;

export const productLineStatusLabelMap: Record<Api.Crm.ProductLineStatus, string> = {
  active: '启用',
  archived: '已归档'
};

export const emailTemplateStatusLabelMap: Record<Api.Crm.EmailTemplateStatus, string> = {
  active: '启用',
  archived: '已归档'
};

export const personaProfileStatusLabelMap: Record<Api.Crm.PersonaProfileStatus, string> = {
  active: '启用',
  archived: '已归档'
};

export const sequencePolicyStatusLabelMap: Record<Api.Crm.SequencePolicyStatus, string> = {
  active: '启用',
  archived: '已归档'
};

export const emailTemplateThreadModeLabelMap: Record<Api.Crm.MessageThreadMode, string> = {
  new_subject: '新主题',
  same_thread: '同线程'
};

export const sequencePolicyLinkPolicyLabelMap: Record<Api.Crm.SequencePolicyLinkPolicy, string> = {
  preserve_template_links: '保留模板链接',
  block_new_links: '阻止新增链接'
};

export const sequencePolicySameCompanyStrategyLabelMap: Record<Api.Crm.SequencePolicySameCompanyStrategy, string> = {
  single_active_per_company: '同公司单活跃序列',
  allow_multiple_contacts: '允许多联系人并行'
};

export const productLineStatusTagTypeMap: Record<Api.Crm.ProductLineStatus, NaiveUI.ThemeColor> = {
  active: 'success',
  archived: 'default'
};

export const emailTemplateStatusTagTypeMap: Record<Api.Crm.EmailTemplateStatus, NaiveUI.ThemeColor> = {
  active: 'success',
  archived: 'default'
};

export const personaProfileStatusTagTypeMap: Record<Api.Crm.PersonaProfileStatus, NaiveUI.ThemeColor> = {
  active: 'success',
  archived: 'default'
};

export const sequencePolicyStatusTagTypeMap: Record<Api.Crm.SequencePolicyStatus, NaiveUI.ThemeColor> = {
  active: 'success',
  archived: 'default'
};

export const blacklistReasonLabelMap: Record<Api.Crm.BlacklistRecord['reason'], string> = {
  unsubscribe: '客户退订'
};

export type ProductLineAiWritingStatusKey = 'enabled' | 'disabled' | 'incomplete';

export interface ProductLineAiWritingStatusInfo {
  key: ProductLineAiWritingStatusKey;
  label: string;
  tagType: NaiveUI.ThemeColor;
}

/** Create the default platform-wide CRM config form. */
export function createDefaultGlobalConfigForm(): Api.Crm.GlobalConfigFormModel {
  return {
    emailVerificationCooldownDays: 30,
    followUpDelayDays: createDefaultFollowUpDelayDays()
  };
}

/** Create the default sequence follow-up delay policy in days for steps 2-5. */
export function createDefaultFollowUpDelayDays(): Api.Crm.FollowUpDelayDays {
  return {
    step2Days: 3,
    step3Days: 7,
    step4Days: 14,
    step5Days: 21
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

/** Create the default email template filter object for initial load and reset. */
export function createDefaultEmailTemplateFilterModel(): Api.Crm.EmailTemplateFilterModel {
  return {
    keyword: '',
    status: null
  };
}

/** Create the default persona profile filter object for initial load and reset. */
export function createDefaultPersonaProfileFilterModel(): Api.Crm.PersonaProfileFilterModel {
  return {
    keyword: '',
    status: null
  };
}

/** Create the default sequence policy filter object for initial load and reset. */
export function createDefaultSequencePolicyFilterModel(): Api.Crm.SequencePolicyFilterModel {
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
    commonModelsText: '',
    aiWritingConfig: createDefaultProductLineAiWritingConfig()
  };
}

/** Create a disabled five-step product-line AI writing config. */
export function createDefaultProductLineAiWritingConfig(): Api.Crm.ProductLineAiWritingConfig {
  return {
    enabled: false,
    commonRequirements: '',
    forbiddenClaims: '',
    productEmphasis: '',
    steps: [1, 2, 3, 4, 5].map(stepIndex => ({
      stepIndex: stepIndex as Api.Crm.AiWritingStepIndex,
      prompt: ''
    }))
  };
}

/** Create an empty persona profile form model. */
export function createDefaultPersonaProfileForm(): Api.Crm.PersonaProfileFormModel {
  return {
    name: '',
    description: '',
    titleKeywordsText: '',
    customerTypeKeywordsText: '',
    painPoints: '',
    focusText: '',
    avoidText: '',
    isDefault: false
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
    commonModelsText: record.commonModelsText ?? '',
    aiWritingConfig: normalizeProductLineAiWritingConfig(record.aiWritingConfig) ?? createDefaultProductLineAiWritingConfig()
  };
}

/** Convert one backend persona profile into the editable form model. */
export function createPersonaProfileFormFromRecord(record: Api.Crm.PersonaProfileRecord): Api.Crm.PersonaProfileFormModel {
  return {
    name: record.name,
    description: record.description ?? '',
    titleKeywordsText: record.titleKeywordsText ?? '',
    customerTypeKeywordsText: record.customerTypeKeywordsText ?? '',
    painPoints: record.painPoints ?? '',
    focusText: record.focusText ?? '',
    avoidText: record.avoidText ?? '',
    isDefault: record.isDefault
  };
}

/** Create an editable five-step CRM email template form. */
export function createDefaultEmailTemplateForm(): Api.Crm.EmailTemplateFormModel {
  return {
    name: '',
    language: 'en',
    description: '',
    steps: [1, 2, 3, 4, 5].map(stepIndex => ({
      stepIndex,
      name: `第 ${stepIndex} 封`,
      threadMode: stepIndex === 2 ? 'same_thread' : 'new_subject',
      delayDays: stepIndex === 1 ? 0 : [3, 7, 14, 21][stepIndex - 2],
      subjectTemplate: stepIndex === 2 ? '' : stepIndex === 1 ? '{{product.name}} for {{account.name}}' : '',
      bodyTemplate:
        stepIndex === 1
          ? 'Hi {{contact.name}},\n\nI noticed {{account.name}} and thought {{product.name}} may be relevant.\n{{persona.focus}}\n\nBest regards,\n{{sender.name}}'
          : 'Hi {{contact.name}},\n\nJust following up on {{product.name}}.\n\nBest regards,\n{{sender.name}}'
    }))
  };
}

/** Create an editable five-step CRM sequence policy form. */
export function createDefaultSequencePolicyForm(): Api.Crm.SequencePolicyFormModel {
  return {
    name: '',
    description: '',
    isDefault: false,
    steps: [1, 2, 3, 4, 5].map(stepIndex => ({
      stepIndex,
      delayDays: stepIndex === 1 ? 0 : [3, 7, 14, 21][stepIndex - 2],
      threadMode: stepIndex === 2 ? 'same_thread' : 'new_subject'
    })),
    linkPolicy: 'preserve_template_links',
    allowLowRiskAutoSend: false,
    sameCompanyContactStrategy: 'single_active_per_company'
  };
}

/** Convert one backend email template group into the editable form model. */
export function createEmailTemplateFormFromRecord(record: Api.Crm.EmailTemplateGroupRecord): Api.Crm.EmailTemplateFormModel {
  return {
    name: record.name,
    language: record.language,
    description: record.description ?? '',
    steps: record.steps
      .toSorted((left, right) => left.stepIndex - right.stepIndex)
      .map(step => ({
        stepIndex: step.stepIndex,
        name: step.name,
        threadMode: step.threadMode,
        delayDays: step.delayDays,
        subjectTemplate: step.subjectTemplate,
        bodyTemplate: step.bodyTemplate
      }))
  };
}

/** Convert one backend sequence policy into the editable form model. */
export function createSequencePolicyFormFromRecord(record: Api.Crm.SequencePolicyRecord): Api.Crm.SequencePolicyFormModel {
  return {
    name: record.name,
    description: record.description ?? '',
    isDefault: record.isDefault,
    steps: record.steps
      .toSorted((left, right) => left.stepIndex - right.stepIndex)
      .map(step => ({
        stepIndex: step.stepIndex,
        delayDays: step.stepIndex === 1 ? 0 : step.delayDays,
        threadMode: step.threadMode
      })),
    linkPolicy: record.linkPolicy,
    allowLowRiskAutoSend: record.allowLowRiskAutoSend,
    sameCompanyContactStrategy: record.sameCompanyContactStrategy
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

/** Build CRM persona profile list query params from pagination and current filters. */
export function buildPersonaProfileSearchParams(options: {
  current: number;
  size: number;
  filterModel: Api.Crm.PersonaProfileFilterModel;
}): Api.Crm.PersonaProfileSearchParams {
  const { current, filterModel, size } = options;
  const params: Api.Crm.PersonaProfileSearchParams = {
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

/** Build CRM email template list query params from pagination and current filters. */
export function buildEmailTemplateSearchParams(options: {
  current: number;
  size: number;
  filterModel: Api.Crm.EmailTemplateFilterModel;
}): Api.Crm.EmailTemplateSearchParams {
  const { current, filterModel, size } = options;
  const params: Api.Crm.EmailTemplateSearchParams = {
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

/** Build CRM sequence policy list query params from pagination and current filters. */
export function buildSequencePolicySearchParams(options: {
  current: number;
  size: number;
  filterModel: Api.Crm.SequencePolicyFilterModel;
}): Api.Crm.SequencePolicySearchParams {
  const { current, filterModel, size } = options;
  const params: Api.Crm.SequencePolicySearchParams = {
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
    commonModelsText: formModel.commonModelsText.trim(),
    aiWritingConfig: normalizeProductLineAiWritingConfig(formModel.aiWritingConfig) ?? createDefaultProductLineAiWritingConfig()
  };
}

/** Normalize product-line AI writing config for backend submission. */
export function normalizeProductLineAiWritingConfig(
  config?: Api.Crm.ProductLineAiWritingConfig | null
): Api.Crm.ProductLineAiWritingConfig | null {
  if (!config) return null;

  return {
    enabled: Boolean(config.enabled),
    commonRequirements: config.commonRequirements.trim(),
    forbiddenClaims: config.forbiddenClaims.trim(),
    productEmphasis: config.productEmphasis.trim(),
    steps: [1, 2, 3, 4, 5].map(stepIndex => {
      const step = config.steps.find(item => item.stepIndex === stepIndex);

      return {
        stepIndex: stepIndex as Api.Crm.AiWritingStepIndex,
        prompt: step?.prompt.trim() ?? ''
      };
    })
  };
}

/** Validate enabled product-line AI writing config before submit. */
export function validateProductLineAiWritingConfig(config: Api.Crm.ProductLineAiWritingConfig): string | null {
  const normalized = normalizeProductLineAiWritingConfig(config);

  if (!normalized?.enabled) return null;
  if (!normalized.commonRequirements) return '请填写 AI 写信通用要求';
  if (!normalized.forbiddenClaims) return '请填写 AI 写信禁止内容';
  if (!normalized.productEmphasis) return '请填写 AI 写信产品重点';

  const emptyStep = normalized.steps.find(step => !step.prompt);

  return emptyStep ? `请填写第 ${emptyStep.stepIndex} 封 AI 写信提示词` : null;
}

/** Get the display status of a product-line AI writing config. */
export function getProductLineAiWritingStatus(
  config?: Api.Crm.ProductLineAiWritingConfig | null
): ProductLineAiWritingStatusInfo {
  const normalized = normalizeProductLineAiWritingConfig(config);

  if (!normalized) {
    return {
      key: 'incomplete',
      label: '配置不完整',
      tagType: 'warning'
    };
  }

  if (!normalized.enabled) {
    return {
      key: 'disabled',
      label: '未开启 AI 写信',
      tagType: 'default'
    };
  }

  return validateProductLineAiWritingConfig(normalized)
    ? {
        key: 'incomplete',
        label: '配置不完整',
        tagType: 'warning'
      }
    : {
        key: 'enabled',
        label: '已开启 AI 写信',
        tagType: 'success'
      };
}

/** Trim persona profile fields before submit. */
export function normalizePersonaProfilePayload(
  formModel: Api.Crm.PersonaProfileFormModel
): Api.Crm.PersonaProfilePayload {
  return {
    name: formModel.name.trim(),
    description: formModel.description.trim(),
    titleKeywordsText: formModel.titleKeywordsText.trim(),
    customerTypeKeywordsText: formModel.customerTypeKeywordsText.trim(),
    painPoints: formModel.painPoints.trim(),
    focusText: formModel.focusText.trim(),
    avoidText: formModel.avoidText.trim(),
    isDefault: formModel.isDefault
  };
}

/** Trim email template fields before submit while preserving step order. */
export function normalizeEmailTemplatePayload(formModel: Api.Crm.EmailTemplateFormModel): Api.Crm.EmailTemplatePayload {
  return {
    name: formModel.name.trim(),
    language: formModel.language.trim() || 'en',
    description: formModel.description.trim(),
    steps: formModel.steps
      .toSorted((left, right) => left.stepIndex - right.stepIndex)
      .map(step => ({
        stepIndex: step.stepIndex,
        name: step.name.trim(),
        threadMode: step.threadMode,
        delayDays: step.stepIndex === 1 ? 0 : step.delayDays,
        subjectTemplate: step.subjectTemplate.trim(),
        bodyTemplate: step.bodyTemplate.trim()
      }))
  };
}

/** Trim sequence policy fields before submit while preserving the five configured steps. */
export function normalizeSequencePolicyPayload(formModel: Api.Crm.SequencePolicyFormModel): Api.Crm.SequencePolicyPayload {
  return {
    name: formModel.name.trim(),
    description: formModel.description.trim(),
    isDefault: formModel.isDefault,
    steps: formModel.steps
      .toSorted((left, right) => left.stepIndex - right.stepIndex)
      .map(step => ({
        stepIndex: step.stepIndex,
        delayDays: step.stepIndex === 1 ? 0 : step.delayDays,
        threadMode: step.threadMode
      })),
    linkPolicy: formModel.linkPolicy,
    allowLowRiskAutoSend: formModel.allowLowRiskAutoSend,
    sameCompanyContactStrategy: formModel.sameCompanyContactStrategy
  };
}

/** Check whether the platform email verification cache cooldown can be saved. */
export function isValidEmailVerificationCooldownDays(value: number | null): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 365;
}

/** Check whether all follow-up delay days can be saved. */
export function isValidFollowUpDelayDays(value: Api.Crm.FollowUpDelayDays) {
  return Object.values(value).every(day => Number.isInteger(day) && day >= 1 && day <= 90);
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

/** Label mailbox sync action as recovery when Gmail history checkpoint is expired. */
export function formatMailboxSyncActionLabel(row: Pick<Api.Crm.MailboxRecord, 'lastSyncIssue'>) {
  return row.lastSyncIssue?.type === 'history_expired' ? '恢复同步' : '立即同步';
}

/** Format product line table datetime. */
export function formatProductLineDate(value: string) {
  return dayjs(value).format('YYYY-MM-DD HH:mm:ss');
}

/** Format blacklist table datetime. */
export function formatBlacklistDate(value: string) {
  return dayjs(value).format('YYYY-MM-DD HH:mm:ss');
}

/** Format nullable operation table datetime. */
export function formatOperationDate(value: string | null) {
  return value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-';
}

/** Build the field list used by the send queue operation detail drawer. */
export function buildOperationQueueDetailItems(row: OperationQueueRow): OperationDetailItem[] {
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

/** Build the field list used by the mailbox sync operation detail drawer. */
export function buildMailboxOperationDetailItems(
  row: Api.Crm.MailboxRecord,
  now: Dayjs = dayjs()
): OperationDetailItem[] {
  const watchStatus = getMailboxWatchStatus(row.watchExpiration, now);

  return [
    { label: '邮箱', value: row.maskedEmail },
    { label: '负责人', value: row.ownerUserName || row.ownerUserId },
    { label: '授权状态', value: mailboxStatusLabelMap[row.status] },
    { label: 'Gmail watch', value: mailboxWatchStatusLabelMap[watchStatus] },
    { label: 'Watch 到期', value: formatMailboxWatchDescription(row.watchExpiration) },
    { label: 'History checkpoint', value: formatMailboxHistoryId(row.lastHistoryId) },
    { label: '同步问题', value: row.lastSyncIssue?.message ?? '-' },
    { label: '问题时间', value: row.lastSyncIssue ? formatOperationDate(row.lastSyncIssue.happenedAt) : '-' },
    { label: '更新时间', value: formatMailboxDate(row.updatedAt ?? null) }
  ];
}

/** Build the field list used by the CRM operation log detail drawer. */
export function buildOperationLogDetailItems(row: Api.SystemLog.SystemLogRecord): OperationDetailItem[] {
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
export function buildOperationLogSummaryRows(options: {
  logs: Api.SystemLog.SystemLogRecord[];
  mailboxes: Api.Crm.MailboxRecord[];
  queueRows: OperationQueueRow[];
}): OperationLogSummaryRow[] {
  const events = [
    ...options.logs.map(toOperationLogEvent).filter((event): event is OperationLogEvent => Boolean(event)),
    ...options.mailboxes.flatMap(toMailboxHistoryEvents),
    ...options.queueRows.map(toQueueOperationEvent)
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
export function buildStrategyStatSections(stats: Api.Crm.StrategyStats, limit = 5): StrategyStatSection[] {
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

/** Join MOQ and lead time into one compact table cell. */
export function formatProductLineSupply(row: Pick<Api.Crm.ProductLineRecord, 'moq' | 'leadTime'>) {
  return [row.moq, row.leadTime].filter(Boolean).join(' / ') || '-';
}

/** Flatten sequence review items into the queue rows that need operational attention. */
export function collectOperationQueueRows(
  items: Api.Crm.SequenceReviewItem[],
  limit = 8
): OperationQueueRow[] {
  return items
    .flatMap(item =>
      item.messages
        .filter(isOperationQueueMessage)
        .map(message => ({
          id: message.id,
          accountName: item.account.name,
          contactName: item.contact.fullName || item.contact.email || '-',
          mailboxLabel: item.mailbox?.maskedEmail ?? '-',
          subject: message.subject,
          stepIndex: message.stepIndex,
          threadMode: message.threadMode,
          status: message.status,
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
export function collectRecentCrmOperationLogs(records: Api.SystemLog.SystemLogRecord[], limit = 6) {
  return records
    .filter(record => record.module === 'crm')
    .toSorted((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, limit);
}

/** Summarize mailbox sync and watch health for a compact operations header. */
export function summarizeMailboxSyncHealth(
  records: Api.Crm.MailboxRecord[],
  now: Dayjs = dayjs()
): MailboxSyncHealthSummary {
  return records.reduce<MailboxSyncHealthSummary>(
    (summary, record) => {
      const watchStatus = getMailboxWatchStatus(record.watchExpiration, now);

      summary.total += 1;

      if (record.status === 'auth_expired') {
        summary.authExpired += 1;
      }

      if (watchStatus !== 'normal') {
        summary.watchNeedsAttention += 1;
      }

      if (record.lastHistoryId) {
        summary.synced += 1;
      }

      if (record.lastSyncIssue) {
        summary.syncIssues += 1;
      }

      return summary;
    },
    {
      authExpired: 0,
      syncIssues: 0,
      synced: 0,
      total: 0,
      watchNeedsAttention: 0
    }
  );
}

function isOperationQueueMessage(message: Api.Crm.MessageRecord): message is Api.Crm.MessageRecord & {
  status: OperationMessageStatus;
} {
  return message.status === 'queued' || message.status === 'failed';
}

function compareOperationQueueRows(left: OperationQueueRow, right: OperationQueueRow) {
  if (left.status !== right.status) {
    return left.status === 'failed' ? -1 : 1;
  }

  return right.updatedAt.localeCompare(left.updatedAt);
}

function formatOperationMetadata(metadata: Record<string, unknown> | null) {
  const safeMetadata = sanitizeOperationMetadata(metadata);

  return safeMetadata ? JSON.stringify(safeMetadata, null, 2) : '';
}

function toOperationLogEvent(record: Api.SystemLog.SystemLogRecord): OperationLogEvent | null {
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

function toMailboxHistoryEvents(mailbox: Api.Crm.MailboxRecord): OperationLogEvent[] {
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

function toQueueOperationEvent(row: OperationQueueRow): OperationLogEvent {
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

function resolveOperationLogCategory(record: Api.SystemLog.SystemLogRecord): OperationLogCategory | null {
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

  if (text.includes('send') || text.includes('worker') || text.includes('job')) {
    return 'send';
  }

  return null;
}

function resolveOperationFailureReason(record: Api.SystemLog.SystemLogRecord) {
  if (record.errorMessage || record.errorCode) {
    return record.errorMessage || record.errorCode || '-';
  }

  const reason = getMetadataString(record.metadata, 'reason');

  if (reason !== '-') {
    return reason;
  }

  return record.status === 'failed' ? record.message : '-';
}

function resolveOperationJobId(metadata: Record<string, unknown> | null) {
  const jobId = getMetadataString(metadata, 'jobId');

  return jobId !== '-' ? jobId : getMetadataString(metadata, 'pubsubMessageId');
}

function getMetadataString(metadata: Record<string, unknown> | null, key: string) {
  const value = metadata?.[key];

  return typeof value === 'string' && value ? value : '-';
}

function compareOperationLogEvents(left: OperationLogEvent, right: OperationLogEvent) {
  return (right.rawTime ?? '').localeCompare(left.rawTime ?? '');
}

function sanitizeOperationMetadata(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(item => sanitizeOperationMetadata(item));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([key]) => !sensitiveMetadataKeys.has(key.toLowerCase()))
    .map(([key, item]) => [key, sanitizeOperationMetadata(item)]);

  return Object.fromEntries(entries);
}
