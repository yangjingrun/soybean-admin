declare namespace Api {
  namespace SystemUser {
    type UserStatus = 'enabled';

    interface UserListItem {
      userId: string;
      userName: string;
      roles: string[];
      buttons: string[];
      status: UserStatus;
    }

    interface UserSearchParams extends Api.Common.CommonSearchParams {
      keyword?: string;
      role?: string;
    }

    interface UserFilterModel {
      keyword: string;
      role: string | null;
    }

    type UserList = Api.Common.PaginatingQueryRecord<UserListItem>;
  }
}
