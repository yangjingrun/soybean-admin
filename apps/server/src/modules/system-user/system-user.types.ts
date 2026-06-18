export type SystemUserRole = 'R_SUPER' | 'R_ADMIN' | 'R_USER';

export type SystemUserStatus = 'enabled' | 'disabled';

export type SystemUserExpirationStatus = 'active' | 'expired';

export interface SystemUserSearchParams {
  current?: number;
  size?: number;
  keyword?: string;
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
  status: SystemUserStatus;
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
  companyName?: string | null;
  expireAt?: string | null;
  remark?: string | null;
}

export type SystemUserUpdateInput = Partial<SystemUserOperateInput>;

export interface SystemUserWithTemporaryPassword {
  user: SystemUserListItem;
  temporaryPassword: string;
}
