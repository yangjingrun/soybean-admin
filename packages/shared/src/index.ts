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

export const aiLeadsKeywordStrategyManagePermission = 'ai-leads:keyword-strategy:manage';
export const aiLeadsQueueConfigManagePermission = 'ai-leads:queue-config:manage';
export const aiSettingsModelManagePermission = 'ai:settings:model:manage';
export const aiSettingsPromptManagePermission = 'ai:settings:prompt:manage';
export const aiSettingsSerperManagePermission = 'ai:settings:serper:manage';
export const aiSettingsHunterManagePermission = 'ai:settings:hunter:manage';

export const crmPermissionDefinitions = [
  {
    code: aiLeadsKeywordStrategyManagePermission,
    label: '维护 AI 获客搜索策略',
    actionLabel: '维护',
    group: 'ai_leads',
    groupLabel: 'AI 获客',
    module: 'ai_leads',
    moduleLabel: 'AI 获客',
    page: 'ai_leads',
    pageLabel: 'AI 获客',
    functionLabel: '搜索策略',
    description: '编辑关键词历史、Serper 查询包和调试详情。'
  },
  {
    code: aiLeadsQueueConfigManagePermission,
    label: '维护后台任务配置',
    actionLabel: '维护',
    group: 'ai_leads_queue',
    groupLabel: '后台任务',
    module: 'ai_platform',
    moduleLabel: 'AI 平台配置',
    page: 'ai_platform_model_config',
    pageLabel: '模型配置',
    functionLabel: 'AI 获客后台任务',
    description: '调整 AI 获客搜索采集 worker 并发。'
  },
  {
    code: aiSettingsModelManagePermission,
    label: '配置模型通道',
    actionLabel: '配置',
    group: 'ai_settings_model',
    groupLabel: '模型通道',
    module: 'ai_platform',
    moduleLabel: 'AI 平台配置',
    page: 'ai_platform_model_config',
    pageLabel: '模型配置',
    functionLabel: '默认模型通道',
    description: '查看、保存并测试默认模型供应商、Base URL、模型名和 API Key。'
  },
  {
    code: aiSettingsSerperManagePermission,
    label: '配置 Serper 搜索',
    actionLabel: '配置',
    group: 'ai_settings_serper',
    groupLabel: 'Serper 搜索',
    module: 'ai_platform',
    moduleLabel: 'AI 平台配置',
    page: 'ai_platform_model_config',
    pageLabel: '模型配置',
    functionLabel: 'Serper 搜索配置',
    description: '查看、保存并测试 Google Search/Places 的 Base URL 和 API Key。'
  },
  {
    code: aiSettingsHunterManagePermission,
    label: '配置 Hunter 补全',
    actionLabel: '配置',
    group: 'ai_settings_hunter',
    groupLabel: 'Hunter 补全',
    module: 'ai_platform',
    moduleLabel: 'AI 平台配置',
    page: 'ai_platform_model_config',
    pageLabel: '模型配置',
    functionLabel: 'Hunter 邮箱补全',
    description: '查看、保存并测试 Hunter Domain Search 的 Base URL 和 API Key。'
  },
  {
    code: aiSettingsPromptManagePermission,
    label: '配置提示词',
    actionLabel: '配置',
    group: 'ai_settings_prompt',
    groupLabel: '提示词',
    module: 'ai_platform',
    moduleLabel: 'AI 平台配置',
    page: 'ai_platform_prompt_config',
    pageLabel: '提示词配置',
    functionLabel: 'AI 获客提示词',
    description: '查看、保存并测试 AI 获客固定系统提示词。'
  },
  {
    code: 'crm:settings:assets:read',
    label: '查看写信资料',
    actionLabel: '查看',
    group: 'crm_settings_assets',
    groupLabel: '写信资料',
    module: 'crm',
    moduleLabel: 'CRM',
    page: 'crm_settings',
    pageLabel: 'CRM 配置',
    functionLabel: '写信资料',
    description: '查看产品线、客户画像和邮件模板。'
  },
  {
    code: 'crm:settings:assets:write',
    label: '维护写信资料',
    actionLabel: '维护',
    group: 'crm_settings_assets',
    groupLabel: '写信资料',
    module: 'crm',
    moduleLabel: 'CRM',
    page: 'crm_settings',
    pageLabel: 'CRM 配置',
    functionLabel: '写信资料',
    description: '新增、编辑、归档产品线、客户画像和邮件模板。'
  },
  {
    code: 'crm:settings:rules:read',
    label: '查看发送规则',
    actionLabel: '查看',
    group: 'crm_settings_rules',
    groupLabel: '发送规则',
    module: 'crm',
    moduleLabel: 'CRM',
    page: 'crm_settings',
    pageLabel: 'CRM 配置',
    functionLabel: '发送规则',
    description: '查看发信邮箱、发送偏好、默认模板和序列策略。'
  },
  {
    code: 'crm:settings:rules:write',
    label: '维护发送规则',
    actionLabel: '维护',
    group: 'crm_settings_rules',
    groupLabel: '发送规则',
    module: 'crm',
    moduleLabel: 'CRM',
    page: 'crm_settings',
    pageLabel: 'CRM 配置',
    functionLabel: '发送规则',
    description: '维护发信邮箱、发送偏好、默认模板和序列策略。'
  },
  {
    code: 'crm:settings:safety:read',
    label: '查看安全拦截',
    actionLabel: '查看',
    group: 'crm_settings_safety',
    groupLabel: '安全拦截',
    module: 'crm',
    moduleLabel: 'CRM',
    page: 'crm_settings',
    pageLabel: 'CRM 配置',
    functionLabel: '安全拦截',
    description: '查看退订、黑名单和安全拦截记录。'
  },
  {
    code: 'crm:settings:safety:write',
    label: '维护安全拦截',
    actionLabel: '维护',
    group: 'crm_settings_safety',
    groupLabel: '安全拦截',
    module: 'crm',
    moduleLabel: 'CRM',
    page: 'crm_settings',
    pageLabel: 'CRM 配置',
    functionLabel: '安全拦截',
    description: '移除或维护黑名单和安全拦截数据。'
  },
  {
    code: 'crm:settings:global:write',
    label: '维护全局配置',
    actionLabel: '维护',
    group: 'crm_settings_platform',
    groupLabel: '平台运维',
    module: 'crm',
    moduleLabel: 'CRM',
    page: 'crm_settings',
    pageLabel: 'CRM 配置',
    functionLabel: '全局配置',
    description: '维护邮件验证冷却期、发送上限和跟进默认间隔。'
  },
  {
    code: 'crm:settings:ai-draft-queue:write',
    label: '维护 AI 草稿队列',
    actionLabel: '维护',
    group: 'crm_settings_platform',
    groupLabel: '平台运维',
    module: 'crm',
    moduleLabel: 'CRM',
    page: 'crm_settings',
    pageLabel: 'CRM 配置',
    functionLabel: 'AI 草稿队列',
    description: '维护 CRM AI 草稿队列并发、重试和活跃任务限制。'
  },
  {
    code: 'crm:settings:operations:write',
    label: '执行运维诊断',
    actionLabel: '执行',
    group: 'crm_settings_platform',
    groupLabel: '平台运维',
    module: 'crm',
    moduleLabel: 'CRM',
    page: 'crm_settings',
    pageLabel: 'CRM 配置',
    functionLabel: '运维诊断',
    description: '执行发送队列对账等 CRM 运维诊断动作。'
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
