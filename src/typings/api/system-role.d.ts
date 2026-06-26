declare namespace Api {
  namespace SystemRole {
    type RoleStatus = 'enabled' | 'disabled';

    type PermissionCode = import('@soybean/shared').PermissionCode;

    interface RoleListItem {
      id: string;
      roleName: string;
      roleCode: string;
      roleDesc: string | null;
      permissions: PermissionCode[];
      status: RoleStatus;
      builtIn: boolean;
      createdAt: string;
      updatedAt: string;
    }

    interface RoleSearchParams extends Api.Common.CommonSearchParams {
      keyword?: string;
      status?: RoleStatus;
    }

    interface RoleFilterModel {
      keyword: string;
      status: RoleStatus | null;
    }

    interface RoleOperatePayload {
      roleName: string;
      roleCode: string;
      roleDesc?: string | null;
      status?: RoleStatus;
    }

    type RoleCreatePayload = RoleOperatePayload & {
      permissions?: PermissionCode[];
    };

    type RoleUpdatePayload = Partial<Omit<RoleOperatePayload, 'roleCode'>>;

    interface RolePermissionsPayload {
      permissions: PermissionCode[];
    }

    type RoleList = Api.Common.PaginatingQueryRecord<RoleListItem>;
  }
}
