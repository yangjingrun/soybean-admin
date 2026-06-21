export interface CrmSettingsAccessInput {
  organizationRole: Api.Auth.UserInfo['organizationRole'];
  roles: string[];
}

export interface CrmSettingsTabVisibility {
  assets: boolean;
  operations: boolean;
  rules: boolean;
  safety: boolean;
  start: boolean;
}

/** Build role-aware CRM settings tab visibility to keep member setup focused. */
export function buildCrmSettingsTabVisibility(input: CrmSettingsAccessInput): CrmSettingsTabVisibility {
  const isSuperAdmin = input.roles.includes('R_SUPER');
  const canManageOrganization = isSuperAdmin || input.organizationRole === 'admin';

  return {
    assets: canManageOrganization,
    operations: isSuperAdmin,
    rules: canManageOrganization,
    safety: canManageOrganization,
    start: true
  };
}
