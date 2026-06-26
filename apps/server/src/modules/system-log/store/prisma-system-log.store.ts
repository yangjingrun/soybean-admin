import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type { SystemLogRecordInput, SystemLogStore, SystemLogWhereInput } from '../system-log.types';

@Injectable()
export class PrismaSystemLogStore implements SystemLogStore {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  list(args: { where: SystemLogWhereInput; skip: number; take: number; orderBy: { createdAt: 'desc' } }) {
    return this.prisma.systemLog.findMany(args);
  }

  count(where: SystemLogWhereInput) {
    return this.prisma.systemLog.count({ where });
  }

  findById(id: string) {
    return this.prisma.systemLog.findUnique({
      where: { id }
    });
  }

  create(input: SystemLogRecordInput) {
    return this.prisma.systemLog.create({
      data: {
        ...input,
        metadata: input.metadata as Prisma.SystemLogCreateInput['metadata']
      }
    });
  }

  async listUsers() {
    const users = await this.prisma.systemLog.findMany({
      where: {
        userId: {
          not: null
        }
      },
      distinct: ['userId'],
      orderBy: {
        createdAt: 'desc'
      },
      select: {
        userId: true,
        userName: true
      }
    });

    return users
      .filter(user => user.userId)
      .map(user => ({
        userId: user.userId!,
        userName: user.userName || user.userId!
      }));
  }
}
