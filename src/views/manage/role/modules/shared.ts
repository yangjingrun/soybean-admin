import { crmPermissionDefinitions, normalizePermissionCodes } from '@soybean/shared';

export interface PermissionGroupOption {
  label: string;
  value: Api.SystemRole.PermissionCode;
}

export interface PermissionGroup {
  key: string;
  label: string;
  options: PermissionGroupOption[];
}

export interface RolePermissionChangePreview {
  added: Api.SystemRole.PermissionCode[];
  removed: Api.SystemRole.PermissionCode[];
  addedLabels: string[];
  removedLabels: string[];
  changed: boolean;
}

const permissionLabelMap = new Map(crmPermissionDefinitions.map(item => [item.code, item.label]));

export const roleStatusOptions = [
  { label: '启用', value: 'enabled' },
  { label: '禁用', value: 'disabled' }
] satisfies Array<{ label: string; value: Api.SystemRole.RoleStatus }>;

export const roleStatusLabelMap: Record<Api.SystemRole.RoleStatus, string> = {
  enabled: '启用',
  disabled: '禁用'
};

export const roleStatusTagTypeMap: Record<Api.SystemRole.RoleStatus, NaiveUI.ThemeColor> = {
  enabled: 'success',
  disabled: 'error'
};

export const rolePermissionGroups: PermissionGroup[] = Array.from(
  crmPermissionDefinitions
    .reduce((groups, permission) => {
      const group = groups.get(permission.group) || {
        key: permission.group,
        label: permission.groupLabel,
        options: [] as PermissionGroupOption[]
      };

      group.options.push({
        label: permission.label,
        value: permission.code
      });
      groups.set(permission.group, group);

      return groups;
    }, new Map<string, PermissionGroup>())
    .values()
);

/** Create the default filter object for role management. */
export function createDefaultRoleFilterModel(): Api.SystemRole.RoleFilterModel {
  return {
    keyword: '',
    status: null
  };
}

/** Build role list query params from pagination and current filters. */
export function buildSystemRoleSearchParams(options: {
  current: number;
  size: number;
  filterModel: Api.SystemRole.RoleFilterModel;
}): Api.SystemRole.RoleSearchParams {
  const { current, size, filterModel } = options;
  const params: Api.SystemRole.RoleSearchParams = {
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

/** Resolve the display label of one permission code. */
export function getPermissionLabel(code: Api.SystemRole.PermissionCode) {
  return permissionLabelMap.get(code) || code;
}

/** Normalize role permission checkbox selections with write-to-read implications. */
export function normalizeRolePermissionSelection(values: readonly string[]) {
  return normalizePermissionCodes(values) as Api.SystemRole.PermissionCode[];
}

/** Build a compact before/after summary for role permission saves. */
export function buildRolePermissionChangePreview(
  before: readonly Api.SystemRole.PermissionCode[],
  after: readonly Api.SystemRole.PermissionCode[]
): RolePermissionChangePreview {
  const normalizedBefore = normalizeRolePermissionSelection(before);
  const normalizedAfter = normalizeRolePermissionSelection(after);
  const beforeSet = new Set(normalizedBefore);
  const afterSet = new Set(normalizedAfter);
  const added = normalizedAfter.filter(code => !beforeSet.has(code));
  const removed = normalizedBefore.filter(code => !afterSet.has(code));

  return {
    added,
    removed,
    addedLabels: added.map(getPermissionLabel),
    removedLabels: removed.map(getPermissionLabel),
    changed: added.length > 0 || removed.length > 0
  };
}
