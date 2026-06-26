export type SystemOrganizationStatus = 'enabled' | 'disabled';

export interface SystemOrganizationSearchParams {
  current?: number;
  size?: number;
  keyword?: string;
  status?: SystemOrganizationStatus;
}

export interface SystemOrganizationListItem {
  id: string;
  name: string;
  status: SystemOrganizationStatus;
  userCount: number;
  adminCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SystemOrganizationSelectItem {
  id: string;
  name: string;
}

export interface SystemOrganizationOperateInput {
  name: string;
  status?: SystemOrganizationStatus;
}

export type SystemOrganizationUpdateInput = Partial<SystemOrganizationOperateInput>;
