import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { SYSTEM_NOTIFICATION_STORE } from './system-notification.tokens';
import type {
  CreateSystemNotificationStoreInput,
  SystemNotificationRecord,
  SystemNotificationStatus,
  SystemNotificationStore,
  SystemNotificationView
} from './system-notification.types';

const reminderNotificationStatuses: SystemNotificationStatus[] = ['pending', 'shown'];

@Injectable()
export class SystemNotificationService {
  constructor(@Inject(SYSTEM_NOTIFICATION_STORE) private readonly store: SystemNotificationStore) {}

  /** Creates one user-scoped system notification. */
  async create(input: CreateSystemNotificationStoreInput) {
    return this.toView(await this.store.create(input));
  }

  /** Lists notifications that should keep reminding the current user before being read. */
  async listPendingForUser(userId: string) {
    const records = await this.store.list({
      where: {
        userId,
        status: reminderNotificationStatuses
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return records.map(record => this.toView(record));
  }

  /** Marks one notification as already shown by the online global listener. */
  async markShown(id: string, userId: string) {
    const currentRecord = await this.store.findByIdForUser(id, userId);

    if (!currentRecord) {
      throw new NotFoundException('通知不存在');
    }

    if (currentRecord.status === 'read') {
      return this.toView(currentRecord);
    }

    return this.toViewOrThrow(
      (await this.store.updateStatus({
        id,
        userId,
        status: 'shown',
        statusGuard: 'pending',
        shownAt: new Date()
      })) ?? (await this.store.findByIdForUser(id, userId))
    );
  }

  /** Marks one notification as read after the user follows or dismisses it. */
  async markRead(id: string, userId: string) {
    return this.toViewOrThrow(
      await this.store.updateStatus({
        id,
        userId,
        status: 'read',
        readAt: new Date()
      })
    );
  }

  /** Marks all unread notifications for one business target as read. */
  async markTargetReadForUser(targetType: string, targetId: string, userId: string) {
    return this.store.markTargetReadForUser({
      userId,
      targetType,
      targetId,
      readAt: new Date()
    });
  }

  private toViewOrThrow(record: SystemNotificationRecord | null) {
    if (!record) {
      throw new NotFoundException('通知不存在');
    }

    return this.toView(record);
  }

  private toView(record: SystemNotificationRecord): SystemNotificationView {
    return {
      ...record,
      shownAt: record.shownAt?.toISOString() ?? null,
      readAt: record.readAt?.toISOString() ?? null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString()
    };
  }
}
