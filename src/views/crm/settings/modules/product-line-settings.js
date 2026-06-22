import dayjs from 'dayjs';
export const productLineStatusOptions = [
  { label: '启用', value: 'active' },
  { label: '已归档', value: 'archived' }
];
export const productLineStatusLabelMap = {
  active: '启用',
  archived: '已归档'
};
export const productLineStatusTagTypeMap = {
  active: 'success',
  archived: 'default'
};
/** Create an empty product line form model. */
export function createDefaultProductLineForm() {
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
export function createDefaultProductLineAiWritingConfig() {
  return {
    enabled: false,
    commonRequirements: '',
    forbiddenClaims: '',
    productEmphasis: '',
    steps: [1, 2, 3, 4, 5].map(stepIndex => ({
      stepIndex: stepIndex,
      prompt: ''
    }))
  };
}
/** Create the default product line filter object for initial load and reset. */
export function createDefaultProductLineFilterModel() {
  return {
    keyword: '',
    status: null
  };
}
/** Convert a product line record into the editable form model. */
export function createProductLineFormFromRecord(record) {
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
export function buildProductLineSearchParams(options) {
  const { current, filterModel, size } = options;
  const params = {
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
export function normalizeProductLinePayload(formModel) {
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
export function normalizeProductLineAiWritingConfig(config) {
  if (!config) return null;
  return {
    enabled: Boolean(config.enabled),
    commonRequirements: config.commonRequirements.trim(),
    forbiddenClaims: config.forbiddenClaims.trim(),
    productEmphasis: config.productEmphasis.trim(),
    steps: [1, 2, 3, 4, 5].map(stepIndex => {
      const step = config.steps.find(item => item.stepIndex === stepIndex);
      return {
        stepIndex: stepIndex,
        prompt: step?.prompt.trim() ?? ''
      };
    })
  };
}
/** Validate enabled product-line AI writing config before submit. */
export function validateProductLineAiWritingConfig(config) {
  const normalized = normalizeProductLineAiWritingConfig(config);
  if (!normalized?.enabled) return null;
  if (!normalized.commonRequirements) return '请填写 AI 写信通用要求';
  if (!normalized.forbiddenClaims) return '请填写 AI 写信禁止内容';
  if (!normalized.productEmphasis) return '请填写 AI 写信产品重点';
  const emptyStep = normalized.steps.find(step => !step.prompt);
  return emptyStep ? `请填写第 ${emptyStep.stepIndex} 封 AI 写信提示词` : null;
}
/** Get the display status of a product-line AI writing config. */
export function getProductLineAiWritingStatus(config) {
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
export function summarizeProductLineAiWritingConfig(config) {
  const normalized = normalizeProductLineAiWritingConfig(config) ?? createDefaultProductLineAiWritingConfig();
  return {
    enabledLabel: normalized.enabled ? '已开启' : '未开启',
    commonRequirements: normalized.commonRequirements,
    forbiddenClaims: normalized.forbiddenClaims,
    productEmphasis: normalized.productEmphasis,
    steps: normalized.steps.map(step => ({
      stepIndex: step.stepIndex,
      prompt: step.prompt,
      preview: createProductLinePromptPreview(step.prompt)
    }))
  };
}
/** Compare one historical prompt version against the current editable config. */
export function buildProductLineAiPromptVersionDiffItems(versionConfig, currentConfig) {
  const versionSummary = summarizeProductLineAiWritingConfig(versionConfig);
  const currentSummary = summarizeProductLineAiWritingConfig(currentConfig);
  const diffItems = [];
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
function createProductLinePromptPreview(prompt) {
  return prompt.length > 80 ? `${prompt.slice(0, 80)}...` : prompt;
}
function pushProductLinePromptDiffItem(diffItems, key, label, versionValue, currentValue) {
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
export function formatProductLineDate(value) {
  return dayjs(value).format('YYYY-MM-DD HH:mm:ss');
}
/** Join MOQ and lead time into one compact table cell. */
export function formatProductLineSupply(row) {
  return [row.moq, row.leadTime].filter(Boolean).join(' / ') || '-';
}
