export const personaProfileStatusOptions = [
  { label: '启用', value: 'active' },
  { label: '已归档', value: 'archived' }
];
export const personaProfileStatusLabelMap = {
  active: '启用',
  archived: '已归档'
};
export const personaProfileStatusTagTypeMap = {
  active: 'success',
  archived: 'default'
};
/** Create the default persona profile filter object for initial load and reset. */
export function createDefaultPersonaProfileFilterModel() {
  return {
    keyword: '',
    status: null
  };
}
/** Create an empty persona profile form model. */
export function createDefaultPersonaProfileForm() {
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
/** Convert one backend persona profile into the editable form model. */
export function createPersonaProfileFormFromRecord(record) {
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
/** Build CRM persona profile list query params from pagination and current filters. */
export function buildPersonaProfileSearchParams(options) {
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
/** Trim persona profile fields before submit. */
export function normalizePersonaProfilePayload(formModel) {
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
