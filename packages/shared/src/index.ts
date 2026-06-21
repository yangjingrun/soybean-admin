export interface ApiResponse<T> {
  code: string;
  msg: string;
  data: T;
}

export interface LoginToken {
  token: string;
  refreshToken: string;
}

export type OrganizationRole = 'admin' | 'member';

export const DEFAULT_ORGANIZATION_ID = 'org-default';

export const DEFAULT_ORGANIZATION_NAME = '默认组织';

export const crmPermissionDefinitions = [
  {
    code: 'crm:settings:assets:read',
    label: '查看写信资料',
    group: 'crm_settings_assets',
    groupLabel: 'CRM 写信资料'
  },
  {
    code: 'crm:settings:assets:write',
    label: '维护写信资料',
    group: 'crm_settings_assets',
    groupLabel: 'CRM 写信资料'
  },
  {
    code: 'crm:settings:rules:read',
    label: '查看发送规则',
    group: 'crm_settings_rules',
    groupLabel: 'CRM 发送规则'
  },
  {
    code: 'crm:settings:rules:write',
    label: '维护发送规则',
    group: 'crm_settings_rules',
    groupLabel: 'CRM 发送规则'
  },
  {
    code: 'crm:settings:safety:read',
    label: '查看安全拦截',
    group: 'crm_settings_safety',
    groupLabel: 'CRM 安全拦截'
  },
  {
    code: 'crm:settings:safety:write',
    label: '维护安全拦截',
    group: 'crm_settings_safety',
    groupLabel: 'CRM 安全拦截'
  },
  {
    code: 'crm:settings:global:write',
    label: '维护全局配置',
    group: 'crm_settings_platform',
    groupLabel: 'CRM 平台运维'
  },
  {
    code: 'crm:settings:ai-draft-queue:write',
    label: '维护 AI 草稿队列',
    group: 'crm_settings_platform',
    groupLabel: 'CRM 平台运维'
  },
  {
    code: 'crm:settings:operations:write',
    label: '执行运维诊断',
    group: 'crm_settings_platform',
    groupLabel: 'CRM 平台运维'
  }
] as const;

export type PermissionCode = (typeof crmPermissionDefinitions)[number]['code'];

export const crmPermissionCodes = crmPermissionDefinitions.map(item => item.code) as PermissionCode[];

const crmPermissionCodeSet = new Set<string>(crmPermissionCodes);

const roleDefaultPermissionCodes: Record<string, PermissionCode[]> = {
  R_SUPER: [...crmPermissionCodes],
  R_ADMIN: [
    'crm:settings:assets:read',
    'crm:settings:assets:write',
    'crm:settings:rules:read',
    'crm:settings:rules:write',
    'crm:settings:safety:read',
    'crm:settings:safety:write'
  ],
  R_USER: []
};

const permissionImplications: Partial<Record<PermissionCode, PermissionCode[]>> = {
  'crm:settings:assets:write': ['crm:settings:assets:read'],
  'crm:settings:rules:write': ['crm:settings:rules:read'],
  'crm:settings:safety:write': ['crm:settings:safety:read']
};

/** Check whether a string is one of the product permission codes. */
export function isPermissionCode(value: string): value is PermissionCode {
  return crmPermissionCodeSet.has(value);
}

/** Return unknown permission codes for backend DTO and service validation. */
export function getInvalidPermissionCodes(values: readonly string[] = []) {
  return values.filter(value => !isPermissionCode(value));
}

/** Keep permission order stable by following the shared definition order. */
export function normalizePermissionCodes(values: readonly string[] = []) {
  const selected = new Set<PermissionCode>();

  for (const value of values) {
    if (isPermissionCode(value)) {
      selected.add(value);

      for (const impliedPermission of permissionImplications[value] || []) {
        selected.add(impliedPermission);
      }
    }
  }

  return crmPermissionCodes.filter(code => selected.has(code));
}

/** Resolve default persisted permissions for a role selection. */
export function getDefaultPermissionCodesByRoles(roles: readonly string[] = []) {
  const defaults = roles.flatMap(role => roleDefaultPermissionCodes[role] || []);

  return normalizePermissionCodes(defaults);
}

/** Resolve runtime permissions, granting all permissions to platform super users. */
export function resolveEffectivePermissions(input: { roles: readonly string[]; permissions?: readonly string[] }) {
  if (input.roles.includes('R_SUPER')) {
    return [...crmPermissionCodes];
  }

  return normalizePermissionCodes(input.permissions || []);
}

/** Check a runtime user snapshot against one product permission code. */
export function hasPermission(input: { roles: readonly string[]; buttons?: readonly string[] }, code: PermissionCode) {
  return resolveEffectivePermissions({ roles: input.roles, permissions: input.buttons }).includes(code);
}

export interface UserInfo {
  userId: string;
  userName: string;
  roles: string[];
  buttons: string[];
  organizationId: string;
  organizationName: string;
  organizationRole: OrganizationRole;
}

export interface ImageCaptchaResult {
  captchaId: string;
  svg: string;
  expiresIn: number;
}
