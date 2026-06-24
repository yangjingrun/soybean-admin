import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  countAiDraftTaskItems,
  createDefaultAiDraftQueueConfig,
  isPrismaConcurrentTaskCreateConflict,
  toAiDraftQueueConfigRecord,
  toAiDraftTaskItemRecord,
  toAiDraftTaskItemUpdateData,
  toAiDraftTaskRecord,
  toAiDraftTaskUpdateData,
  toNullableJsonInput,
  toStatusWhere
} from './prisma-crm-store.helpers';
import {
  crmAiDraftActiveTaskStatuses,
  normalizeCrmAiDraftItemConcurrency,
  normalizeCrmAiDraftMaxAttempts
} from '../crm-ai-draft-task-state';
import type {
  CrmAiDraftTaskCreateInput,
  CrmAiDraftTaskItemUpdateGuard,
  CrmAiDraftTaskItemUpdateInput,
  CrmFirstOutreachAiDraftTaskCreateInput,
  CrmAiDraftTaskUpdateGuard,
  CrmAiDraftTaskUpdateInput
} from '../crm.types';
import type { CrmAiDraftTaskRepository } from '../ai-draft-task/crm-ai-draft-task.repository';

const crmAiDraftQueueConfigKey = 'crm-ai-draft';

@Injectable()
export class PrismaCrmAiDraftTaskStore implements CrmAiDraftTaskRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async createAiDraftTask(input: CrmAiDraftTaskCreateInput) {
    try {
      return await this.prisma.$transaction(async tx => this.createAiDraftTaskInsideTransaction(tx, input), {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable
      });
    } catch (error) {
      // Serializable conflicts mean another creator won the same capacity window.
      if (isPrismaConcurrentTaskCreateConflict(error)) {
        return {
          task: null,
          limitReason: 'concurrent_create_conflict' as const
        };
      }

      throw error;
    }
  }

  async createFirstOutreachAiDraftTask(input: CrmFirstOutreachAiDraftTaskCreateInput) {
    try {
      return await this.prisma.$transaction(
        async tx => {
          const configRecord = await tx.crmAiDraftQueueConfig.findUnique({
            where: { configKey: crmAiDraftQueueConfigKey }
          });
          const config = configRecord ? toAiDraftQueueConfigRecord(configRecord) : createDefaultAiDraftQueueConfig();
          const [activeUserTaskCount, activeOrgTaskCount] = await Promise.all([
            tx.crmAiDraftTask.count({
              where: {
                organizationId: input.organizationId,
                ownerUserId: input.ownerUserId,
                status: { in: crmAiDraftActiveTaskStatuses }
              }
            }),
            tx.crmAiDraftTask.count({
              where: {
                organizationId: input.organizationId,
                status: { in: crmAiDraftActiveTaskStatuses }
              }
            })
          ]);

          if (activeUserTaskCount >= config.maxActiveTasksPerUser) {
            return { task: null, limitReason: 'user_active_limit' as const };
          }

          if (activeOrgTaskCount >= config.maxActiveTasksPerOrg) {
            return { task: null, limitReason: 'organization_active_limit' as const };
          }

          const enrollmentIds: string[] = [];

          for (const item of input.enrollments) {
            const enrollment = await tx.crmSequenceEnrollment.create({
              data: item.enrollment as Prisma.CrmSequenceEnrollmentUncheckedCreateInput
            });
            enrollmentIds.push(enrollment.id);
          }

          await tx.crmAccount.updateMany({
            where: {
              id: { in: input.enrollments.map(item => item.enrollment.accountId) },
              organizationId: input.organizationId,
              ownerUserId: input.ownerUserId
            },
            data: { status: input.accountStatus }
          });

          const effectiveConcurrency = normalizeCrmAiDraftItemConcurrency(
            config.itemConcurrency,
            config.maxItemConcurrency
          );
          const maxAttempts = normalizeCrmAiDraftMaxAttempts(config.maxAttempts);
          const task = await tx.crmAiDraftTask.create({
            data: {
              organizationId: input.organizationId,
              organizationRole: input.organizationRole ?? null,
              ownerUserId: input.ownerUserId,
              ownerUserName: input.ownerUserName ?? null,
              status: 'queued',
              requestedCount: input.requestedCount,
              pendingCount: input.enrollments.length,
              effectiveConcurrency,
              maxAttempts
            } as Prisma.CrmAiDraftTaskUncheckedCreateInput
          });

          await tx.crmAiDraftTaskItem.createMany({
            data: input.enrollments.map((item, index) => ({
              taskId: task.id,
              organizationId: input.organizationId,
              ownerUserId: input.ownerUserId,
              enrollmentId: enrollmentIds[index],
              messageId: null,
              contactId: item.item.contactId ?? null,
              accountId: item.item.accountId ?? null,
              productLineId: item.item.productLineId ?? null,
              stepIndex: 1,
              status: 'pending',
              maxAttempts,
              metadata: toNullableJsonInput({ kind: 'first_outreach' })
            })) as Prisma.CrmAiDraftTaskItemCreateManyInput[]
          });

          return {
            task: toAiDraftTaskRecord(task),
            enrollmentIds
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable
        }
      );
    } catch (error) {
      if (isPrismaConcurrentTaskCreateConflict(error)) {
        return {
          task: null,
          limitReason: 'concurrent_create_conflict' as const
        };
      }

      throw error;
    }
  }

  /** Checks queue capacity and creates the task in one serializable transaction. */
  private async createAiDraftTaskInsideTransaction(tx: Prisma.TransactionClient, input: CrmAiDraftTaskCreateInput) {
    const configRecord = await tx.crmAiDraftQueueConfig.findUnique({
      where: { configKey: crmAiDraftQueueConfigKey }
    });
    const config = configRecord ? toAiDraftQueueConfigRecord(configRecord) : createDefaultAiDraftQueueConfig();
    const [activeUserTaskCount, activeOrgTaskCount] = await Promise.all([
      tx.crmAiDraftTask.count({
        where: {
          organizationId: input.organizationId,
          ownerUserId: input.ownerUserId,
          status: { in: crmAiDraftActiveTaskStatuses }
        }
      }),
      tx.crmAiDraftTask.count({
        where: {
          organizationId: input.organizationId,
          status: { in: crmAiDraftActiveTaskStatuses }
        }
      })
    ]);

    if (activeUserTaskCount >= config.maxActiveTasksPerUser) {
      return { task: null, limitReason: 'user_active_limit' as const };
    }

    if (activeOrgTaskCount >= config.maxActiveTasksPerOrg) {
      return { task: null, limitReason: 'organization_active_limit' as const };
    }

    const counts = countAiDraftTaskItems(input.items);
    const status = input.status ?? (counts.pendingCount > 0 ? 'queued' : 'completed');
    const now = new Date();
    const effectiveConcurrency = normalizeCrmAiDraftItemConcurrency(config.itemConcurrency, config.maxItemConcurrency);
    const maxAttempts = normalizeCrmAiDraftMaxAttempts(config.maxAttempts);
    const task = await tx.crmAiDraftTask.create({
      data: {
        organizationId: input.organizationId,
        organizationRole: input.organizationRole ?? null,
        ownerUserId: input.ownerUserId,
        ownerUserName: input.ownerUserName ?? null,
        status,
        requestedCount: input.requestedCount,
        successCount: counts.successCount,
        skippedCount: counts.skippedCount,
        failedCount: counts.failedCount,
        retryingCount: counts.retryingCount,
        runningCount: counts.runningCount,
        pendingCount: counts.pendingCount,
        effectiveConcurrency,
        maxAttempts,
        finishedAt: counts.pendingCount > 0 ? null : now
      } as Prisma.CrmAiDraftTaskUncheckedCreateInput
    });

    if (input.items.length > 0) {
      await tx.crmAiDraftTaskItem.createMany({
        data: input.items.map(item => ({
          taskId: task.id,
          organizationId: input.organizationId,
          ownerUserId: input.ownerUserId,
          enrollmentId: item.enrollmentId,
          messageId: item.messageId ?? null,
          contactId: item.contactId ?? null,
          accountId: item.accountId ?? null,
          productLineId: item.productLineId ?? null,
          stepIndex: item.stepIndex,
          status: item.status ?? 'pending',
          maxAttempts,
          failureType: item.failureType ?? null,
          failureReason: item.failureReason ?? null,
          metadata: item.metadata === undefined ? undefined : toNullableJsonInput(item.metadata)
        })) as Prisma.CrmAiDraftTaskItemCreateManyInput[]
      });
    }

    return { task: toAiDraftTaskRecord(task) };
  }

  countActiveAiDraftTasksForUser(input: { organizationId: string; ownerUserId: string }) {
    return this.prisma.crmAiDraftTask.count({
      where: {
        organizationId: input.organizationId,
        ownerUserId: input.ownerUserId,
        status: { in: ['queued', 'running'] }
      }
    });
  }

  countActiveAiDraftTasksForOrg(input: { organizationId: string }) {
    return this.prisma.crmAiDraftTask.count({
      where: {
        organizationId: input.organizationId,
        status: { in: ['queued', 'running'] }
      }
    });
  }

  async findCurrentAiDraftTaskForUser(input: { organizationId: string; ownerUserId: string }) {
    const record = await this.prisma.crmAiDraftTask.findFirst({
      where: {
        organizationId: input.organizationId,
        ownerUserId: input.ownerUserId,
        OR: [{ status: { in: ['queued', 'running'] } }, { status: { in: ['completed', 'failed'] }, readAt: null }]
      },
      orderBy: { updatedAt: 'desc' }
    });

    return record ? toAiDraftTaskRecord(record) : null;
  }

  async findAiDraftTaskById(input: { id: string; organizationId: string; ownerUserId?: string }) {
    const record = await this.prisma.crmAiDraftTask.findFirst({
      where: {
        id: input.id,
        organizationId: input.organizationId,
        ...(input.ownerUserId ? { ownerUserId: input.ownerUserId } : {})
      }
    });

    return record ? toAiDraftTaskRecord(record) : null;
  }

  async listAiDraftTasks(input: { organizationId: string; ownerUserId?: string; skip: number; take: number }) {
    const where = {
      organizationId: input.organizationId,
      ...(input.ownerUserId ? { ownerUserId: input.ownerUserId } : {})
    };
    const [records, total] = await Promise.all([
      this.prisma.crmAiDraftTask.findMany({
        where,
        skip: input.skip,
        take: input.take,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }]
      }),
      this.prisma.crmAiDraftTask.count({ where })
    ]);

    return {
      records: records.map(toAiDraftTaskRecord),
      total
    };
  }

  async listAiDraftTaskItems(input: { taskId: string }) {
    const records = await this.prisma.crmAiDraftTaskItem.findMany({
      where: { taskId: input.taskId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]
    });

    return records.map(toAiDraftTaskItemRecord);
  }

  async updateAiDraftTask(id: string, patch: CrmAiDraftTaskUpdateInput, guard: CrmAiDraftTaskUpdateGuard = {}) {
    const records = await this.prisma.crmAiDraftTask.updateManyAndReturn({
      where: {
        id,
        ...(guard.organizationId ? { organizationId: guard.organizationId } : {}),
        ...(guard.ownerUserId ? { ownerUserId: guard.ownerUserId } : {}),
        ...(guard.runVersion ? { runVersion: guard.runVersion } : {}),
        ...(guard.status ? { status: toStatusWhere(guard.status) } : {})
      },
      data: toAiDraftTaskUpdateData(patch),
      limit: 1
    });

    return records[0] ? toAiDraftTaskRecord(records[0]) : null;
  }

  async updateAiDraftTaskItem(
    id: string,
    patch: CrmAiDraftTaskItemUpdateInput,
    guard: CrmAiDraftTaskItemUpdateGuard = {}
  ) {
    const records = await this.prisma.crmAiDraftTaskItem.updateManyAndReturn({
      where: {
        id,
        ...(guard.taskId ? { taskId: guard.taskId } : {}),
        ...(guard.organizationId ? { organizationId: guard.organizationId } : {}),
        ...(guard.ownerUserId ? { ownerUserId: guard.ownerUserId } : {}),
        ...(guard.status ? { status: toStatusWhere(guard.status) } : {})
      },
      data: toAiDraftTaskItemUpdateData(patch),
      limit: 1
    });

    return records[0] ? toAiDraftTaskItemRecord(records[0]) : null;
  }
}
