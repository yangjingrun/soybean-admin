import { Inject } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type {
  CrmFirstOutreachDraftBundleCreateInput,
  CrmFirstOutreachDraftBundleRecord,
  CrmFollowUpDraftBundleCreateInput,
  CrmFollowUpDraftBundleRecord,
  CrmMessageStatus,
  CrmSequenceDraftBundleCreateInput,
  CrmSequenceDraftBundleRecord,
  CrmSequenceEnrollmentCreateInput,
  CrmSequenceEnrollmentStatus,
  CrmSequenceEnrollmentUpdateInput,
  CrmSequenceReviewTodoType
} from '../crm.types';
import {
  toAccountRecord,
  toMessageRecord,
  toSequenceEnrollmentIdentityWhere,
  toSequenceEnrollmentListWhere,
  toSequenceEnrollmentRecord,
  toSequenceReviewInclude,
  toSequenceReviewRecord,
  toStatusWhere,
  toTimelineEventRecord,
  toUniqueStrings
} from './prisma-crm-store.helpers';

export class PrismaCrmSequenceReviewStore {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  findActiveEnrollmentByContact(args: {
    organizationId: string;
    ownerUserId: string;
    contactId: string;
    statuses: CrmSequenceEnrollmentStatus[];
  }) {
    return this.prisma.crmSequenceEnrollment
      .findFirst({
        where: {
          organizationId: args.organizationId,
          ownerUserId: args.ownerUserId,
          contactId: args.contactId,
          status: { in: args.statuses }
        },
        orderBy: { updatedAt: 'desc' }
      })
      .then(record => (record ? toSequenceEnrollmentRecord(record) : null));
  }

  findActiveEnrollmentByAccount(args: {
    organizationId: string;
    ownerUserId: string;
    accountId: string;
    statuses: CrmSequenceEnrollmentStatus[];
  }) {
    return this.prisma.crmSequenceEnrollment
      .findFirst({
        where: {
          organizationId: args.organizationId,
          ownerUserId: args.ownerUserId,
          accountId: args.accountId,
          status: { in: args.statuses }
        },
        orderBy: { updatedAt: 'desc' }
      })
      .then(record => (record ? toSequenceEnrollmentRecord(record) : null));
  }

  async createSequenceEnrollment(input: CrmSequenceEnrollmentCreateInput) {
    const record = await this.prisma.crmSequenceEnrollment.create({
      data: input as Prisma.CrmSequenceEnrollmentUncheckedCreateInput
    });

    return toSequenceEnrollmentRecord(record);
  }

  async createSequenceDraftBundle(input: CrmSequenceDraftBundleCreateInput): Promise<CrmSequenceDraftBundleRecord> {
    return this.prisma.$transaction(async tx => {
      const enrollment = await tx.crmSequenceEnrollment.create({
        data: input.enrollment as Prisma.CrmSequenceEnrollmentUncheckedCreateInput
      });
      const message = await tx.crmMessage.create({
        data: {
          ...input.message,
          enrollmentId: enrollment.id
        } as Prisma.CrmMessageUncheckedCreateInput
      });
      const account = await tx.crmAccount.update({
        where: { id: input.enrollment.accountId },
        data: { status: input.accountStatus }
      });
      const event = await tx.crmTimelineEvent.create({
        data: {
          organizationId: input.timelineEvent.organizationId,
          accountId: input.timelineEvent.accountId,
          contactId: input.timelineEvent.contactId,
          ownerUserId: input.timelineEvent.ownerUserId,
          eventType: input.timelineEvent.eventType,
          title: input.timelineEvent.title,
          content: input.timelineEvent.content,
          metadata: {
            ...input.timelineEvent.metadata,
            enrollmentId: enrollment.id,
            messageId: message.id
          } as Prisma.InputJsonValue
        }
      });

      return {
        enrollment: toSequenceEnrollmentRecord(enrollment),
        message: toMessageRecord(message),
        account: toAccountRecord(account),
        event: toTimelineEventRecord(event)
      };
    });
  }

  async createFirstOutreachDraftBundle(
    input: CrmFirstOutreachDraftBundleCreateInput
  ): Promise<CrmFirstOutreachDraftBundleRecord | null> {
    return this.prisma.$transaction(async tx => {
      const task = await tx.crmAiDraftTask.findFirst({
        where: {
          id: input.taskGuard.taskId,
          organizationId: input.organizationId,
          ownerUserId: input.ownerUserId,
          runVersion: input.taskGuard.runVersion,
          status: toStatusWhere(input.taskGuard.status)
        }
      });

      if (!task) {
        return null;
      }

      const enrollment = await tx.crmSequenceEnrollment.findFirst({
        where: {
          id: input.enrollmentId,
          organizationId: input.organizationId,
          ownerUserId: input.ownerUserId,
          status: input.expectedEnrollmentStatus
        }
      });

      if (!enrollment) {
        return null;
      }

      const existingMessage = await tx.crmMessage.findFirst({
        where: {
          enrollmentId: enrollment.id,
          organizationId: input.organizationId,
          ownerUserId: input.ownerUserId,
          stepIndex: input.message.stepIndex
        }
      });

      if (existingMessage) {
        return null;
      }

      const message = await tx.crmMessage.create({
        data: {
          ...input.message,
          enrollmentId: enrollment.id
        } as Prisma.CrmMessageUncheckedCreateInput
      });
      const updatedEnrollment = await tx.crmSequenceEnrollment.update({
        where: { id: enrollment.id },
        data: {
          status: input.nextEnrollmentStatus,
          currentStep: input.message.stepIndex
        }
      });
      const account = await tx.crmAccount.update({
        where: { id: enrollment.accountId },
        data: { status: input.accountStatus }
      });
      const metadata = input.timelineEvent.metadata as Record<string, unknown>;
      const event = await tx.crmTimelineEvent.create({
        data: {
          ...input.timelineEvent,
          metadata: {
            ...metadata,
            enrollmentId: enrollment.id,
            messageId: message.id
          }
        } as Prisma.CrmTimelineEventUncheckedCreateInput
      });

      return {
        enrollment: toSequenceEnrollmentRecord(updatedEnrollment),
        message: toMessageRecord(message),
        account: toAccountRecord(account),
        event: toTimelineEventRecord(event)
      };
    });
  }

