import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  isPrismaUniqueConflict,
  toMailboxIdentityWhere,
  toMailboxListWhere,
  toMailboxRecord
} from './prisma-crm-store.helpers';
import type {
  CrmMailboxAuthorizationExpiredInput,
  CrmMailboxAuthorizationExpiredRecord,
  CrmMailboxCreateInput,
  CrmMailboxHistoryAdvanceInput,
  CrmMailboxProvider,
  CrmMailboxStatus,
  CrmMailboxUpdateInput,
  CrmMailboxWatchRenewalListInput
} from '../crm.types';

export class PrismaCrmMailboxStore {
  constructor(private readonly prisma: PrismaService) {}

  findMailboxByProviderAndEmailHash(provider: CrmMailboxProvider, emailHash: string) {
    return this.prisma.crmMailbox
      .findUnique({
        where: {
          provider_emailHash: {
            provider,
            emailHash
          }
        }
      })
      .then(record => (record ? toMailboxRecord(record) : null));
  }

  async createMailbox(input: CrmMailboxCreateInput) {
    try {
      const record = await this.prisma.crmMailbox.create({
        data: input as Prisma.CrmMailboxUncheckedCreateInput
      });

      return toMailboxRecord(record);
    } catch (error) {
      if (isPrismaUniqueConflict(error)) {
        const existingMailbox = await this.findMailboxByProviderAndEmailHash(input.provider, input.emailHash);

        if (existingMailbox) return existingMailbox;
      }

      throw error;
    }
  }

  async listMailboxes(args: {
    organizationId: string;
    ownerUserId?: string;
    keyword?: string;
    status?: CrmMailboxStatus;
    skip: number;
    take: number;
  }) {
    const where = toMailboxListWhere(args);
    const [records, total] = await Promise.all([
      this.prisma.crmMailbox.findMany({
        where,
        skip: args.skip,
        take: args.take,
        orderBy: { updatedAt: 'desc' }
      }),
      this.prisma.crmMailbox.count({ where })
    ]);

    return {
      records: records.map(toMailboxRecord),
      total
    };
  }

  findMailboxById(args: { id: string; organizationId: string; ownerUserId?: string }) {
    return this.prisma.crmMailbox
      .findFirst({
        where: toMailboxIdentityWhere(args)
      })
      .then(record => (record ? toMailboxRecord(record) : null));
  }

  async updateMailbox(id: string, input: CrmMailboxUpdateInput) {
    const records = await this.prisma.crmMailbox.updateManyAndReturn({
      where: { id },
      data: input,
      limit: 1
    });

    return records[0] ? toMailboxRecord(records[0]) : null;
  }

  async listMailboxesForWatchRenewal(input: CrmMailboxWatchRenewalListInput) {
    const records = await this.prisma.crmMailbox.findMany({
      where: {
        provider: input.provider,
        status: 'active',
        OR: [{ watchExpiration: null }, { watchExpiration: { lte: input.renewBefore } }]
      },
      orderBy: [{ watchExpiration: 'asc' }, { updatedAt: 'asc' }],
      take: input.take
    });

    return records.map(toMailboxRecord);
  }

  async advanceMailboxHistoryId(input: CrmMailboxHistoryAdvanceInput) {
    const records = await this.prisma.crmMailbox.updateManyAndReturn({
      where: {
        id: input.mailboxId,
        organizationId: input.organizationId,
        ownerUserId: input.ownerUserId,
        lastHistoryId: input.fromHistoryId
      },
      data: {
        lastHistoryId: input.toHistoryId,
        syncIssueType: null,
        syncIssueAt: null,
        syncIssueMessage: null
      },
      limit: 1
    });

    return records[0] ? toMailboxRecord(records[0]) : null;
  }

  async markMailboxAuthorizationExpired(
    input: CrmMailboxAuthorizationExpiredInput
  ): Promise<CrmMailboxAuthorizationExpiredRecord | null> {
    return this.prisma.$transaction(async tx => {
      const mailboxes = await tx.crmMailbox.updateManyAndReturn({
        where: {
          id: input.mailboxId,
          organizationId: input.organizationId,
          ownerUserId: input.ownerUserId
        },
        data: {
          status: 'auth_expired',
          watchExpiration: null,
          pausedAt: input.expiredAt
        },
        limit: 1
      });
      const mailbox = mailboxes[0];

      if (!mailbox) {
        return null;
      }

      const [pausedEnrollments, resetMessages] = await Promise.all([
        tx.crmSequenceEnrollment.updateMany({
          where: {
            organizationId: input.organizationId,
            ownerUserId: input.ownerUserId,
            mailboxId: input.mailboxId,
            status: { in: ['ready_to_send', 'sequence_running'] }
          },
          data: {
            status: 'paused',
            runVersion: { increment: 1 }
          }
        }),
        tx.crmMessage.updateMany({
          where: {
            organizationId: input.organizationId,
            ownerUserId: input.ownerUserId,
            mailboxId: input.mailboxId,
            status: 'queued'
          },
          data: {
            status: 'draft_ready',
            bullJobId: null
          }
        })
      ]);

      return {
        mailbox: toMailboxRecord(mailbox),
        pausedEnrollmentCount: pausedEnrollments.count,
        resetMessageCount: resetMessages.count
      };
    });
  }
}
