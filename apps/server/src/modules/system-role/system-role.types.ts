import type { PermissionCode } from '@soybean/shared';

export type SystemRoleStatus = 'enabled' | 'disabled';

export interface SystemRoleSearchParams {
  current?: number;
  size?: number;
  keyword?: string;
  status?: SystemRoleStatus;
}

export interface SystemRoleListItem {
  id: string;
  roleName: string;
  roleCode: string;
  roleDesc: string | null;
  permissions: PermissionCode[];
  status: SystemRoleStatus;
  builtIn: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SystemRoleOperateInput {
  roleName: string;
  roleCode: string;
  roleDesc?: string | null;
  permissions?: PermissionCode[];
  status?: SystemRoleStatus;
}

export type SystemRoleUpdateInput = Partial<Omit<SystemRoleOperateInput, 'roleCode'>> & {
  roleCode?: string;
};
