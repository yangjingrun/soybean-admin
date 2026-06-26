import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  toSequencePolicyCreateInput,
  toSequencePolicyListWhere,
  toSequencePolicyRecord,
  toSequencePolicyUpdateInput
} from './prisma-crm-store.helpers';
import type {
  CrmSequencePolicyCreateInput,
  CrmSequencePolicyListInput,
  CrmSequencePolicyUpdateInput
} from '../crm.types';
import type { CrmSequencePolicyRepository } from '../sequence-policies/crm-sequence-policy.repository';

@Injectable()
export class PrismaCrmSequencePolicyStore implements CrmSequencePolicyRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listSequencePolicies(input: CrmSequencePolicyListInput) {
    const where = toSequencePolicyListWhere(input);
    const [records, total] = await Promise.all([
      this.prisma.crmSequencePolicy.findMany({
        where,
        skip: input.skip,
        take: input.take,
        orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }]
      }),
      this.prisma.crmSequencePolicy.count({ where })
    ]);

    return {
      records: records.map(toSequencePolicyRecord),
      total
    };
  }

  findSequencePolicyByName(organizationId: string, name: string) {
    return this.prisma.crmSequencePolicy
      .findUnique({
        where: {
          organizationId_name: {
            organizationId,
            name
          }
        }
      })
      .then(record => (record ? toSequencePolicyRecord(record) : null));
  }

  findSequencePolicyById(args: { id: string; organizationId: string }) {
    return this.prisma.crmSequencePolicy
      .findFirst({
        where: {
          id: args.id,
          organizationId: args.organizationId
        }
      })
      .then(record => (record ? toSequencePolicyRecord(record) : null));
  }

  findDefaultSequencePolicy(organizationId: string) {
    return this.prisma.crmSequencePolicy
      .findFirst({
        where: {
          organizationId,
          status: 'active',
          isDefault: true
        },
        orderBy: { updatedAt: 'desc' }
      })
      .then(record => (record ? toSequencePolicyRecord(record) : null));
  }

  async createSequencePolicy(input: CrmSequencePolicyCreateInput) {
    return this.prisma.$transaction(async tx => {
      if (input.isDefault) {
        await tx.crmSequencePolicy.updateMany({
          where: {
            organizationId: input.organizationId,
            isDefault: true
          },
          data: { isDefault: false }
        });
      }

      const record = await tx.crmSequencePolicy.create({
        data: toSequencePolicyCreateInput(input)
      });

      return toSequencePolicyRecord(record);
    });
  }

  async updateSequencePolicy(id: string, organizationId: string, input: CrmSequencePolicyUpdateInput) {
    return this.prisma.$transaction(async tx => {
      if (input.isDefault) {
        await tx.crmSequencePolicy.updateMany({
          where: {
            organizationId,
            id: { not: id },
            isDefault: true
          },
          data: { isDefault: false }
        });
      }

      const records = await tx.crmSequencePolicy.updateManyAndReturn({
        where: {
          id,
          organizationId
        },
        data: toSequencePolicyUpdateInput(input),
        limit: 1
      });

      return records[0] ? toSequencePolicyRecord(records[0]) : null;
    });
  }

  async setDefaultSequencePolicy(id: string, organizationId: string) {
    return this.prisma.$transaction(async tx => {
      const records = await tx.crmSequencePolicy.updateManyAndReturn({
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

      await tx.crmSequencePolicy.updateMany({
        where: {
          organizationId,
          id: { not: id },
          isDefault: true
        },
        data: { isDefault: false }
      });

      return toSequencePolicyRecord(records[0]);
    });
  }
}
