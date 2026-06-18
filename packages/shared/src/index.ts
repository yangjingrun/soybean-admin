export interface ApiResponse<T> {
  code: string;
  msg: string;
  data: T;
}

export interface LoginToken {
  token: string;
  refreshToken: string;
}

export type OrganizationRole = 'admin' | 'member';

export const DEFAULT_ORGANIZATION_ID = 'org-default';

export const DEFAULT_ORGANIZATION_NAME = '默认组织';

export interface UserInfo {
  userId: string;
  userName: string;
  roles: string[];
  buttons: string[];
  organizationId: string;
  organizationName: string;
  organizationRole: OrganizationRole;
}

export interface ImageCaptchaResult {
  captchaId: string;
  svg: string;
  expiresIn: number;
}
