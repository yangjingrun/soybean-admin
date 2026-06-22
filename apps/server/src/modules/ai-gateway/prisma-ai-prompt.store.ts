import { Inject, Injectable } from '@nestjs/common';
import type { AiPromptConfigModel } from '../../generated/prisma/models/AiPromptConfig';
import type { AiPromptTestRunModel } from '../../generated/prisma/models/AiPromptTestRun';
import type { AiPromptVersionModel } from '../../generated/prisma/models/AiPromptVersion';
import { PrismaService } from '../database/prisma.service';
import type {
  AiPromptRecord,
  AiPromptStore,
  AiPromptTestRunRecord,
  AiPromptValidationResult,
  AiPromptVersionRecord,
  PublishAiPromptDraftInput,
  SaveAiPromptDraftInput,
  SaveAiPromptTestRunInput
} from './ai-gateway.types';

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

  /** Reads the editable draft version for one prompt key. */
  async getDraftPromptVersion(promptKey: string): Promise<AiPromptVersionRecord | null> {
    const record = await this.prisma.aiPromptVersion.findUnique({
      where: {
        promptKey_version: {
          promptKey,
          version: 0
        }
      }
    });

    return record ? toPromptVersionRecord(record) : null;
  }

  /** Saves one editable draft. Drafts always use version zero per prompt key. */
  async saveDraftPromptVersion(input: SaveAiPromptDraftInput): Promise<AiPromptVersionRecord> {
    const saved = await this.prisma.aiPromptVersion.upsert({
      where: {
        promptKey_version: {
          promptKey: input.promptKey,
          version: 0
        }
      },
      create: {
        promptKey: input.promptKey,
        title: input.title,
        version: 0,
        lifecycle: 'draft',
        systemPrompt: input.systemPrompt,
        validationResult: input.validationResult,
        changeNote: input.changeNote,
        createdById: input.userId,
        createdByName: input.userName
      },
      update: {
        title: input.title,
        lifecycle: 'draft',
        systemPrompt: input.systemPrompt,
        validationResult: input.validationResult,
        changeNote: input.changeNote,
        createdById: input.userId,
        createdByName: input.userName,
        publishedAt: null
      }
    });

    return toPromptVersionRecord(saved);
  }

  /** Publishes the current draft as a numbered version and refreshes the read model. */
  async publishDraftPromptVersion(input: PublishAiPromptDraftInput): Promise<AiPromptVersionRecord> {
    return this.prisma.$transaction(async tx => {
      const draft = await tx.aiPromptVersion.findUnique({
        where: {
          promptKey_version: {
            promptKey: input.promptKey,
            version: 0
          }
        }
      });

      if (!draft) {
        throw new Error('提示词草稿不存在');
      }

      const versionAggregate = await tx.aiPromptVersion.aggregate({
        where: {
          promptKey: input.promptKey,
          version: {
            gt: 0
          }
        },
        _max: {
          version: true
        }
      });
      const { _max: maxAggregate } = versionAggregate;
      const nextVersion = (maxAggregate.version ?? 0) + 1;
      const published = await tx.aiPromptVersion.create({
        data: {
          promptKey: draft.promptKey,
          title: draft.title,
          version: nextVersion,
          lifecycle: 'published',
          systemPrompt: draft.systemPrompt,
          validationResult: draft.validationResult,
          changeNote: input.changeNote ?? draft.changeNote,
          createdById: input.userId ?? draft.createdById,
          createdByName: input.userName ?? draft.createdByName,
          publishedAt: new Date()
        }
      });

      await tx.aiPromptConfig.upsert({
        where: {
          promptKey: draft.promptKey
        },
        create: {
          promptKey: draft.promptKey,
          title: draft.title,
          systemPrompt: draft.systemPrompt
        },
        update: {
          title: draft.title,
          systemPrompt: draft.systemPrompt
        }
      });

      await tx.aiPromptVersion.delete({
        where: {
          promptKey_version: {
            promptKey: input.promptKey,
            version: 0
          }
        }
      });

      return toPromptVersionRecord(published);
    });
  }

  /** Reads a historical prompt version by id. */
  async getPromptVersionById(id: string): Promise<AiPromptVersionRecord | null> {
    const record = await this.prisma.aiPromptVersion.findUnique({
      where: { id }
    });

    return record ? toPromptVersionRecord(record) : null;
  }

  /** Lists published prompt versions newest first. */
  async listPromptVersions(promptKey: string, limit: number): Promise<AiPromptVersionRecord[]> {
    const records = await this.prisma.aiPromptVersion.findMany({
      where: {
        promptKey,
        version: {
          gt: 0
        }
      },
      orderBy: {
        version: 'desc'
      },
      take: limit
    });

    return records.map(toPromptVersionRecord);
  }

  /** Records a prompt test run without storing model credentials or secrets. */
  async recordPromptTestRun(input: SaveAiPromptTestRunInput): Promise<AiPromptTestRunRecord> {
    const saved = await this.prisma.aiPromptTestRun.create({
      data: {
        promptKey: input.promptKey,
        inputPrompt: input.inputPrompt,
        outputText: input.outputText,
        validationResult: input.validationResult,
        success: input.success,
        durationMs: input.durationMs,
        errorMessage: input.errorMessage,
        createdById: input.userId,
        createdByName: input.userName
      }
    });

    return toPromptTestRunRecord(saved);
  }

  /** Reads the latest test run for a prompt key. */
  async getLatestPromptTestRun(promptKey: string): Promise<AiPromptTestRunRecord | null> {
    const record = await this.prisma.aiPromptTestRun.findFirst({
      where: { promptKey },
      orderBy: { createdAt: 'desc' }
    });

    return record ? toPromptTestRunRecord(record) : null;
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

function toPromptVersionRecord(record: AiPromptVersionModel): AiPromptVersionRecord {
  return {
    id: record.id,
    promptKey: record.promptKey,
    title: record.title,
    version: record.version,
    lifecycle: record.lifecycle === 'published' ? 'published' : 'draft',
    systemPrompt: record.systemPrompt,
    validationResult: toValidationResult(record.validationResult),
    changeNote: record.changeNote,
    createdById: record.createdById,
    createdByName: record.createdByName,
    publishedAt: record.publishedAt ? record.publishedAt.toISOString() : null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

function toPromptTestRunRecord(record: AiPromptTestRunModel): AiPromptTestRunRecord {
  return {
    id: record.id,
    promptKey: record.promptKey,
    inputPrompt: record.inputPrompt,
    outputText: record.outputText,
    validationResult: toValidationResult(record.validationResult),
    success: record.success,
    durationMs: record.durationMs,
    errorMessage: record.errorMessage,
    createdById: record.createdById,
    createdByName: record.createdByName,
    createdAt: record.createdAt.toISOString()
  };
}

function toValidationResult(value: unknown): AiPromptValidationResult | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as AiPromptValidationResult;
}
