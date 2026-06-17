import { Inject, Injectable } from '@nestjs/common';
import type { AiPromptConfigModel } from '../../generated/prisma/models/AiPromptConfig';
import { PrismaService } from '../database/prisma.service';
import type { AiPromptRecord, AiPromptStore } from './ai-gateway.types';

@Injectable()
export class PrismaAiPromptStore implements AiPromptStore {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** Reads one saved system prompt by stable business key. */
  async getPrompt(promptKey: string): Promise<AiPromptRecord | null> {
    const record = await this.prisma.aiPromptConfig.findUnique({
      where: { promptKey }
    });

    return record ? toPromptRecord(record) : null;
  }

  /** Persists one system prompt for later model calls. */
  async savePrompt(record: AiPromptRecord): Promise<AiPromptRecord> {
    const saved = await this.prisma.aiPromptConfig.upsert({
      where: { promptKey: record.promptKey },
      create: {
        promptKey: record.promptKey,
        title: record.title,
        systemPrompt: record.systemPrompt
      },
      update: {
        title: record.title,
        systemPrompt: record.systemPrompt
      }
    });

    return toPromptRecord(saved);
  }
}

function toPromptRecord(record: Pick<AiPromptConfigModel, 'promptKey' | 'title' | 'systemPrompt' | 'updatedAt'>) {
  return {
    promptKey: record.promptKey,
    title: record.title,
    systemPrompt: record.systemPrompt,
    updatedAt: record.updatedAt.toISOString()
  };
}
