import dayjs from 'dayjs';

export const logLevelOptions = [
  { label: '信息', value: 'info' },
  { label: '警告', value: 'warn' },
  { label: '错误', value: 'error' }
] satisfies Array<{ label: string; value: Api.SystemLog.LogLevel }>;

export const logStatusOptions = [
  { label: '成功', value: 'success' },
  { label: '失败', value: 'failed' }
] satisfies Array<{ label: string; value: Api.SystemLog.LogStatus }>;

export const logModuleOptions = [
  { label: '认证', value: 'auth' },
  { label: 'AI 网关', value: 'ai-gateway' },
  { label: '系统日志', value: 'system-log' }
];

export const logLevelLabelMap: Record<Api.SystemLog.LogLevel, string> = {
  info: '信息',
  warn: '警告',
  error: '错误'
};

export const logLevelTagTypeMap: Record<Api.SystemLog.LogLevel, NaiveUI.ThemeColor> = {
  info: 'info',
  warn: 'warning',
  error: 'error'
};

export const logStatusLabelMap: Record<Api.SystemLog.LogStatus, string> = {
  success: '成功',
  failed: '失败'
};

export const logStatusTagTypeMap: Record<Api.SystemLog.LogStatus, NaiveUI.ThemeColor> = {
  success: 'success',
  failed: 'error'
};

/** Format backend ISO datetime for table and drawer display. */
export function formatLogDate(value: string) {
  return dayjs(value).format('YYYY-MM-DD HH:mm:ss');
}

/** Format metadata exactly from backend payload as pretty JSON. */
export function formatMetadata(metadata: Record<string, unknown> | null) {
  return metadata ? JSON.stringify(metadata, null, 2) : '';
}
