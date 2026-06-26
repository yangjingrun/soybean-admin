import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client';
import type { SystemNotificationModel } from '../../../generated/prisma/models/SystemNotification';
import { PrismaService } from '../../database/prisma.service';
import type {
  CreateSystemNotificationStoreInput,
  SystemNotificationListArgs,
  SystemNotificationRecord,
  SystemNotificationStatus,
  SystemNotificationStatusUpdateArgs,
  SystemNotificationStore
} from '../system-notification.types';

@Injectable()
export class PrismaSystemNotificationStore implements SystemNotificationStore {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(input: CreateSystemNotificationStoreInput) {
    const record = await this.prisma.systemNotification.create({
      data: {
        userId: input.userId,
        userName: input.userName,
        module: input.module,
        type: input.type,
        title: input.title,
        content: input.content,
        targetType: input.targetType,
        targetId: input.targetId,
        routePath: input.routePath,
        metadata: input.metadata as Prisma.SystemNotificationCreateInput['metadata']
      }
    });

    return toNotificationRecord(record);
  }

  async list(args: SystemNotificationListArgs) {
    const records = await this.prisma.systemNotification.findMany({
      where: toNotificationWhere(args.where),
      orderBy: args.orderBy
    });

    return records.map(toNotificationRecord);
  }

  async findByIdForUser(id: string, userId: string) {
    const record = await this.prisma.systemNotification.findFirst({
      where: {
        id,
        userId
      }
    });

    return record ? toNotificationRecord(record) : null;
  }

  async updateStatus(args: SystemNotificationStatusUpdateArgs) {
    const data: Prisma.SystemNotificationUpdateManyMutationInput = {
      status: args.status
    };

    if (args.shownAt !== undefined) data.shownAt = args.shownAt;
    if (args.readAt !== undefined) data.readAt = args.readAt;

    const records = await this.prisma.systemNotification.updateManyAndReturn({
      where: {
        id: args.id,
        userId: args.userId,
        ...(args.statusGuard
          ? { status: Array.isArray(args.statusGuard) ? { in: args.statusGuard } : args.statusGuard }
          : {})
      },
      data,
      limit: 1
    });

    return records[0] ? toNotificationRecord(records[0]) : null;
  }

  async markTargetReadForUser(args: Parameters<SystemNotificationStore['markTargetReadForUser']>[0]) {
    return this.prisma.systemNotification.updateMany({
      where: {
        userId: args.userId,
        targetType: args.targetType,
        targetId: args.targetId,
        status: { in: ['pending', 'shown'] }
      },
      data: {
        status: 'read',
        readAt: args.readAt
      }
    });
  }
}

function toNotificationWhere(where: SystemNotificationListArgs['where']): Prisma.SystemNotificationWhereInput {
  return {
    userId: where.userId,
    status: Array.isArray(where.status) ? { in: where.status } : where.status
  };
}

function toNotificationRecord(record: SystemNotificationModel): SystemNotificationRecord {
  return {
    id: record.id,
    userId: record.userId,
    userName: record.userName,
    module: record.module,
    type: record.type,
    title: record.title,
    content: record.content,
    targetType: record.targetType,
    targetId: record.targetId,
    routePath: record.routePath,
    status: record.status as SystemNotificationStatus,
    shownAt: record.shownAt,
    readAt: record.readAt,
    metadata: record.metadata,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}
