export const emailTemplateStatusOptions = [
  { label: '启用', value: 'active' },
  { label: '已归档', value: 'archived' }
] satisfies Array<{ label: string; value: Api.Crm.EmailTemplateStatus }>;

export const emailTemplateThreadModeOptions = [
  { label: '新主题', value: 'new_subject' },
  { label: '同线程', value: 'same_thread' }
] satisfies Array<{ label: string; value: Api.Crm.MessageThreadMode }>;
export const emailTemplateStatusLabelMap: Record<Api.Crm.EmailTemplateStatus, string> = {
  active: '启用',
  archived: '已归档'
};

export const emailTemplateThreadModeLabelMap: Record<Api.Crm.MessageThreadMode, string> = {
  new_subject: '新主题',
  same_thread: '同线程'
};
export const emailTemplateStatusTagTypeMap: Record<Api.Crm.EmailTemplateStatus, NaiveUI.ThemeColor> = {
  active: 'success',
  archived: 'default'
};

/** Create the default email template filter object for initial load and reset. */
export function createDefaultEmailTemplateFilterModel(): Api.Crm.EmailTemplateFilterModel {
  return {
    keyword: '',
    status: null
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

/** Convert one backend email template group into the editable form model. */
export function createEmailTemplateFormFromRecord(
  record: Api.Crm.EmailTemplateGroupRecord
): Api.Crm.EmailTemplateFormModel {
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
