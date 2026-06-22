import dayjs from 'dayjs';
export const organizationStatusOptions = [
  { label: '启用', value: 'enabled' },
  { label: '禁用', value: 'disabled' }
];
export const organizationStatusLabelMap = {
  enabled: '启用',
  disabled: '禁用'
};
export const organizationStatusTagTypeMap = {
  enabled: 'success',
  disabled: 'error'
};
/** Create the default filter object for organization management. */
export function createDefaultOrganizationFilterModel() {
  return {
    keyword: '',
    status: null
  };
}
/** Build organization list query params from pagination and current filters. */
export function buildSystemOrganizationSearchParams(options) {
  const { current, size, filterModel } = options;
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
/** Format nullable backend ISO datetime for table display. */
export function formatOrganizationDateTime(value) {
  return value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-';
}
