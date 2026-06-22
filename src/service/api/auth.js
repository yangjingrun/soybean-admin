import { request } from '../request';
/**
 * Login
 *
 * @param userName User name
 * @param password Password
 */
export function fetchLogin(userName, password, captchaId, captchaCode) {
  return request({
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
  return request({
    url: '/auth/captcha'
  });
}
/** Get user info */
export function fetchGetUserInfo() {
  return request({ url: '/auth/getUserInfo' });
}
/**
 * Refresh token
 *
 * @param refreshToken Refresh token
 */
export function fetchRefreshToken(refreshToken) {
  return request({
    url: '/auth/refreshToken',
    method: 'post',
    data: {
      refreshToken
    }
  });
}
/** Logout current user and let backend record the logout action. */
export function fetchLogout() {
  return request({
    url: '/auth/logout',
    method: 'post'
  });
}
/** Change current user's password. */
export function changeCurrentUserPassword(data) {
  return request({
    url: '/auth/change-password',
    method: 'post',
    data
  });
}
/**
 * return custom backend error
 *
 * @param code error code
 * @param msg error message
 */
export function fetchCustomBackendError(code, msg) {
  return request({ url: '/auth/error', params: { code, msg } });
}
