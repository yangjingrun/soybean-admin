import { Inject, Injectable } from '@nestjs/common';
import type { AiLeadQueueConfigModel } from '../../generated/prisma/models/AiLeadQueueConfig';
import { PrismaService } from '../database/prisma.service';
import { aiLeadQueueConfigKey } from './ai-lead-search-task.constants';
import { defaultAiLeadQueueConcurrency, normalizeAiLeadQueueConcurrency } from './ai-lead-search-task-state';
import type {
  AiLeadQueueConfigInput,
  AiLeadQueueConfigRecord,
  AiLeadQueueConfigStore
} from './ai-lead-search-task.types';

@Injectable()
export class PrismaAiLeadQueueConfigStore implements AiLeadQueueConfigStore {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** Reads the AI leads queue config, returning the default when it has not been saved yet. */
  async getConfig() {
    const record = await this.prisma.aiLeadQueueConfig.findUnique({
      where: { configKey: aiLeadQueueConfigKey }
    });

    return record ? toQueueConfigRecord(record) : createDefaultQueueConfig();
  }

  /** Upserts the global AI leads task worker concurrency. */
  async saveConfig(input: AiLeadQueueConfigInput) {
    const workerConcurrency = normalizeAiLeadQueueConcurrency(input.workerConcurrency);
    const record = await this.prisma.aiLeadQueueConfig.upsert({
      where: { configKey: aiLeadQueueConfigKey },
      create: {
        configKey: aiLeadQueueConfigKey,
        workerConcurrency,
        priorityStrategy: 'fifo',
        updatedById: input.updatedById,
        updatedByName: input.updatedByName
      },
      update: {
        workerConcurrency,
        updatedById: input.updatedById,
        updatedByName: input.updatedByName
      }
    });

    return toQueueConfigRecord(record);
  }
}

function createDefaultQueueConfig(): AiLeadQueueConfigRecord {
  return {
    configKey: aiLeadQueueConfigKey,
    workerConcurrency: defaultAiLeadQueueConcurrency,
    priorityStrategy: 'fifo',
    updatedAt: new Date(0)
  };
}

function toQueueConfigRecord(record: AiLeadQueueConfigModel): AiLeadQueueConfigRecord {
  return {
    configKey: record.configKey,
    workerConcurrency: normalizeAiLeadQueueConcurrency(record.workerConcurrency),
    priorityStrategy: 'fifo',
    updatedAt: record.updatedAt
  };
}
