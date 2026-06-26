import dayjs from 'dayjs';

export const organizationStatusOptions = [
  { label: '启用', value: 'enabled' },
  { label: '禁用', value: 'disabled' }
] satisfies Array<{ label: string; value: Api.SystemOrganization.OrganizationStatus }>;

export const organizationStatusLabelMap: Record<Api.SystemOrganization.OrganizationStatus, string> = {
  enabled: '启用',
  disabled: '禁用'
};

export const organizationStatusTagTypeMap: Record<Api.SystemOrganization.OrganizationStatus, NaiveUI.ThemeColor> = {
  enabled: 'success',
  disabled: 'error'
};

/** Create the default filter object for organization management. */
export function createDefaultOrganizationFilterModel(): Api.SystemOrganization.OrganizationFilterModel {
  return {
    keyword: '',
    status: null
  };
}

/** Build organization list query params from pagination and current filters. */
export function buildSystemOrganizationSearchParams(options: {
  current: number;
  size: number;
  filterModel: Api.SystemOrganization.OrganizationFilterModel;
}): Api.SystemOrganization.OrganizationSearchParams {
  const { current, size, filterModel } = options;
  const params: Api.SystemOrganization.OrganizationSearchParams = {
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

/** Format nullable backend ISO datetime for table display. */
export function formatOrganizationDateTime(value: string | null) {
  return value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-';
}
