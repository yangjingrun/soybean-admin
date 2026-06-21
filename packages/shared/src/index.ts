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
export const aiSettingsModelReadPermission = 'ai:settings:model:read';
export const aiSettingsModelWritePermission = 'ai:settings:model:write';
export const aiSettingsModelTestPermission = 'ai:settings:model:test';
export const aiSettingsPromptReadPermission = 'ai:settings:prompt:read';
export const aiSettingsPromptWritePermission = 'ai:settings:prompt:write';
export const aiSettingsPromptTestPermission = 'ai:settings:prompt:test';
export const aiSettingsSerperReadPermission = 'ai:settings:serper:read';
export const aiSettingsSerperWritePermission = 'ai:settings:serper:write';
export const aiSettingsSerperTestPermission = 'ai:settings:serper:test';
export const aiSettingsHunterReadPermission = 'ai:settings:hunter:read';
export const aiSettingsHunterWritePermission = 'ai:settings:hunter:write';
export const aiSettingsHunterTestPermission = 'ai:settings:hunter:test';

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
    code: aiSettingsModelReadPermission,
    label: '查看模型配置',
    actionLabel: '查看',
    group: 'ai_settings_model',
    groupLabel: '模型通道',
    module: 'ai_platform',
    moduleLabel: 'AI 平台配置',
    page: 'ai_platform_model_config',
    pageLabel: '模型配置',
    functionLabel: '默认模型通道',
    description: '查看默认模型供应商、Base URL、模型名和密钥状态。'
  },
  {
    code: aiSettingsModelWritePermission,
    label: '维护模型配置',
    actionLabel: '维护',
    group: 'ai_settings_model',
    groupLabel: '模型通道',
    module: 'ai_platform',
    moduleLabel: 'AI 平台配置',
    page: 'ai_platform_model_config',
    pageLabel: '模型配置',
    functionLabel: '默认模型通道',
    description: '保存默认模型供应商、Base URL、模型名和 API Key。'
  },
  {
    code: aiSettingsModelTestPermission,
    label: '测试模型配置',
    actionLabel: '测试',
    group: 'ai_settings_model',
    groupLabel: '模型通道',
    module: 'ai_platform',
    moduleLabel: 'AI 平台配置',
    page: 'ai_platform_model_config',
    pageLabel: '模型配置',
    functionLabel: '默认模型通道',
    description: '在模型配置页发送轻量测试请求。'
  },
  {
    code: aiSettingsSerperReadPermission,
    label: '查看 Serper 配置',
    actionLabel: '查看',
    group: 'ai_settings_serper',
    groupLabel: 'Serper 搜索',
    module: 'ai_platform',
    moduleLabel: 'AI 平台配置',
    page: 'ai_platform_model_config',
    pageLabel: '模型配置',
    functionLabel: 'Serper 搜索配置',
    description: '查看 Google Search/Places 搜索配置和密钥状态。'
  },
  {
    code: aiSettingsSerperWritePermission,
    label: '维护 Serper 配置',
    actionLabel: '维护',
    group: 'ai_settings_serper',
    groupLabel: 'Serper 搜索',
    module: 'ai_platform',
    moduleLabel: 'AI 平台配置',
    page: 'ai_platform_model_config',
    pageLabel: '模型配置',
    functionLabel: 'Serper 搜索配置',
    description: '保存 Serper Base URL 和 API Key。'
  },
  {
    code: aiSettingsSerperTestPermission,
    label: '测试 Serper 配置',
    actionLabel: '测试',
    group: 'ai_settings_serper',
    groupLabel: 'Serper 搜索',
    module: 'ai_platform',
    moduleLabel: 'AI 平台配置',
    page: 'ai_platform_model_config',
    pageLabel: '模型配置',
    functionLabel: 'Serper 搜索配置',
    description: '调用 Serper 测试搜索连通性。'
  },
  {
    code: aiSettingsHunterReadPermission,
    label: '查看 Hunter 配置',
    actionLabel: '查看',
    group: 'ai_settings_hunter',
    groupLabel: 'Hunter 补全',
    module: 'ai_platform',
    moduleLabel: 'AI 平台配置',
    page: 'ai_platform_model_config',
    pageLabel: '模型配置',
    functionLabel: 'Hunter 邮箱补全',
    description: '查看 Hunter Domain Search 配置和密钥状态。'
  },
  {
    code: aiSettingsHunterWritePermission,
    label: '维护 Hunter 配置',
    actionLabel: '维护',
    group: 'ai_settings_hunter',
    groupLabel: 'Hunter 补全',
    module: 'ai_platform',
    moduleLabel: 'AI 平台配置',
    page: 'ai_platform_model_config',
    pageLabel: '模型配置',
    functionLabel: 'Hunter 邮箱补全',
    description: '保存 Hunter Base URL 和 API Key。'
  },
  {
    code: aiSettingsHunterTestPermission,
    label: '测试 Hunter 配置',
    actionLabel: '测试',
    group: 'ai_settings_hunter',
    groupLabel: 'Hunter 补全',
    module: 'ai_platform',
    moduleLabel: 'AI 平台配置',
    page: 'ai_platform_model_config',
    pageLabel: '模型配置',
    functionLabel: 'Hunter 邮箱补全',
    description: '调用 Hunter Domain Search 测试连通性。'
  },
  {
    code: aiSettingsPromptReadPermission,
    label: '查看提示词配置',
    actionLabel: '查看',
    group: 'ai_settings_prompt',
    groupLabel: '提示词',
    module: 'ai_platform',
    moduleLabel: 'AI 平台配置',
    page: 'ai_platform_prompt_config',
    pageLabel: '提示词配置',
    functionLabel: 'AI 获客提示词',
    description: '查看关键词优化、搜索决策、匹配分析和开发信提示词。'
  },
  {
    code: aiSettingsPromptWritePermission,
    label: '维护提示词配置',
    actionLabel: '维护',
    group: 'ai_settings_prompt',
    groupLabel: '提示词',
    module: 'ai_platform',
    moduleLabel: 'AI 平台配置',
    page: 'ai_platform_prompt_config',
    pageLabel: '提示词配置',
    functionLabel: 'AI 获客提示词',
    description: '保存 AI 获客固定系统提示词。'
  },
  {
    code: aiSettingsPromptTestPermission,
    label: '测试提示词配置',
    actionLabel: '测试',
    group: 'ai_settings_prompt',
    groupLabel: '提示词',
    module: 'ai_platform',
    moduleLabel: 'AI 平台配置',
    page: 'ai_platform_prompt_config',
    pageLabel: '提示词配置',
    functionLabel: 'AI 获客提示词',
    description: '打开提示词测试弹窗并发送测试请求。'
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
  [aiSettingsModelWritePermission]: [aiSettingsModelReadPermission],
  [aiSettingsModelTestPermission]: [aiSettingsModelReadPermission],
  [aiSettingsPromptWritePermission]: [aiSettingsPromptReadPermission],
  [aiSettingsPromptTestPermission]: [aiSettingsPromptReadPermission],
  [aiSettingsSerperWritePermission]: [aiSettingsSerperReadPermission],
  [aiSettingsSerperTestPermission]: [aiSettingsSerperReadPermission],
  [aiSettingsHunterWritePermission]: [aiSettingsHunterReadPermission],
  [aiSettingsHunterTestPermission]: [aiSettingsHunterReadPermission],
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
