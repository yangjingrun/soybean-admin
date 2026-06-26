export type SystemLogLevel = 'info' | 'warn' | 'error';
export type SystemLogStatus = 'processing' | 'success' | 'failed';
export type SystemLogErrorCategory = 'business' | 'external_service' | 'permission' | 'validation' | 'unexpected';

export interface SystemLogRecord {
  id: string;
  level: string;
  status: string;
  module: string;
  action: string;
  message: string;
  userId: string | null;
  userName: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  metadata: unknown;
  createdAt: Date;
}

export interface SystemLogRecordInput {
  level: SystemLogLevel;
  status: SystemLogStatus;
  module: string;
  action: string;
  message: string;
  userId?: string;
  userName?: string;
  errorCode?: string;
  errorMessage?: string;
  metadata?: unknown;
}

export interface SystemLogWhereInput {
  level?: string;
  status?: string;
  module?: string;
  action?: string;
  userId?: string;
  userName?: string;
  createdAt?: {
    gte?: Date;
    lte?: Date;
  };
  OR?: Array<{
    message?: { contains: string; mode: 'insensitive' };
    action?: { contains: string; mode: 'insensitive' };
    module?: { contains: string; mode: 'insensitive' };
    userName?: { contains: string; mode: 'insensitive' };
    errorMessage?: { contains: string; mode: 'insensitive' };
  }>;
}

export interface SystemLogListInput {
  current?: number | string;
  size?: number | string;
  level?: string;
  status?: string;
  module?: string;
  action?: string;
  userId?: string;
  userName?: string;
  startTime?: string;
  endTime?: string;
  keyword?: string;
}

export interface SystemLogView {
  id: string;
  level: string;
  status: string;
  module: string;
  action: string;
  message: string;
  userId: string | null;
  userName: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  metadata: unknown;
  createdAt: string;
}

export interface SystemLogUserOption {
  userId: string;
  userName: string;
}

export interface SystemLogStore {
  list(args: {
    where: SystemLogWhereInput;
    skip: number;
    take: number;
    orderBy: { createdAt: 'desc' };
  }): Promise<SystemLogRecord[]>;
  count(where: SystemLogWhereInput): Promise<number>;
  findById(id: string): Promise<SystemLogRecord | null>;
  create(input: SystemLogRecordInput): Promise<SystemLogRecord>;
  listUsers(): Promise<SystemLogUserOption[]>;
}

export interface SystemLogRecorder {
  record(input: SystemLogRecordInput): Promise<unknown>;
}
