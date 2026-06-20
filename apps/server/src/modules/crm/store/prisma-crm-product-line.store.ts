import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  toProductLineAiPromptVersionJson,
  toProductLineAiPromptVersionRecord,
  toProductLineAiWritingConfig,
  toProductLineIdentityWhere,
  toProductLineListWhere,
  toProductLineRecord
} from './prisma-crm-store.helpers';
import type {
  CrmProductLineAiPromptVersionCreateInput,
  CrmProductLineAiPromptVersionRestoreInput,
  CrmProductLineCreateInput,
  CrmProductLineStatus,
  CrmProductLineUpdateInput
} from '../crm.types';

export class PrismaCrmProductLineStore {
  constructor(private readonly prisma: PrismaService) {}

  async listProductLines(args: {
    organizationId: string;
    keyword?: string;
    status?: CrmProductLineStatus;
    skip: number;
    take: number;
  }) {
    const where = toProductLineListWhere(args);
    const [records, total] = await Promise.all([
      this.prisma.crmProductLine.findMany({
        where,
        skip: args.skip,
        take: args.take,
        orderBy: { updatedAt: 'desc' }
      }),
      this.prisma.crmProductLine.count({ where })
    ]);

    return {
      records: records.map(toProductLineRecord),
      total
    };
  }

  findProductLineByName(organizationId: string, name: string) {
    return this.prisma.crmProductLine
      .findUnique({
        where: {
          organizationId_name: {
            organizationId,
            name
          }
        }
      })
      .then(record => (record ? toProductLineRecord(record) : null));
  }

  findProductLineById(args: { id: string; organizationId: string }) {
    return this.prisma.crmProductLine
      .findFirst({
        where: toProductLineIdentityWhere(args)
      })
      .then(record => (record ? toProductLineRecord(record) : null));
  }

  async createProductLine(input: CrmProductLineCreateInput) {
    const record = await this.prisma.crmProductLine.create({
      data: input as Prisma.CrmProductLineUncheckedCreateInput
    });

    return toProductLineRecord(record);
  }

  async updateProductLine(id: string, organizationId: string, input: CrmProductLineUpdateInput) {
    const data = (
      input.aiWritingConfig === null ? { ...input, aiWritingConfig: Prisma.JsonNull } : input
    ) as Prisma.CrmProductLineUpdateManyMutationInput;
    const records = await this.prisma.crmProductLine.updateManyAndReturn({
      where: {
        id,
        organizationId
      },
      data,
      limit: 1
    });

    return records[0] ? toProductLineRecord(records[0]) : null;
  }

  async createProductLineAiPromptVersion(input: CrmProductLineAiPromptVersionCreateInput) {
    return this.prisma.$transaction(async tx => {
      const latestVersion = await tx.crmProductLineAiPromptVersion.findFirst({
        where: {
          organizationId: input.organizationId,
          productLineId: input.productLineId
        },
        orderBy: { version: 'desc' }
      });
      const record = await tx.crmProductLineAiPromptVersion.create({
        data: {
          organizationId: input.organizationId,
          productLineId: input.productLineId,
          version: (latestVersion?.version ?? 0) + 1,
          aiWritingConfig: toProductLineAiPromptVersionJson(input.aiWritingConfig),
          editorId: input.editorId,
          editorName: input.editorName ?? null,
          changeSummary: input.changeSummary ?? null
        }
      });

      return toProductLineAiPromptVersionRecord(record);
    });
  }

  async listProductLineAiPromptVersions(args: { organizationId: string; productLineId: string }) {
    const records = await this.prisma.crmProductLineAiPromptVersion.findMany({
      where: {
        organizationId: args.organizationId,
        productLineId: args.productLineId
      },
      orderBy: { version: 'desc' }
    });

    return records.map(toProductLineAiPromptVersionRecord);
  }

  async restoreProductLineAiPromptVersion(input: CrmProductLineAiPromptVersionRestoreInput) {
    return this.prisma.$transaction(async tx => {
      const restoredVersion = await tx.crmProductLineAiPromptVersion.findFirst({
        where: {
          id: input.versionId,
          organizationId: input.organizationId,
          productLineId: input.productLineId
        }
      });

      if (!restoredVersion) {
        return null;
      }

      const productLines = await tx.crmProductLine.updateManyAndReturn({
        where: {
          id: input.productLineId,
          organizationId: input.organizationId
        },
        data: {
          aiWritingConfig: toProductLineAiPromptVersionJson(
            toProductLineAiWritingConfig(restoredVersion.aiWritingConfig)
          )
        },
        limit: 1
      });
      const productLine = productLines[0];

      if (!productLine) {
        return null;
      }

      const latestVersion = await tx.crmProductLineAiPromptVersion.findFirst({
        where: {
          organizationId: input.organizationId,
          productLineId: input.productLineId
        },
        orderBy: { version: 'desc' }
      });
      const currentVersion = await tx.crmProductLineAiPromptVersion.create({
        data: {
          organizationId: input.organizationId,
          productLineId: input.productLineId,
          version: (latestVersion?.version ?? restoredVersion.version) + 1,
          aiWritingConfig: toProductLineAiPromptVersionJson(
            toProductLineAiWritingConfig(restoredVersion.aiWritingConfig)
          ),
          editorId: input.editorId,
          editorName: input.editorName ?? null,
          changeSummary: input.changeSummary ?? `恢复版本 ${restoredVersion.version}`
        }
      });

      return {
        productLine: toProductLineRecord(productLine),
        restoredVersion: toProductLineAiPromptVersionRecord(restoredVersion),
        currentVersion: toProductLineAiPromptVersionRecord(currentVersion)
      };
    });
  }
}
