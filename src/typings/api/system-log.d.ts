declare namespace Api {
  namespace SystemLog {
    type LogLevel = 'info' | 'warn' | 'error';

    type LogStatus = 'success' | 'failed';

    interface SystemLogRecord {
      id: string;
      level: LogLevel;
      status: LogStatus;
      module: string;
      action: string;
      message: string;
      userId: string | null;
      userName: string | null;
      errorCode: string | null;
      errorMessage: string | null;
      metadata: Record<string, unknown> | null;
      createdAt: string;
    }

    interface SystemLogUser {
      userId: string;
      userName: string;
    }

    interface SystemLogSearchParams extends Api.Common.CommonSearchParams {
      startTime?: string;
      endTime?: string;
      userId?: string;
      module?: string;
      level?: LogLevel;
      status?: LogStatus;
      keyword?: string;
    }

    interface SystemLogFilterModel {
      timeRange: [number, number] | null;
      userId: string | null;
      module: string | null;
      level: LogLevel | null;
      status: LogStatus | null;
      keyword: string;
    }
  }
}
