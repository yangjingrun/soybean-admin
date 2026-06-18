export const userRoleOptions = [
  { label: '超级管理员', value: 'R_SUPER' },
  { label: '管理员', value: 'R_ADMIN' },
  { label: '普通用户', value: 'R_USER' }
];

export const userRoleLabelMap = new Map(userRoleOptions.map(item => [item.value, item.label]));

export const userStatusLabelMap: Record<Api.SystemUser.UserStatus, string> = {
  enabled: '启用'
};

export const userStatusTagTypeMap: Record<Api.SystemUser.UserStatus, NaiveUI.ThemeColor> = {
  enabled: 'success'
};

/** Create the default filter object for initial load and reset. */
export function createDefaultUserFilterModel(): Api.SystemUser.UserFilterModel {
  return {
    keyword: '',
    role: null
  };
}

/** Build list query params from pagination and current filters. */
export function buildSystemUserSearchParams(options: {
  current: number;
  size: number;
  filterModel: Api.SystemUser.UserFilterModel;
}): Api.SystemUser.UserSearchParams {
  const { current, size, filterModel } = options;
  const params: Api.SystemUser.UserSearchParams = {
    current,
    size
  };

  const keyword = filterModel.keyword.trim();
  if (keyword) {
    params.keyword = keyword;
  }

  if (filterModel.role) {
    params.role = filterModel.role;
  }

  return params;
}
