export const sequencePolicyStatusOptions = [
  { label: '启用', value: 'active' },
  { label: '已归档', value: 'archived' }
];
export const sequencePolicyLinkPolicyOptions = [
  { label: '保留模板链接', value: 'preserve_template_links' },
  { label: '阻止新增链接', value: 'block_new_links' }
];
export const sequencePolicySameCompanyStrategyOptions = [
  { label: '同公司只保留一条活跃序列', value: 'single_active_per_company' },
  { label: '允许多个联系人并行', value: 'allow_multiple_contacts' }
];
export const sequencePolicyStatusLabelMap = {
  active: '启用',
  archived: '已归档'
};
export const sequencePolicyLinkPolicyLabelMap = {
  preserve_template_links: '保留模板链接',
  block_new_links: '阻止新增链接'
};
export const sequencePolicySameCompanyStrategyLabelMap = {
  single_active_per_company: '同公司单活跃序列',
  allow_multiple_contacts: '允许多联系人并行'
};
export const sequencePolicyStatusTagTypeMap = {
  active: 'success',
  archived: 'default'
};
/** Create the default sequence policy filter object for initial load and reset. */
export function createDefaultSequencePolicyFilterModel() {
  return {
    keyword: '',
    status: null
  };
}
/** Create an editable five-step CRM sequence policy form. */
export function createDefaultSequencePolicyForm() {
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
/** Convert one backend sequence policy into the editable form model. */
export function createSequencePolicyFormFromRecord(record) {
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
/** Build CRM sequence policy list query params from pagination and current filters. */
export function buildSequencePolicySearchParams(options) {
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
/** Trim sequence policy fields before submit while preserving the five configured steps. */
export function normalizeSequencePolicyPayload(formModel) {
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
