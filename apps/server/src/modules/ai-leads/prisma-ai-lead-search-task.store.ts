import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import type { AiLeadSearchTaskModel } from '../../generated/prisma/models/AiLeadSearchTask';
import type { AiLeadSearchTaskQueryModel } from '../../generated/prisma/models/AiLeadSearchTaskQuery';
import { PrismaService } from '../database/prisma.service';
import { resolveCurrentAiLeadSearchTask } from './ai-lead-search-task-state';
import type {
  AiLeadSearchTaskCreateInput,
  AiLeadSearchTaskEventInput,
  AiLeadSearchTaskQueryRecord,
  AiLeadSearchTaskQueryStartInput,
  AiLeadSearchTaskRecord,
  AiLeadSearchTaskStatus,
  AiLeadSearchTaskStore,
  AiLeadSearchTaskUpdateGuard,
  AiLeadSearchTaskUpdateInput
} from './ai-lead-search-task.types';

const currentTaskWhere = {
  OR: [{ status: { in: ['queued', 'running', 'interrupted', 'failed'] } }, { status: 'completed', readAt: null }]
} satisfies Prisma.AiLeadSearchTaskWhereInput;

@Injectable()
export class PrismaAiLeadSearchTaskStore implements AiLeadSearchTaskStore {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** Creates one queued AI leads search task owned by a user. */
  async createTask(input: AiLeadSearchTaskCreateInput) {
    const record = await this.prisma.aiLeadSearchTask.create({
      data: toTaskCreateData(input)
    });

    return toTaskRecord(record);
  }

  /** Creates a task inside the same transaction that verifies no restorable task exists. */
  async createTaskIfNoCurrent(input: AiLeadSearchTaskCreateInput) {
    const record = await this.runCurrentTaskCreateTransaction(input);

    return record ? toTaskRecord(record) : null;
  }

  private async runCurrentTaskCreateTransaction(input: AiLeadSearchTaskCreateInput) {
    try {
      return await this.prisma.$transaction(
        async tx => {
          const records = await tx.aiLeadSearchTask.findMany({
            where: {
              userId: input.userId,
              ...currentTaskWhere
            },
            orderBy: { updatedAt: 'desc' },
            take: 20
          });

          if (resolveCurrentAiLeadSearchTask(records.map(toTaskRecord))) {
            return null;
          }

          return tx.aiLeadSearchTask.create({
            data: toTaskCreateData(input)
          });
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable
        }
      );
    } catch (error) {
      // Concurrent task creation should surface as the same business conflict.
      if (isPrismaConcurrentCreateConflict(error)) {
        return null;
      }

      throw error;
    }
  }

  /** Reads the task that should be restored for the current user. */
  async findCurrentTaskForUser(userId: string) {
    const records = await this.prisma.aiLeadSearchTask.findMany({
      where: {
        userId,
        ...currentTaskWhere
      },
      orderBy: { updatedAt: 'desc' },
      take: 20
    });

    return resolveCurrentAiLeadSearchTask(records.map(toTaskRecord));
  }

  async findTaskById(id: string) {
    const record = await this.prisma.aiLeadSearchTask.findUnique({ where: { id } });

    return record ? toTaskRecord(record) : null;
  }

  async findTaskByIdForUser(id: string, userId: string) {
    const record = await this.prisma.aiLeadSearchTask.findFirst({
      where: { id, userId }
    });

    return record ? toTaskRecord(record) : null;
  }

  async updateTask(id: string, patch: AiLeadSearchTaskUpdateInput, guard: AiLeadSearchTaskUpdateGuard = {}) {
    const records = await this.prisma.aiLeadSearchTask.updateManyAndReturn({
      where: toTaskUpdateWhere(id, guard),
      data: toTaskUpdateData(patch),
      limit: 1
    });

    return records[0] ? toTaskRecord(records[0]) : null;
  }

  /** Marks running tasks as interrupted during worker startup recovery. */
  async interruptRunningTasksForRecovery(activeBullJobIds: string[] = []) {
    const records = await this.prisma.aiLeadSearchTask.updateManyAndReturn({
      where: {
        status: 'running',
        ...(activeBullJobIds.length
          ? {
              OR: [{ bullJobId: null }, { bullJobId: { notIn: activeBullJobIds } }]
            }
          : {})
      },
      data: {
        status: 'interrupted',
        errorMessage: '服务重启，采集任务已自动中断，可继续采集。'
      }
    });

    return records.map(toTaskRecord);
  }

  async createTaskEvent(input: AiLeadSearchTaskEventInput) {
    return this.prisma.aiLeadSearchTaskEvent.create({
      data: {
        taskId: input.taskId,
        eventType: input.eventType,
        fromStatus: input.fromStatus,
        toStatus: input.toStatus,
        title: input.title,
        message: input.message,
        metadata: input.metadata as Prisma.AiLeadSearchTaskEventCreateInput['metadata']
      }
    });
  }

