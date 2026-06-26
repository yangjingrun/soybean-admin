import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import type { AiLeadKeywordHistoryModel } from '../../generated/prisma/models/AiLeadKeywordHistory';
import { PrismaService } from '../database/prisma.service';
import type {
  AiLeadKeywordHistoryRecord,
  AiLeadKeywordHistoryStore,
  SaveKeywordHistoryInput,
  UpdateKeywordHistoryInput
} from './ai-leads.types';

@Injectable()
export class PrismaAiLeadKeywordHistoryStore implements AiLeadKeywordHistoryStore {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** Creates one keyword optimization history owned by a user. */
  async create(input: SaveKeywordHistoryInput): Promise<AiLeadKeywordHistoryRecord> {
    const record = await this.prisma.aiLeadKeywordHistory.create({
      data: {
        userId: input.userId,
        userName: input.userName,
        requirement: input.requirement,
        resultText: input.resultText,
        keywordPlan: input.keywordPlan as Prisma.AiLeadKeywordHistoryCreateInput['keywordPlan'],
        finishReason: input.finishReason,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        totalTokens: input.totalTokens
      }
    });

    return toKeywordHistoryRecord(record);
  }

  /** Lists recent keyword histories under one user boundary. */
  async listByUser(userId: string, take = 20): Promise<AiLeadKeywordHistoryRecord[]> {
    const records = await this.prisma.aiLeadKeywordHistory.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take
    });

    return records.map(toKeywordHistoryRecord);
  }

  /** Updates one keyword history only when it belongs to the current user. */
  async updateByIdForUser(id: string, userId: string, input: UpdateKeywordHistoryInput) {
    const records = await this.prisma.aiLeadKeywordHistory.updateManyAndReturn({
      where: { id, userId },
      data: {
        requirement: input.requirement,
        resultText: input.resultText,
        keywordPlan: input.keywordPlan as Prisma.AiLeadKeywordHistoryUpdateInput['keywordPlan']
      },
      limit: 1
    });

    return records[0] ? toKeywordHistoryRecord(records[0]) : null;
  }

  /** Deletes one keyword history only when it belongs to the current user. */
  async deleteByIdForUser(id: string, userId: string) {
    const result = await this.prisma.aiLeadKeywordHistory.deleteMany({
      where: { id, userId }
    });

    return result.count > 0;
  }
}

function toKeywordHistoryRecord(record: AiLeadKeywordHistoryModel): AiLeadKeywordHistoryRecord {
  return {
    id: record.id,
    userId: record.userId,
    userName: record.userName,
    requirement: record.requirement,
    resultText: record.resultText,
    keywordPlan: record.keywordPlan,
    finishReason: record.finishReason,
    inputTokens: record.inputTokens,
    outputTokens: record.outputTokens,
    totalTokens: record.totalTokens,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}
