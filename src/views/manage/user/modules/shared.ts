import dayjs from 'dayjs';
import { crmPermissionDefinitions, getDefaultPermissionCodesByRoles } from '@soybean/shared';

export const userRoleOptions = [
  { label: '超级管理员', value: 'R_SUPER' },
  { label: '管理员', value: 'R_ADMIN' },
  { label: '普通用户', value: 'R_USER' }
] satisfies Array<{ label: string; value: Api.SystemUser.UserRole }>;

export const userRoleLabelMap = new Map(userRoleOptions.map(item => [item.value, item.label]));

export const userStatusOptions = [
  { label: '启用', value: 'enabled' },
  { label: '禁用', value: 'disabled' }
] satisfies Array<{ label: string; value: Api.SystemUser.UserStatus }>;

export const userStatusLabelMap: Record<Api.SystemUser.UserStatus, string> = {
  enabled: '启用',
  disabled: '禁用'
};

export const userStatusTagTypeMap: Record<Api.SystemUser.UserStatus, NaiveUI.ThemeColor> = {
  enabled: 'success',
  disabled: 'error'
};

export const userExpirationOptions = [
  { label: '有效', value: 'active' },
  { label: '已过期', value: 'expired' }
] satisfies Array<{ label: string; value: Api.SystemUser.UserExpirationStatus }>;

export const userExpirationLabelMap: Record<Api.SystemUser.UserExpirationStatus, string> = {
  active: '有效',
  expired: '已过期'
};

export const userExpirationTagTypeMap: Record<Api.SystemUser.UserExpirationStatus, NaiveUI.ThemeColor> = {
  active: 'success',
  expired: 'error'
};

export const userPermissionGroups = Array.from(
  crmPermissionDefinitions
    .reduce((groups, permission) => {
      const group = groups.get(permission.group) || {
        key: permission.group,
        label: permission.groupLabel,
        options: [] as Array<{ label: string; value: Api.SystemUser.PermissionCode }>
      };

      group.options.push({
        label: permission.label,
        value: permission.code
      });
      groups.set(permission.group, group);

      return groups;
    }, new Map<string, { key: string; label: string; options: Array<{ label: string; value: Api.SystemUser.PermissionCode }> }>())
    .values()
);

/** Resolve the default permission checkbox value for a role selection. */
export function getDefaultUserPermissionsByRoles(roles: Api.SystemUser.UserRole[]) {
  return getDefaultPermissionCodesByRoles(roles);
}

/** Create the default filter object for initial load and reset. */
export function createDefaultUserFilterModel(): Api.SystemUser.UserFilterModel {
  return {
    keyword: '',
    role: null,
    status: null,
    expirationStatus: null
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

  if (filterModel.status) {
    params.status = filterModel.status;
  }

  if (filterModel.expirationStatus) {
    params.expirationStatus = filterModel.expirationStatus;
  }

  return params;
}

/** Format nullable backend ISO datetime for table display. */
export function formatUserDateTime(value: string | null) {
  return value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-';
}

/** Format nullable backend ISO date for compact table display. */
export function formatUserDate(value: string | null) {
  return value ? dayjs(value).format('YYYY-MM-DD') : '长期有效';
}

/** Read the row's expiration display state from backend flags. */
export function getUserExpirationState(row: Api.SystemUser.UserListItem) {
  const status: Api.SystemUser.UserExpirationStatus = row.expired ? 'expired' : 'active';

  return {
    label: userExpirationLabelMap[status],
    type: userExpirationTagTypeMap[status]
  };
}

/** Read the row's locked display state from backend flags. */
export function getUserLockedState(row: Api.SystemUser.UserListItem) {
  return row.locked
    ? {
        label: '已锁定',
        type: 'error' as const
      }
    : {
        label: '正常',
        type: 'success' as const
      };
}