  async findQueryByRequestKey(taskId: string, requestKey: string) {
    const record = await this.prisma.aiLeadSearchTaskQuery.findUnique({
      where: {
        taskId_requestKey: {
          taskId,
          requestKey
        }
      }
    });

    return record ? toQueryRecord(record) : null;
  }

  async upsertRunningQuery(input: AiLeadSearchTaskQueryStartInput) {
    const record = await this.prisma.aiLeadSearchTaskQuery.upsert({
      where: {
        taskId_requestKey: {
          taskId: input.taskId,
          requestKey: input.requestKey
        }
      },
      create: {
        taskId: input.taskId,
        requestKey: input.requestKey,
        endpoint: input.endpoint,
        requestBody: input.requestBody as Prisma.AiLeadSearchTaskQueryCreateInput['requestBody'],
        status: 'running',
        orderIndex: input.orderIndex
      },
      update: {
        endpoint: input.endpoint,
        requestBody: input.requestBody as Prisma.AiLeadSearchTaskQueryUpdateInput['requestBody'],
        status: 'running',
        errorMessage: null,
        orderIndex: input.orderIndex
      }
    });

    return toQueryRecord(record);
  }

  async completeQuery(id: string, result: unknown) {
    const record = await this.prisma.aiLeadSearchTaskQuery.update({
      where: { id },
      data: {
        status: 'completed',
        result: result as Prisma.AiLeadSearchTaskQueryUpdateInput['result'],
        errorMessage: null
      }
    });

    return toQueryRecord(record);
  }

  async failQuery(id: string, errorMessage: string) {
    const record = await this.prisma.aiLeadSearchTaskQuery.update({
      where: { id },
      data: {
        status: 'failed',
        errorMessage
      }
    });

    return toQueryRecord(record);
  }
}

function isPrismaConcurrentCreateConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2034' || error.code === 'P2002');
}

function toTaskCreateData(input: AiLeadSearchTaskCreateInput): Prisma.AiLeadSearchTaskCreateInput {
  return {
    userId: input.userId,
    userName: input.userName,
    requirement: input.requirement,
    targetLeadCount: input.targetLeadCount,
    keywordPlan: input.keywordPlan as Prisma.AiLeadSearchTaskCreateInput['keywordPlan'],
    status: 'queued',
    priority: input.priority
  };
}

function toTaskUpdateWhere(id: string, guard: AiLeadSearchTaskUpdateGuard): Prisma.AiLeadSearchTaskWhereInput {
  const where: Prisma.AiLeadSearchTaskWhereInput = { id };

  if (guard.userId) {
    where.userId = guard.userId;
  }

  if (guard.runVersion !== undefined) {
    where.runVersion = guard.runVersion;
  }

  if (guard.status) {
    where.status = Array.isArray(guard.status) ? { in: guard.status } : guard.status;
  }

  return where;
}

function toTaskUpdateData(input: AiLeadSearchTaskUpdateInput): Prisma.AiLeadSearchTaskUpdateManyMutationInput {
  return {
    status: input.status,
    priority: input.priority,
    runVersion: input.runVersion,
    progressState: input.progressState as Prisma.AiLeadSearchTaskUpdateManyMutationInput['progressState'],
    result: input.result as Prisma.AiLeadSearchTaskUpdateManyMutationInput['result'],
    errorMessage: input.errorMessage,
    bullJobId: input.bullJobId,
    readAt: input.readAt,
    notifiedAt: input.notifiedAt,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt
  };
}

function toTaskRecord(record: AiLeadSearchTaskModel): AiLeadSearchTaskRecord {
  return {
    id: record.id,
    userId: record.userId,
    userName: record.userName,
    requirement: record.requirement,
    targetLeadCount: record.targetLeadCount,
    keywordPlan: record.keywordPlan,
    status: record.status as AiLeadSearchTaskStatus,
    priority: record.priority,
    runVersion: record.runVersion,
    progressState: record.progressState,
    result: record.result,
    errorMessage: record.errorMessage,
    bullJobId: record.bullJobId,
    readAt: record.readAt,
    notifiedAt: record.notifiedAt,
    startedAt: record.startedAt,
    finishedAt: record.finishedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

function toQueryRecord(record: AiLeadSearchTaskQueryModel): AiLeadSearchTaskQueryRecord {
  return {
    id: record.id,
    taskId: record.taskId,
    requestKey: record.requestKey,
    endpoint: record.endpoint as AiLeadSearchTaskQueryRecord['endpoint'],
    requestBody: record.requestBody,
    status: record.status as AiLeadSearchTaskQueryRecord['status'],
    result: record.result,
    errorMessage: record.errorMessage,
    orderIndex: record.orderIndex,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}
