import type {
  ImageCaptchaResult as SharedImageCaptchaResult,
  LoginToken as SharedLoginToken,
  UserInfo as SharedUserInfo
} from '@soybean/shared';

declare global {
  namespace Api {
    /**
     * namespace Auth
     *
     * backend api module: "auth"
     */
    namespace Auth {
      type LoginToken = SharedLoginToken;

      type UserInfo = SharedUserInfo;

      type ImageCaptchaResult = SharedImageCaptchaResult;

      interface ChangePasswordPayload {
        oldPassword: string;
        newPassword: string;
      }
    }
  }
}

export {};
