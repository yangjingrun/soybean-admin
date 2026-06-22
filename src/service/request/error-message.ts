import type { AxiosError } from '@sa/axios';

type BackendErrorBody = {
  msg?: unknown;
  message?: unknown;
  code?: unknown;
};

type BackendErrorCodeAction = 'logout' | 'modalLogout' | 'expiredToken' | 'none';

interface BackendErrorCodeActionConfig {
  logoutCodes: string[];
  modalLogoutCodes: string[];
  expiredTokenCodes: string[];
}

/** Reads the most specific backend error message supported by our APIs. */
export function getRequestErrorMessage(error: AxiosError<BackendErrorBody>) {
  const responseData = error.response?.data;
  const backendMessage = getFirstString(responseData?.msg, responseData?.message);

  return backendMessage || error.message;
}

/** Reads the backend business code when a response body exists. */
export function getBackendErrorCode(error: AxiosError<BackendErrorBody>) {
  const code = error.response?.data?.code;

  if (code) {
    return String(code);
  }

  return '';
}

/** Classifies backend business codes before the request layer performs side effects. */
export function getBackendErrorCodeAction(code: string, config: BackendErrorCodeActionConfig): BackendErrorCodeAction {
  if (config.logoutCodes.includes(code)) {
    return 'logout';
  }

  if (config.modalLogoutCodes.includes(code)) {
    return 'modalLogout';
  }

  if (config.expiredTokenCodes.includes(code)) {
    return 'expiredToken';
  }

  return 'none';
}

/** Checks whether the backend says the default AI model channel is missing. */
export function isMissingModelConfigError(message: string) {
  const normalized = message.trim().toLowerCase();

  return (
    message.includes('未找到模型配置') ||
    (normalized.includes('model config') && (normalized.includes('not found') || normalized.includes('missing')))
  );
}

function getFirstString(...values: unknown[]) {
  const matched = values.find(value => typeof value === 'string' && value.trim());

  return typeof matched === 'string' ? matched : '';
}
