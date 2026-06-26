import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { toBlacklistListWhere, toBlacklistRecord, toUniqueStrings } from './prisma-crm-store.helpers';
import type { CrmBlacklistDeleteInput, CrmBlacklistListInput, CrmBlacklistUpsertInput } from '../crm.types';
import type { CrmSuppressionRepository } from '../suppression/crm-suppression.repository';

@Injectable()
export class PrismaCrmSuppressionStore implements CrmSuppressionRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  findBlacklistEntry(args: { organizationId: string; emailHash: string }) {
    return this.prisma.crmBlacklist
      .findUnique({
        where: {
          organizationId_emailHash: {
            organizationId: args.organizationId,
            emailHash: args.emailHash
          }
        }
      })
      .then(record => (record ? toBlacklistRecord(record) : null));
  }

  async listBlacklistEntriesByEmailHashes(args: { organizationId: string; emailHashes: string[] }) {
    const emailHashes = toUniqueStrings(args.emailHashes);

    if (emailHashes.length === 0) {
      return [];
    }

    const records = await this.prisma.crmBlacklist.findMany({
      where: {
        organizationId: args.organizationId,
        emailHash: { in: emailHashes }
      }
    });

    return records.map(toBlacklistRecord);
  }

  async upsertBlacklistEntry(input: CrmBlacklistUpsertInput) {
    const record = await this.prisma.crmBlacklist.upsert({
      where: {
        organizationId_emailHash: {
          organizationId: input.organizationId,
          emailHash: input.emailHash
        }
      },
      create: input,
      update: {
        maskedEmail: input.maskedEmail,
        reason: input.reason,
        sourceAccountId: input.sourceAccountId ?? null,
        sourceContactId: input.sourceContactId ?? null,
        sourceMessageId: input.sourceMessageId ?? null,
        createdById: input.createdById ?? null,
        createdByName: input.createdByName ?? null
      }
    });

    return toBlacklistRecord(record);
  }

  async listBlacklistEntries(input: CrmBlacklistListInput) {
    const where = toBlacklistListWhere(input);
    const [records, total] = await Promise.all([
      this.prisma.crmBlacklist.findMany({
        where,
        skip: input.skip,
        take: input.take,
        orderBy: { updatedAt: 'desc' }
      }),
      this.prisma.crmBlacklist.count({ where })
    ]);

    return {
      records: records.map(toBlacklistRecord),
      total
    };
  }

  async deleteBlacklistEntry(input: CrmBlacklistDeleteInput) {
    const record = await this.prisma.crmBlacklist.findFirst({
      where: {
        id: input.id,
        organizationId: input.organizationId
      }
    });

    if (!record) {
      return null;
    }

    await this.prisma.crmBlacklist.delete({
      where: {
        id: record.id
      }
    });

    return toBlacklistRecord(record);
  }
}
