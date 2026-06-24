import dayjs from 'dayjs';

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

export type ProductLineAiWritingStatusKey = 'enabled' | 'disabled' | 'incomplete';

export interface ProductLineAiWritingStatusInfo {
  key: ProductLineAiWritingStatusKey;
  label: string;
  tagType: NaiveUI.ThemeColor;
}

export interface ProductLineAiWritingStepSummary {
  stepIndex: Api.Crm.AiWritingStepIndex;
  prompt: string;
  preview: string;
}

export interface ProductLineAiWritingConfigSummary {
  enabledLabel: string;
  commonRequirements: string;
  forbiddenClaims: string;
  productEmphasis: string;
  sequenceStrategyLabel: string;
  languagePolicyLabel: string;
  toneLabel: string;
  ctaPreferenceLabel: string;
  polishPolicyLabel: string;
  proofAssets: string;
  regionNotes: string;
  steps: ProductLineAiWritingStepSummary[];
}

export interface ProductLineAiPromptVersionDiffItem {
  key: string;
  label: string;
  versionValue: string;
  currentValue: string;
}

export const productLineAiSequenceStrategyOptions = [
  { label: '3 封核心 + 可选转介绍/退出', value: 'core_3_step' },
  { label: '完整 5 封序列', value: 'full_5_step' }
] satisfies Array<{ label: string; value: NonNullable<Api.Crm.ProductLineAiWritingConfig['sequenceStrategy']> }>;

export const productLineAiLanguagePolicyOptions = [
  { label: '客户语言优先，否则英文', value: 'account_locale_or_english' },
  { label: '固定英文', value: 'english' },
  { label: '尽量使用当地语言', value: 'local_language' }
] satisfies Array<{ label: string; value: NonNullable<Api.Crm.ProductLineAiWritingConfig['languagePolicy']> }>;

export const productLineAiToneOptions = [
  { label: '顾问式', value: 'consultative' },
  { label: '直接', value: 'direct' },
  { label: '正式', value: 'formal' }
] satisfies Array<{ label: string; value: NonNullable<Api.Crm.ProductLineAiWritingConfig['tone']> }>;

export const productLineAiCtaPreferenceOptions = [
  { label: '低摩擦问题', value: 'low_friction_question' },
  { label: '会议', value: 'meeting' },
  { label: '报价', value: 'quote' },
  { label: '转介绍', value: 'referral' }
] satisfies Array<{ label: string; value: NonNullable<Api.Crm.ProductLineAiWritingConfig['ctaPreference']> }>;

export const productLineAiPolishPolicyOptions = [
  { label: '命中风险时润色', value: 'auto_when_flagged' },
  { label: '总是润色', value: 'always' },
  { label: '关闭润色', value: 'off' }
] satisfies Array<{ label: string; value: NonNullable<Api.Crm.ProductLineAiWritingConfig['polishPolicy']> }>;
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
    sequenceStrategy: 'core_3_step',
    languagePolicy: 'account_locale_or_english',
    tone: 'consultative',
    ctaPreference: 'low_friction_question',
    polishPolicy: 'auto_when_flagged',
    proofAssets: '',
    regionNotes: '',
    steps: [1, 2, 3, 4, 5].map(stepIndex => ({
      stepIndex: stepIndex as Api.Crm.AiWritingStepIndex,
      prompt: ''
    }))
  };
}

