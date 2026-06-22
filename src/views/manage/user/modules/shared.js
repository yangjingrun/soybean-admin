import dayjs from 'dayjs';
export const userRoleOptions = [
  { label: '超级管理员', value: 'R_SUPER' },
  { label: '管理员', value: 'R_ADMIN' },
  { label: '普通用户', value: 'R_USER' }
];
export const userRoleLabelMap = new Map(userRoleOptions.map(item => [item.value, item.label]));
export const userStatusOptions = [
  { label: '启用', value: 'enabled' },
  { label: '禁用', value: 'disabled' }
];
export const userStatusLabelMap = {
  enabled: '启用',
  disabled: '禁用'
};
export const userStatusTagTypeMap = {
  enabled: 'success',
  disabled: 'error'
};
export const userExpirationOptions = [
  { label: '有效', value: 'active' },
  { label: '已过期', value: 'expired' }
];
export const userExpirationLabelMap = {
  active: '有效',
  expired: '已过期'
};
export const userExpirationTagTypeMap = {
  active: 'success',
  expired: 'error'
};
/** Create the default filter object for initial load and reset. */
export function createDefaultUserFilterModel() {
  return {
    keyword: '',
    organizationId: null,
    role: null,
    status: null,
    expirationStatus: null
  };
}
/** Build list query params from pagination and current filters. */
export function buildSystemUserSearchParams(options) {
  const { current, size, filterModel } = options;
  const params = {
    current,
    size
  };
  const keyword = filterModel.keyword.trim();
  if (keyword) {
    params.keyword = keyword;
  }
  if (filterModel.organizationId) {
    params.organizationId = filterModel.organizationId;
  }
  if (filterModel.role) {
    params.role = filterModel.role;
  }
  if (filterModel.status) {
    params.status = filterModel.status;
  }
  if (filterModel.expirationStatus) {
    params.expirationStatus = filterModel.expirationStatus;
  }
  return params;
}
/** Format nullable backend ISO datetime for table display. */
export function formatUserDateTime(value) {
  return value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-';
}
/** Format nullable backend ISO date for compact table display. */
export function formatUserDate(value) {
  return value ? dayjs(value).format('YYYY-MM-DD') : '';
}
/** Read the row's expiration display state from backend flags. */
export function getUserExpirationState(row) {
  if (row.expired) {
    return {
      label: '已过期',
      description: formatUserDate(row.expireAt),
      type: 'error'
    };
  }
  if (!row.expireAt) {
    return {
      label: '长期有效',
      description: '',
      type: 'success'
    };
  }
  return {
    label: '有效至',
    description: formatUserDate(row.expireAt),
    type: 'success'
  };
}
/** Read the row's locked display state from backend flags. */
export function getUserLockedState(row) {
  return row.locked
    ? {
        label: '锁定至',
        description: formatUserDateTime(row.lockedUntil),
        type: 'error'
      }
    : {
        label: '正常',
        description: '',
        type: 'success'
      };
}
