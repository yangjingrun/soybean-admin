import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  toPersonaProfileCreateInput,
  toPersonaProfileListWhere,
  toPersonaProfileRecord,
  toPersonaProfileUpdateInput
} from './prisma-crm-store.helpers';
import type {
  CrmPersonaProfileCreateInput,
  CrmPersonaProfileListInput,
  CrmPersonaProfileUpdateInput
} from '../crm.types';
import type { CrmPersonaProfileRepository } from '../persona-profiles/crm-persona-profile.repository';

@Injectable()
export class PrismaCrmPersonaStore implements CrmPersonaProfileRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listPersonaProfiles(input: CrmPersonaProfileListInput) {
    const where = toPersonaProfileListWhere(input);
    const [records, total] = await Promise.all([
      this.prisma.crmPersonaProfile.findMany({
        where,
        skip: input.skip,
        take: input.take,
        orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }]
      }),
      this.prisma.crmPersonaProfile.count({ where })
    ]);

    return {
      records: records.map(toPersonaProfileRecord),
      total
    };
  }

  listActivePersonaProfiles(organizationId: string) {
    return this.prisma.crmPersonaProfile
      .findMany({
        where: {
          organizationId,
          status: 'active'
        },
        orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }]
      })
      .then(records => records.map(toPersonaProfileRecord));
  }

  findPersonaProfileByName(organizationId: string, name: string) {
    return this.prisma.crmPersonaProfile
      .findUnique({
        where: {
          organizationId_name: {
            organizationId,
            name
          }
        }
      })
      .then(record => (record ? toPersonaProfileRecord(record) : null));
  }

  findPersonaProfileById(args: { id: string; organizationId: string }) {
    return this.prisma.crmPersonaProfile
      .findFirst({
        where: {
          id: args.id,
          organizationId: args.organizationId
        }
      })
      .then(record => (record ? toPersonaProfileRecord(record) : null));
  }

  async createPersonaProfile(input: CrmPersonaProfileCreateInput) {
    return this.prisma.$transaction(async tx => {
      if (input.isDefault) {
        await tx.crmPersonaProfile.updateMany({
          where: {
            organizationId: input.organizationId,
            isDefault: true
          },
          data: { isDefault: false }
        });
      }

      const record = await tx.crmPersonaProfile.create({
        data: toPersonaProfileCreateInput(input)
      });

      return toPersonaProfileRecord(record);
    });
  }

  async updatePersonaProfile(id: string, organizationId: string, input: CrmPersonaProfileUpdateInput) {
    return this.prisma.$transaction(async tx => {
      if (input.isDefault) {
        await tx.crmPersonaProfile.updateMany({
          where: {
            organizationId,
            id: { not: id },
            isDefault: true
          },
          data: { isDefault: false }
        });
      }

      const records = await tx.crmPersonaProfile.updateManyAndReturn({
        where: {
          id,
          organizationId
        },
        data: toPersonaProfileUpdateInput(input),
        limit: 1
      });

      return records[0] ? toPersonaProfileRecord(records[0]) : null;
    });
  }

  async setDefaultPersonaProfile(id: string, organizationId: string) {
    return this.prisma.$transaction(async tx => {
      const records = await tx.crmPersonaProfile.updateManyAndReturn({
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

      await tx.crmPersonaProfile.updateMany({
        where: {
          organizationId,
          id: { not: id },
          isDefault: true
        },
        data: { isDefault: false }
      });

      return toPersonaProfileRecord(records[0]);
    });
  }
}