/** Create the default product line filter object for initial load and reset. */
export function createDefaultProductLineFilterModel(): Api.Crm.ProductLineFilterModel {
  return {
    keyword: '',
    status: null
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
    aiWritingConfig:
      normalizeProductLineAiWritingConfig(record.aiWritingConfig) ?? createDefaultProductLineAiWritingConfig()
  };
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
    commonModelsText: formModel.commonModelsText.trim(),
    aiWritingConfig:
      normalizeProductLineAiWritingConfig(formModel.aiWritingConfig) ?? createDefaultProductLineAiWritingConfig()
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
    sequenceStrategy: normalizeSelectValue(config.sequenceStrategy, 'core_3_step'),
    languagePolicy: normalizeSelectValue(config.languagePolicy, 'account_locale_or_english'),
    tone: normalizeSelectValue(config.tone, 'consultative'),
    ctaPreference: normalizeSelectValue(config.ctaPreference, 'low_friction_question'),
    polishPolicy: normalizeSelectValue(config.polishPolicy, 'auto_when_flagged'),
    proofAssets: config.proofAssets?.trim() ?? '',
    regionNotes: config.regionNotes?.trim() ?? '',
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

/** Build a compact summary for product-line AI prompt version display. */
export function summarizeProductLineAiWritingConfig(
  config?: Api.Crm.ProductLineAiWritingConfig | null
): ProductLineAiWritingConfigSummary {
  const normalized = normalizeProductLineAiWritingConfig(config) ?? createDefaultProductLineAiWritingConfig();

  return {
    enabledLabel: normalized.enabled ? '已开启' : '未开启',
    commonRequirements: normalized.commonRequirements,
    forbiddenClaims: normalized.forbiddenClaims,
    productEmphasis: normalized.productEmphasis,
    sequenceStrategyLabel: findOptionLabel(productLineAiSequenceStrategyOptions, normalized.sequenceStrategy),
    languagePolicyLabel: findOptionLabel(productLineAiLanguagePolicyOptions, normalized.languagePolicy),
    toneLabel: findOptionLabel(productLineAiToneOptions, normalized.tone),
    ctaPreferenceLabel: findOptionLabel(productLineAiCtaPreferenceOptions, normalized.ctaPreference),
    polishPolicyLabel: findOptionLabel(productLineAiPolishPolicyOptions, normalized.polishPolicy),
    proofAssets: normalized.proofAssets ?? '',
    regionNotes: normalized.regionNotes ?? '',
    steps: normalized.steps.map(step => ({
      stepIndex: step.stepIndex,
      prompt: step.prompt,
      preview: createProductLinePromptPreview(step.prompt)
    }))
  };
}

/** Compare one historical prompt version against the current editable config. */
export function buildProductLineAiPromptVersionDiffItems(
  versionConfig: Api.Crm.ProductLineAiWritingConfig | null | undefined,
  currentConfig: Api.Crm.ProductLineAiWritingConfig | null | undefined
): ProductLineAiPromptVersionDiffItem[] {
  const versionSummary = summarizeProductLineAiWritingConfig(versionConfig);
  const currentSummary = summarizeProductLineAiWritingConfig(currentConfig);
  const diffItems: ProductLineAiPromptVersionDiffItem[] = [];

  pushProductLinePromptDiffItem(
    diffItems,
    'enabled',
    '启用状态',
    versionSummary.enabledLabel,
    currentSummary.enabledLabel
  );
  pushProductLinePromptDiffItem(
    diffItems,
    'commonRequirements',
    '通用要求',
    versionSummary.commonRequirements,
    currentSummary.commonRequirements
  );
  pushProductLinePromptDiffItem(
    diffItems,
    'forbiddenClaims',
    '禁止内容',
    versionSummary.forbiddenClaims,
    currentSummary.forbiddenClaims
  );
  pushProductLinePromptDiffItem(
    diffItems,
    'productEmphasis',
    '产品重点',
    versionSummary.productEmphasis,
    currentSummary.productEmphasis
  );
  pushProductLinePromptDiffItem(
    diffItems,
    'sequenceStrategy',
    '序列策略',
    versionSummary.sequenceStrategyLabel,
    currentSummary.sequenceStrategyLabel
  );
  pushProductLinePromptDiffItem(
    diffItems,
    'languagePolicy',
    '语言策略',
    versionSummary.languagePolicyLabel,
    currentSummary.languagePolicyLabel
  );
  pushProductLinePromptDiffItem(diffItems, 'tone', '语气', versionSummary.toneLabel, currentSummary.toneLabel);
  pushProductLinePromptDiffItem(
    diffItems,
    'ctaPreference',
    'CTA 风格',
    versionSummary.ctaPreferenceLabel,
    currentSummary.ctaPreferenceLabel
  );
  pushProductLinePromptDiffItem(
    diffItems,
    'polishPolicy',
    '二次润色',
    versionSummary.polishPolicyLabel,
    currentSummary.polishPolicyLabel
  );
  pushProductLinePromptDiffItem(
    diffItems,
    'proofAssets',
    '证据素材',
    versionSummary.proofAssets,
    currentSummary.proofAssets
  );
  pushProductLinePromptDiffItem(
    diffItems,
    'regionNotes',
    '地区备注',
    versionSummary.regionNotes,
    currentSummary.regionNotes
  );

  versionSummary.steps.forEach(versionStep => {
    const currentStep = currentSummary.steps.find(step => step.stepIndex === versionStep.stepIndex);
    pushProductLinePromptDiffItem(
      diffItems,
      `step-${versionStep.stepIndex}`,
      `第 ${versionStep.stepIndex} 封 Prompt`,
      versionStep.prompt,
      currentStep?.prompt ?? ''
    );
  });

  return diffItems;
}

function createProductLinePromptPreview(prompt: string) {
  return prompt.length > 80 ? `${prompt.slice(0, 80)}...` : prompt;
}

function normalizeSelectValue<T extends string>(value: T | undefined, fallback: T) {
  return value ?? fallback;
}

function findOptionLabel<T extends string>(options: Array<{ label: string; value: T }>, value: T | undefined) {
  return options.find(option => option.value === value)?.label ?? '';
}

function pushProductLinePromptDiffItem(
  diffItems: ProductLineAiPromptVersionDiffItem[],
  key: string,
  label: string,
  versionValue: string,
  currentValue: string
) {
  if (versionValue === currentValue) {
    return;
  }

  diffItems.push({
    key,
    label,
    versionValue,
    currentValue
  });
}

/** Format product line table datetime. */
export function formatProductLineDate(value: string) {
  return dayjs(value).format('YYYY-MM-DD HH:mm:ss');
}

/** Join MOQ and lead time into one compact table cell. */
export function formatProductLineSupply(row: Pick<Api.Crm.ProductLineRecord, 'moq' | 'leadTime'>) {
  return [row.moq, row.leadTime].filter(Boolean).join(' / ') || '-';
}
