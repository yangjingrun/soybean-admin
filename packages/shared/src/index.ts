export interface ApiResponse<T> {
  code: string;
  msg: string;
  data: T;
}

export interface LoginToken {
  token: string;
  refreshToken: string;
}

export interface UserInfo {
  userId: string;
  userName: string;
  roles: string[];
  buttons: string[];
}

export interface ImageCaptchaResult {
  captchaId: string;
  svg: string;
  expiresIn: number;
}