  async createFollowUpDraftBundle(
    input: CrmFollowUpDraftBundleCreateInput
  ): Promise<CrmFollowUpDraftBundleRecord | null> {
    return this.prisma.$transaction(async tx => {
      if (input.taskGuard) {
        const task = await tx.crmAiDraftTask.findFirst({
          where: {
            id: input.taskGuard.taskId,
            organizationId: input.organizationId,
            ownerUserId: input.ownerUserId,
            runVersion: input.taskGuard.runVersion,
            status: toStatusWhere(input.taskGuard.status)
          }
        });

        if (!task) {
          return null;
        }
      }

      const enrollment = await tx.crmSequenceEnrollment.findFirst({
        where: {
          id: input.enrollmentId,
          organizationId: input.organizationId,
          ownerUserId: input.ownerUserId,
          ...(input.expectedEnrollmentStatus ? { status: toStatusWhere(input.expectedEnrollmentStatus) } : {})
        }
      });

      if (!enrollment) {
        return null;
      }

      const existingMessage = await tx.crmMessage.findFirst({
        where: {
          enrollmentId: enrollment.id,
          organizationId: input.organizationId,
          ownerUserId: input.ownerUserId,
          OR: [
            { stepIndex: input.message.stepIndex },
            ...(input.blockingMessageStatuses?.length ? [{ status: { in: input.blockingMessageStatuses } }] : [])
          ]
        }
      });

      if (existingMessage) {
        return null;
      }

      const message = await tx.crmMessage.create({
        data: {
          ...input.message,
          enrollmentId: enrollment.id
        } as Prisma.CrmMessageUncheckedCreateInput
      });
      const metadata = input.timelineEvent.metadata as Record<string, unknown>;
      const event = await tx.crmTimelineEvent.create({
        data: {
          ...input.timelineEvent,
          metadata: {
            ...metadata,
            messageId: message.id
          }
        } as Prisma.CrmTimelineEventUncheckedCreateInput
      });

      return {
        enrollment: toSequenceEnrollmentRecord(enrollment),
        message: toMessageRecord(message),
        event: toTimelineEventRecord(event)
      };
    });
  }

  async listSequenceReviewItems(args: {
    organizationId: string;
    ownerUserId?: string;
    keyword?: string;
    currentStep?: number;
    status?: CrmSequenceEnrollmentStatus;
    todoType?: CrmSequenceReviewTodoType;
    messageStatus?: CrmMessageStatus;
    dateScope?: 'today';
    createdAtScope?: 'today' | 'yesterday' | 'last_3_days' | 'last_7_days' | 'last_30_days';
    now?: Date;
    skip: number;
    take: number;
  }) {
    const where = toSequenceEnrollmentListWhere(args);
    const [records, total] = await Promise.all([
      this.prisma.crmSequenceEnrollment.findMany({
        where,
        skip: args.skip,
        take: args.take,
        orderBy: { updatedAt: 'desc' },
        include: toSequenceReviewInclude()
      }),
      this.prisma.crmSequenceEnrollment.count({ where })
    ]);

    return {
      records: records.map(toSequenceReviewRecord),
      total
    };
  }

  async getSequenceReviewItem(args: { id: string; organizationId: string; ownerUserId?: string }) {
    const record = await this.prisma.crmSequenceEnrollment.findFirst({
      where: toSequenceEnrollmentIdentityWhere(args),
      include: toSequenceReviewInclude()
    });

    return record ? toSequenceReviewRecord(record) : null;
  }

  async listSequenceReviewItemsByIds(args: { ids: string[]; organizationId: string; ownerUserId?: string }) {
    const ids = toUniqueStrings(args.ids);

    if (ids.length === 0) {
      return [];
    }

    const records = await this.prisma.crmSequenceEnrollment.findMany({
      where: {
        id: { in: ids },
        organizationId: args.organizationId,
        ...(args.ownerUserId ? { ownerUserId: args.ownerUserId } : {})
      },
      include: toSequenceReviewInclude()
    });

    return records.map(toSequenceReviewRecord);
  }

  async updateSequenceEnrollment(id: string, organizationId: string, input: CrmSequenceEnrollmentUpdateInput) {
    const records = await this.prisma.crmSequenceEnrollment.updateManyAndReturn({
      where: {
        id,
        organizationId
      },
      data: input,
      limit: 1
    });

    return records[0] ? toSequenceEnrollmentRecord(records[0]) : null;
  }
}
