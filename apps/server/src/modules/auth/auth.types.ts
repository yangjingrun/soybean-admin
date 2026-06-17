import type { ImageCaptchaResult, LoginToken, UserInfo } from '@soybean/shared';

export type { ImageCaptchaResult, LoginToken, UserInfo };

export interface DemoUser extends UserInfo {
  password: string;
}
