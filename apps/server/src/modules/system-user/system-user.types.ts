import type { OrganizationRole, PermissionCode } from '@soybean/shared';

export type SystemUserRole = string;

export type SystemUserStatus = 'enabled' | 'disabled';

export type SystemUserExpirationStatus = 'active' | 'expired';

export interface SystemUserSearchParams {
  current?: number;
  size?: number;
  keyword?: string;
  organizationId?: string;
  role?: SystemUserRole;
  status?: SystemUserStatus;
  expirationStatus?: SystemUserExpirationStatus;
}

export interface SystemUserListItem {
  id: string;
  userName: string;
  nickName: string | null;
  phone: string | null;
  email: string | null;
  roles: SystemUserRole[];
  permissions: PermissionCode[];
  status: SystemUserStatus;
  organizationId: string;
  organizationName: string;
  organizationRole: OrganizationRole;
  companyName: string | null;
  expireAt: string | null;
  remark: string | null;
  lastLoginAt: string | null;
  lastLoginIp: string | null;
  lockedUntil: string | null;
  expired: boolean;
  locked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SystemUserList {
  current: number;
  size: number;
  total: number;
  records: SystemUserListItem[];
}

export interface SystemUserOperateInput {
  userName: string;
  nickName?: string | null;
  phone?: string | null;
  email?: string | null;
  roles: SystemUserRole[];
  status?: SystemUserStatus;
  organizationId?: string;
  companyName?: string | null;
  expireAt?: string | null;
  remark?: string | null;
}

export type SystemUserUpdateInput = Partial<SystemUserOperateInput>;

export interface SystemUserWithTemporaryPassword {
  user: SystemUserListItem;
  temporaryPassword: string;
}
