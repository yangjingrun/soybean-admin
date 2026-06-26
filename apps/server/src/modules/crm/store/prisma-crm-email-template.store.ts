import { Inject } from '@nestjs/common';
import type { CrmEmailTemplateGroupModel } from '../../../generated/prisma/models/CrmEmailTemplateGroup';
import type { CrmEmailTemplateStepModel } from '../../../generated/prisma/models/CrmEmailTemplateStep';
import { PrismaService } from '../../database/prisma.service';
import {
  toEmailTemplateGroupListWhere,
  toEmailTemplateGroupRecord,
  toEmailTemplateStepCreateManyInput
} from './prisma-crm-store.helpers';
import type {
  CrmEmailTemplateGroupCreateInput,
  CrmEmailTemplateGroupListInput,
  CrmEmailTemplateGroupUpdateInput
} from '../crm.types';

type CrmEmailTemplateGroupModelWithSteps = CrmEmailTemplateGroupModel & {
  steps: CrmEmailTemplateStepModel[];
};

const emailTemplateGroupInclude = {
  steps: {
    orderBy: { stepIndex: 'asc' as const }
  }
};

export class PrismaCrmEmailTemplateStore {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listEmailTemplateGroups(input: CrmEmailTemplateGroupListInput) {
    const where = toEmailTemplateGroupListWhere(input);
    const [records, total] = await Promise.all([
      this.prisma.crmEmailTemplateGroup.findMany({
        where,
        skip: input.skip,
        take: input.take,
        orderBy: { updatedAt: 'desc' },
        include: emailTemplateGroupInclude
      }),
      this.prisma.crmEmailTemplateGroup.count({ where })
    ]);

    return {
      records: records.map(toEmailTemplateGroupRecord),
      total
    };
  }

  findEmailTemplateGroupByName(organizationId: string, name: string) {
    return this.prisma.crmEmailTemplateGroup
      .findUnique({
        where: {
          organizationId_name: {
            organizationId,
            name
          }
        },
        include: emailTemplateGroupInclude
      })
      .then(record => (record ? toEmailTemplateGroupRecord(record) : null));
  }

  findEmailTemplateGroupById(args: { id: string; organizationId: string }) {
    return this.prisma.crmEmailTemplateGroup
      .findFirst({
        where: {
          id: args.id,
          organizationId: args.organizationId
        },
        include: emailTemplateGroupInclude
      })
      .then(record => (record ? toEmailTemplateGroupRecord(record) : null));
  }

  findDefaultEmailTemplateGroup(organizationId: string) {
    return this.prisma.crmEmailTemplateGroup
      .findFirst({
        where: {
          organizationId,
          status: 'active',
          isDefault: true
        },
        include: emailTemplateGroupInclude,
        orderBy: { updatedAt: 'desc' }
      })
      .then(record => (record ? toEmailTemplateGroupRecord(record) : null));
  }

  async createEmailTemplateGroup(input: CrmEmailTemplateGroupCreateInput) {
    return this.prisma.$transaction(async tx => {
      const group = await tx.crmEmailTemplateGroup.create({
        data: {
          organizationId: input.organizationId,
          name: input.name,
          language: input.language,
          description: input.description ?? null,
          status: input.status,
          isDefault: input.isDefault,
          createdById: input.createdById,
          createdByName: input.createdByName ?? null
        }
      });

      await tx.crmEmailTemplateStep.createMany({
        data: toEmailTemplateStepCreateManyInput(input.organizationId, group.id, input.steps)
      });

      const record = await tx.crmEmailTemplateGroup.findUnique({
        where: { id: group.id },
        include: emailTemplateGroupInclude
      });

      return toEmailTemplateGroupRecord(record as CrmEmailTemplateGroupModelWithSteps);
    });
  }

  async updateEmailTemplateGroup(id: string, organizationId: string, input: CrmEmailTemplateGroupUpdateInput) {
    return this.prisma.$transaction(async tx => {
      const records = await tx.crmEmailTemplateGroup.updateManyAndReturn({
        where: {
          id,
          organizationId
        },
        data: {
          name: input.name,
          language: input.language,
          description: input.description,
          status: input.status,
          isDefault: input.isDefault
        },
        limit: 1
      });

      if (!records[0]) {
        return null;
      }

      if (input.steps) {
        await tx.crmEmailTemplateStep.deleteMany({
          where: {
            organizationId,
            templateGroupId: id
          }
        });
        await tx.crmEmailTemplateStep.createMany({
          data: toEmailTemplateStepCreateManyInput(organizationId, id, input.steps)
        });
      }

      const record = await tx.crmEmailTemplateGroup.findUnique({
        where: { id },
        include: emailTemplateGroupInclude
      });

      return record ? toEmailTemplateGroupRecord(record) : null;
    });
  }

  async setDefaultEmailTemplateGroup(id: string, organizationId: string) {
    return this.prisma.$transaction(async tx => {
      const records = await tx.crmEmailTemplateGroup.updateManyAndReturn({
        where: {
          id,
          organizationId,
          status: 'active'
        },
        data: { isDefault: true },
        limit: 1
      });

      if (!records[0]) {
        return null;
      }

      await tx.crmEmailTemplateGroup.updateMany({
        where: {
          organizationId,
          id: { not: id },
          isDefault: true
        },
        data: { isDefault: false }
      });

      const record = await tx.crmEmailTemplateGroup.findUnique({
        where: { id },
        include: emailTemplateGroupInclude
      });

      return record ? toEmailTemplateGroupRecord(record) : null;
    });
  }
}
