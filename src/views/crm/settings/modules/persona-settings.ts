export const personaProfileStatusOptions = [
  { label: '启用', value: 'active' },
  { label: '已归档', value: 'archived' }
] satisfies Array<{ label: string; value: Api.Crm.PersonaProfileStatus }>;

export const personaProfileStatusLabelMap: Record<Api.Crm.PersonaProfileStatus, string> = {
  active: '启用',
  archived: '已归档'
};

export const personaProfileStatusTagTypeMap: Record<Api.Crm.PersonaProfileStatus, NaiveUI.ThemeColor> = {
  active: 'success',
  archived: 'default'
};

/** Create the default persona profile filter object for initial load and reset. */
export function createDefaultPersonaProfileFilterModel(): Api.Crm.PersonaProfileFilterModel {
  return {
    keyword: '',
    status: null
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

/** Convert one backend persona profile into the editable form model. */
export function createPersonaProfileFormFromRecord(
  record: Api.Crm.PersonaProfileRecord
): Api.Crm.PersonaProfileFormModel {
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

