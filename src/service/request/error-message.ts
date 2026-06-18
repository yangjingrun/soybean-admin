import { BACKEND_ERROR_CODE, type AxiosError } from '@sa/axios';

type BackendErrorBody = {
  msg?: unknown;
  message?: unknown;
  code?: unknown;
};

/** Reads the most specific backend error message supported by our APIs. */
export function getRequestErrorMessage(error: AxiosError<BackendErrorBody>) {
  const responseData = error.response?.data;
  const backendMessage = getFirstString(responseData?.msg, responseData?.message);

  return backendMessage || error.message;
}

/** Reads the backend business code when a response body exists. */
export function getBackendErrorCode(error: AxiosError<BackendErrorBody>) {
  if (error.code !== BACKEND_ERROR_CODE) {
    return '';
  }

  return String(error.response?.data?.code || '');
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
