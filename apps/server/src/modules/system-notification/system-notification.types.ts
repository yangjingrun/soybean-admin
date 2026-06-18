export type SystemNotificationStatus = 'pending' | 'shown' | 'read';

export interface SystemNotificationRecord {
  id: string;
  userId: string;
  userName: string | null;
  module: string;
  type: string;
  title: string;
  content: string;
  targetType: string | null;
  targetId: string | null;
  routePath: string | null;
  status: SystemNotificationStatus;
  shownAt: Date | null;
  readAt: Date | null;
  metadata: unknown | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SystemNotificationView extends Omit<
  SystemNotificationRecord,
  'createdAt' | 'updatedAt' | 'shownAt' | 'readAt'
> {
  shownAt: string | null;
  readAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSystemNotificationStoreInput {
  userId: string;
  userName?: string | null;
  module: string;
  type: string;
  title: string;
  content: string;
  targetType?: string | null;
  targetId?: string | null;
  routePath?: string | null;
  metadata?: unknown | null;
}

export interface SystemNotificationListArgs {
  where: {
    userId: string;
    status: SystemNotificationStatus | SystemNotificationStatus[];
  };
  orderBy: {
    createdAt: 'desc';
  };
}

export interface SystemNotificationStatusUpdateArgs {
  id: string;
  userId: string;
  status: Exclude<SystemNotificationStatus, 'pending'>;
  statusGuard?: SystemNotificationStatus | SystemNotificationStatus[];
  shownAt?: Date | null;
  readAt?: Date | null;
}

export interface SystemNotificationTargetReadArgs {
  userId: string;
  targetType: string;
  targetId: string;
  readAt: Date;
}

export interface SystemNotificationStore {
  create(input: CreateSystemNotificationStoreInput): Promise<SystemNotificationRecord>;
  list(args: SystemNotificationListArgs): Promise<SystemNotificationRecord[]>;
  findByIdForUser(id: string, userId: string): Promise<SystemNotificationRecord | null>;
  updateStatus(args: SystemNotificationStatusUpdateArgs): Promise<SystemNotificationRecord | null>;
  markTargetReadForUser(args: SystemNotificationTargetReadArgs): Promise<{ count: number }>;
}
