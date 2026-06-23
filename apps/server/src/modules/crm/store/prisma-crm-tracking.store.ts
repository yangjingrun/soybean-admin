import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type { CrmEmailOpenEventRecord, CrmTrackingRepository } from '../tracking/crm-tracking.types';
import { toAccountRecord, toContactRecord, toTimelineEventRecord } from './prisma-crm-core.mapper';
import { toMailboxRecord } from './prisma-crm-mailbox.mapper';
import { toMessageRecord, toSequenceEnrollmentRecord } from './prisma-crm-sequence.mapper';

type CrmEmailOpenEventRaw = CrmEmailOpenEventRecord & { isFirstOpen: boolean };

@Injectable()
export class PrismaCrmTrackingStore implements CrmTrackingRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findEmailOpenTargetByMessageId(messageId: string) {
    const record = await this.prisma.crmMessage.findFirst({
      where: {
        id: messageId,
        status: 'sent'
      },
      include: {
        account: true,
        contact: true,
        enrollment: true,
        mailbox: true
      }
    });

    if (!record) {
      return null;
    }

    return {
      message: toMessageRecord(record),
      account: toAccountRecord(record.account),
      contact: toContactRecord(record.contact),
      enrollment: toSequenceEnrollmentRecord(record.enrollment),
      mailbox: record.mailbox ? toMailboxRecord(record.mailbox) : null
    };
  }

  /** Upserts one aggregate email-open row and tells the service whether this is the first open. */
  async recordEmailOpen(input: Parameters<CrmTrackingRepository['recordEmailOpen']>[0]) {
    const id = randomUUID();
    const { target, openedAt } = input;
    const rows = await this.prisma.$queryRaw<CrmEmailOpenEventRaw[]>(Prisma.sql`
      WITH inserted AS (
        INSERT INTO "CrmEmailOpenEvent" (
          "id",
          "organizationId",
          "ownerUserId",
          "accountId",
          "contactId",
          "enrollmentId",
          "messageId",
          "openCount",
          "firstOpenedAt",
          "lastOpenedAt",
          "lastUserAgent",
          "lastIpAddress",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          ${id},
          ${target.message.organizationId},
          ${target.message.ownerUserId},
          ${target.message.accountId},
          ${target.message.contactId},
          ${target.message.enrollmentId},
          ${target.message.id},
          1,
          ${openedAt},
          ${openedAt},
          ${input.userAgent ?? null},
          ${input.ipAddress ?? null},
          ${openedAt},
          ${openedAt}
        )
        ON CONFLICT ("messageId") DO NOTHING
        RETURNING *, true AS "isFirstOpen"
      ),
      updated AS (
        UPDATE "CrmEmailOpenEvent"
        SET
          "openCount" = "openCount" + 1,
          "lastOpenedAt" = ${openedAt},
          "lastUserAgent" = ${input.userAgent ?? null},
          "lastIpAddress" = ${input.ipAddress ?? null},
          "updatedAt" = ${openedAt}
        WHERE "messageId" = ${target.message.id}
          AND NOT EXISTS (SELECT 1 FROM inserted)
        RETURNING *, false AS "isFirstOpen"
      )
      SELECT * FROM inserted
      UNION ALL
      SELECT * FROM updated
    `);
    const row = rows[0];

    return {
      event: toEmailOpenEventRecord(row),
      isFirstOpen: row.isFirstOpen
    };
  }

  async createTimelineEvent(input: Parameters<CrmTrackingRepository['createTimelineEvent']>[0]) {
    return toTimelineEventRecord(
      await this.prisma.crmTimelineEvent.create({
        data: {
          organizationId: input.organizationId,
          ownerUserId: input.ownerUserId,
          accountId: input.accountId,
          contactId: input.contactId ?? null,
          eventType: input.eventType,
          title: input.title,
          content: input.content ?? null,
          metadata: input.metadata as Prisma.InputJsonValue
        }
      })
    );
  }
}

function toEmailOpenEventRecord(row: CrmEmailOpenEventRaw): CrmEmailOpenEventRecord {
  return {
    id: row.id,
    organizationId: row.organizationId,
    ownerUserId: row.ownerUserId,
    accountId: row.accountId,
    contactId: row.contactId,
    enrollmentId: row.enrollmentId,
    messageId: row.messageId,
    openCount: Number(row.openCount),
    firstOpenedAt: new Date(row.firstOpenedAt),
    lastOpenedAt: new Date(row.lastOpenedAt),
    lastUserAgent: row.lastUserAgent,
    lastIpAddress: row.lastIpAddress,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt)
  };
}
