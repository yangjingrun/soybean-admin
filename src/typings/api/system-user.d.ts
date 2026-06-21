declare namespace Api {
  namespace SystemUser {
    type UserRole = 'R_SUPER' | 'R_ADMIN' | 'R_USER';

    type PermissionCode = import('@soybean/shared').PermissionCode;

    type UserStatus = 'enabled' | 'disabled';

    type UserExpirationStatus = 'expired' | 'active';

    interface UserListItem {
      id: string;
      userName: string;
      nickName: string | null;
      phone: string | null;
      email: string | null;
      roles: UserRole[];
      permissions: PermissionCode[];
      status: UserStatus;
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

    interface UserSearchParams extends Api.Common.CommonSearchParams {
      keyword?: string;
      role?: UserRole;
      status?: UserStatus;
      expirationStatus?: UserExpirationStatus;
    }

    interface UserFilterModel {
      keyword: string;
      role: UserRole | null;
      status: UserStatus | null;
      expirationStatus: UserExpirationStatus | null;
    }

    interface UserOperatePayload {
      userName: string;
      nickName?: string | null;
      phone?: string | null;
      email?: string | null;
      roles: UserRole[];
      permissions?: PermissionCode[];
      status?: UserStatus;
      companyName?: string | null;
      expireAt?: string | null;
      remark?: string | null;
    }

    type UserCreatePayload = UserOperatePayload;

    type UserUpdatePayload = Partial<UserOperatePayload> & {
      roles?: UserRole[];
    };

    interface UserStatusPayload {
      status: UserStatus;
    }

    interface UserWithTemporaryPassword {
      user: UserListItem;
      temporaryPassword: string;
    }

    type UserList = Api.Common.PaginatingQueryRecord<UserListItem>;
  }
}
