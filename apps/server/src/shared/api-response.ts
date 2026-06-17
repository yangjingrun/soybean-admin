import type { ApiResponse } from '@soybean/shared';

export function ok<T>(data: T, msg = 'ok'): ApiResponse<T> {
  return {
    code: '0000',
    msg,
    data
  };
}

export function fail<T = null>(code: string, msg: string, data: T): ApiResponse<T> {
  return {
    code,
    msg,
    data
  };
}
