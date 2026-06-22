import { crmPermissionDefinitions, normalizePermissionCodes } from '@soybean/shared';
const permissionLabelMap = new Map(crmPermissionDefinitions.map(item => [item.code, item.label]));
export const roleStatusOptions = [
  { label: '启用', value: 'enabled' },
  { label: '禁用', value: 'disabled' }
];
export const roleStatusLabelMap = {
  enabled: '启用',
  disabled: '禁用'
};
export const roleStatusTagTypeMap = {
  enabled: 'success',
  disabled: 'error'
};
export const rolePermissionGroups = Array.from(
  crmPermissionDefinitions
    .reduce((groups, permission) => {
      const group = groups.get(permission.group) || {
        key: permission.group,
        label: permission.groupLabel,
        description: permission.functionLabel,
        options: []
      };
      group.options.push({
        actionLabel: permission.actionLabel,
        description: permission.description,
        label: permission.label,
        value: permission.code
      });
      groups.set(permission.group, group);
      return groups;
    }, new Map())
    .values()
);
export const rolePermissionModules = buildRolePermissionModules();
/** Build nested module/page/function groups from the shared permission dictionary. */
function buildRolePermissionModules() {
  const modules = new Map();
  for (const permission of crmPermissionDefinitions) {
    const module = getOrCreateModule(modules, permission.module, permission.moduleLabel);
    const page = getOrCreatePage(module, permission.page, permission.pageLabel);
    const group = getOrCreateGroup(page, permission.group, permission.groupLabel, permission.functionLabel);
    group.options.push({
      actionLabel: permission.actionLabel,
      description: permission.description,
      label: permission.label,
      value: permission.code
    });
  }
  return Array.from(modules.values());
}
function getOrCreateModule(modules, key, label) {
  const existing = modules.get(key);
  if (existing) {
    return existing;
  }
  const module = {
    key,
    label,
    pages: []
  };
  modules.set(key, module);
  return module;
}
function getOrCreatePage(module, key, label) {
  const existing = module.pages.find(page => page.key === key);
  if (existing) {
    return existing;
  }
  const page = {
    key,
    label,
    groups: []
  };
  module.pages.push(page);
  return page;
}
function getOrCreateGroup(page, key, label, description) {
  const existing = page.groups.find(group => group.key === key);
  if (existing) {
    return existing;
  }
  const group = {
    key,
    label,
    description,
    options: []
  };
  page.groups.push(group);
  return group;
}
/** Create the default filter object for role management. */
export function createDefaultRoleFilterModel() {
  return {
    keyword: '',
    status: null
  };
}
/** Build role list query params from pagination and current filters. */
export function buildSystemRoleSearchParams(options) {
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
/** Resolve the display label of one permission code. */
export function getPermissionLabel(code) {
  return permissionLabelMap.get(code) || code;
}
/** Normalize role permission checkbox selections with write-to-read implications. */
export function normalizeRolePermissionSelection(values) {
  return normalizePermissionCodes(values);
}
/** Build a compact before/after summary for role permission saves. */
export function buildRolePermissionChangePreview(before, after) {
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
