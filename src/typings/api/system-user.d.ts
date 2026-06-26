declare namespace Api {
  namespace SystemUser {
    type UserRole = string;

    type PermissionCode = import('@soybean/shared').PermissionCode;

    type UserStatus = 'enabled' | 'disabled';

    type UserExpirationStatus = 'expired' | 'active';

    type OrganizationRole = 'admin' | 'member';

    interface UserListItem {
      id: string;
      userName: string;
      nickName: string | null;
      phone: string | null;
      email: string | null;
      roles: UserRole[];
      permissions: PermissionCode[];
      status: UserStatus;
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

    interface UserSearchParams extends Api.Common.CommonSearchParams {
      keyword?: string;
      organizationId?: string;
      role?: UserRole;
      status?: UserStatus;
      expirationStatus?: UserExpirationStatus;
    }

    interface UserFilterModel {
      keyword: string;
      organizationId: string | null;
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
      status?: UserStatus;
      organizationId?: string;
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
