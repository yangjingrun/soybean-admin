export interface SystemUserSearchParams {
  current?: number;
  size?: number;
  keyword?: string;
  role?: string;
}

export interface SystemUserListItem {
  userId: string;
  userName: string;
  roles: string[];
  buttons: string[];
  status: 'enabled';
}

export interface SystemUserList {
  current: number;
  size: number;
  total: number;
  records: SystemUserListItem[];
}
