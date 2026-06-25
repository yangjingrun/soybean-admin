import { request } from '../request';

/**
 * Login
 *
 * @param userName User name
 * @param password Password
 */
export function fetchLogin(userName: string, password: string, captchaId?: string, captchaCode?: string) {
  return request<Api.Auth.LoginToken>({
    url: '/auth/login',
    method: 'post',
    data: {
      userName,
      password,
      captchaId,
      captchaCode
    }
  });
}

/** Get image captcha */
export function fetchImageCaptcha() {
  return request<Api.Auth.ImageCaptchaResult>({
    url: '/auth/captcha'
  });
}

/** Get user info */
export function fetchGetUserInfo() {
  return request<Api.Auth.UserInfo>({ url: '/auth/getUserInfo' });
}

/**
 * Refresh token
 *
 * @param refreshToken Refresh token
 */
export function fetchRefreshToken(refreshToken: string) {
  return request<Api.Auth.LoginToken>({
    url: '/auth/refreshToken',
    method: 'post',
    data: {
      refreshToken
    }
  });
}

/** Logout current user and let backend record the logout action. */
export function fetchLogout() {
  return request<null>({
    url: '/auth/logout',
    method: 'post'
  });
}

/** Change current user's password. */
export function changeCurrentUserPassword(data: Api.Auth.ChangePasswordPayload) {
  return request<null>({
    url: '/auth/change-password',
    method: 'post',
    data
  });
}

/** Update current user's editable profile. */
export function updateCurrentUserProfile(data: Api.Auth.UpdateCurrentUserProfilePayload) {
  return request<Api.Auth.UserInfo>({
    url: '/auth/profile',
    method: 'patch',
    data
  });
}

/**
 * return custom backend error
 *
 * @param code error code
 * @param msg error message
 */
export function fetchCustomBackendError(code: string, msg: string) {
  return request({ url: '/auth/error', params: { code, msg } });
}
