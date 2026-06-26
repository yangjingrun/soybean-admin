import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { AiLeadDirectorySourceRuleMatchMode } from './ai-lead-source-url';
import type {
  AiLeadDirectorySourceRuleInput,
  AiLeadDirectorySourceRuleRecord,
  AiLeadDirectorySourceRuleStore,
  AiLeadDirectorySourceRuleUpdateInput
} from './ai-lead-directory-source-rule.types';

interface AiLeadDirectorySourceRuleRow {
  id: string;
  value: string;
  matchMode: string;
  enabled: boolean;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class PrismaAiLeadDirectorySourceRuleStore implements AiLeadDirectorySourceRuleStore {
  constructor(@Inject(PrismaService) private readonly prisma: Pick<PrismaService, '$queryRaw' | '$executeRaw'>) {}

  async listRules() {
    const rows = await this.prisma.$queryRaw<AiLeadDirectorySourceRuleRow[]>`
      SELECT id, value, "matchMode", enabled, description, "createdAt", "updatedAt"
      FROM "AiLeadDirectorySourceRule"
      ORDER BY "createdAt" ASC
    `;

    return rows.map(toRuleRecord);
  }

  async createRule(input: AiLeadDirectorySourceRuleInput) {
    const id = randomUUID();

    await this.prisma.$executeRaw`
      INSERT INTO "AiLeadDirectorySourceRule"
        (id, value, "matchMode", enabled, description, "createdById", "createdByName", "updatedById", "updatedByName")
      VALUES
        (${id}, ${input.value}, ${input.matchMode}, ${input.enabled}, ${input.description ?? null},
         ${input.user?.userId ?? null}, ${input.user?.userName ?? null}, ${input.user?.userId ?? null}, ${input.user?.userName ?? null})
    `;

    return (await this.findRuleById(id))!;
  }

  async updateRule(input: AiLeadDirectorySourceRuleUpdateInput) {
    await this.prisma.$executeRaw`
      UPDATE "AiLeadDirectorySourceRule"
      SET value = ${input.value},
          "matchMode" = ${input.matchMode},
          enabled = ${input.enabled},
          description = ${input.description ?? null},
          "updatedById" = ${input.user?.userId ?? null},
          "updatedByName" = ${input.user?.userName ?? null},
          "updatedAt" = now()
      WHERE id = ${input.id}
    `;

    return this.findRuleById(input.id);
  }

  async deleteRule(id: string) {
    const result = await this.prisma.$executeRaw`
      DELETE FROM "AiLeadDirectorySourceRule"
      WHERE id = ${id}
    `;

    return result > 0;
  }

  private async findRuleById(id: string) {
    const rows = await this.prisma.$queryRaw<AiLeadDirectorySourceRuleRow[]>`
      SELECT id, value, "matchMode", enabled, description, "createdAt", "updatedAt"
      FROM "AiLeadDirectorySourceRule"
      WHERE id = ${id}
      LIMIT 1
    `;

    return rows[0] ? toRuleRecord(rows[0]) : null;
  }
}

function toRuleRecord(row: AiLeadDirectorySourceRuleRow): AiLeadDirectorySourceRuleRecord {
  return {
    id: row.id,
    value: row.value,
    matchMode: row.matchMode as AiLeadDirectorySourceRuleMatchMode,
    enabled: row.enabled,
    builtin: false,
    description: row.description,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}
