import { randomUUID } from 'node:crypto';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type {
  CrmDraftApprovalInput,
  CrmDraftApprovalRecord,
  CrmMessageCreateInput,
  CrmMessageDraftUpdateGuard,
  CrmMessageDraftVersionCreateInput,
  CrmMessageDraftVersionRestoreInput,
  CrmMessageUpdateInput
} from '../crm.types';
import {
  toAccountRecord,
  toMessageDraftVersionRecord,
  toMessageIdentityWhere,
  toMessageRecord,
  toSequenceEnrollmentRecord,
  toTimelineEventRecord,
  type CrmMessageDraftVersionRaw
} from './prisma-crm-store.helpers';

export class PrismaCrmMessageDraftStore {
  constructor(private readonly prisma: PrismaService) {}

  async createMessage(input: CrmMessageCreateInput) {
    const record = await this.prisma.crmMessage.create({
      data: input as Prisma.CrmMessageUncheckedCreateInput
    });

    return toMessageRecord(record);
  }

  findMessageById(args: { id: string; organizationId: string; ownerUserId?: string }) {
    return this.prisma.crmMessage
      .findFirst({
        where: toMessageIdentityWhere(args)
      })
      .then(record => (record ? toMessageRecord(record) : null));
  }

  findSentMessageByProviderId(args: {
    organizationId: string;
    ownerUserId: string;
    mailboxId: string | null;
    providerMessageId: string;
  }) {
    return this.prisma.crmMessage
      .findFirst({
        where: {
          organizationId: args.organizationId,
          ownerUserId: args.ownerUserId,
          mailboxId: args.mailboxId,
          providerMessageId: args.providerMessageId,
          status: 'sent'
        }
      })
      .then(record => (record ? toMessageRecord(record) : null));
  }

  findSentMessageByProviderThreadId(args: {
    organizationId: string;
    ownerUserId: string;
    mailboxId: string | null;
    providerThreadId: string;
  }) {
    return this.prisma.crmMessage
      .findFirst({
        where: {
          organizationId: args.organizationId,
          ownerUserId: args.ownerUserId,
          mailboxId: args.mailboxId,
          providerThreadId: args.providerThreadId,
          status: 'sent'
        }
      })
      .then(record => (record ? toMessageRecord(record) : null));
  }

  async updateMessage(
    id: string,
    organizationId: string,
    input: CrmMessageUpdateInput,
    guard?: CrmMessageDraftUpdateGuard
  ) {
    const records = await this.prisma.crmMessage.updateManyAndReturn({
      where: {
        id,
        organizationId,
        ...(guard ? { status: guard.status } : {})
      },
      data: input as Prisma.CrmMessageUpdateManyMutationInput,
      limit: 1
    });

    return records[0] ? toMessageRecord(records[0]) : null;
  }

  async createMessageDraftVersion(input: CrmMessageDraftVersionCreateInput) {
    const records = await this.prisma.$queryRaw<CrmMessageDraftVersionRaw[]>`
      WITH next_version AS (
        SELECT COALESCE(MAX("versionNo"), 0) + 1 AS "versionNo"
        FROM "CrmMessageDraftVersion"
        WHERE "messageId" = ${input.messageId}
      )
      INSERT INTO "CrmMessageDraftVersion" (
        "id",
        "organizationId",
        "ownerUserId",
        "accountId",
        "contactId",
        "enrollmentId",
        "messageId",
        "mailboxId",
        "stepIndex",
        "versionNo",
        "subject",
        "bodyText",
        "editorId",
        "editorName"
      )
      SELECT
        ${randomUUID()},
        ${input.organizationId},
        ${input.ownerUserId},
        ${input.accountId},
        ${input.contactId},
        ${input.enrollmentId},
        ${input.messageId},
        ${input.mailboxId ?? null},
        ${input.stepIndex},
        next_version."versionNo",
        ${input.subject},
        ${input.bodyText},
        ${input.editorId},
        ${input.editorName ?? null}
      FROM next_version
      RETURNING *
    `;

    const record = records[0];

    if (!record) {
      throw new Error('CRM draft version insert returned no record');
    }

    return toMessageDraftVersionRecord(record);
  }

  async listMessageDraftVersions(args: { messageId: string; organizationId: string; ownerUserId?: string }) {
    const records = args.ownerUserId
      ? await this.prisma.$queryRaw<CrmMessageDraftVersionRaw[]>`
          SELECT *
          FROM "CrmMessageDraftVersion"
          WHERE "messageId" = ${args.messageId}
            AND "organizationId" = ${args.organizationId}
            AND "ownerUserId" = ${args.ownerUserId}
          ORDER BY "versionNo" DESC, "createdAt" DESC
        `
      : await this.prisma.$queryRaw<CrmMessageDraftVersionRaw[]>`
          SELECT *
          FROM "CrmMessageDraftVersion"
          WHERE "messageId" = ${args.messageId}
            AND "organizationId" = ${args.organizationId}
          ORDER BY "versionNo" DESC, "createdAt" DESC
        `;

    return records.map(toMessageDraftVersionRecord);
  }

  async restoreMessageDraftVersion(input: CrmMessageDraftVersionRestoreInput) {
    return this.prisma.$transaction(async tx => {
      const versions = await tx.$queryRaw<CrmMessageDraftVersionRaw[]>`
        SELECT *
        FROM "CrmMessageDraftVersion"
        WHERE "id" = ${input.versionId}
          AND "messageId" = ${input.messageId}
          AND "organizationId" = ${input.organizationId}
          AND "ownerUserId" = ${input.ownerUserId}
        LIMIT 1
      `;
      const version = versions[0];

      if (!version) {
        return null;
      }

      const records = await tx.crmMessage.updateManyAndReturn({
        where: {
          id: input.messageId,
          organizationId: input.organizationId,
          ownerUserId: input.ownerUserId,
          status: 'draft_pending_review'
        },
        data: {
          subject: version.subject,
          bodyText: version.bodyText
        },
        limit: 1
      });

      return records[0] ? toMessageRecord(records[0]) : null;
    });
  }

  async approveMessageDraft(input: CrmDraftApprovalInput): Promise<CrmDraftApprovalRecord | null> {
    return this.prisma.$transaction(async tx => {
      const [targetMessage, targetEnrollment] = await Promise.all([
        tx.crmMessage.findFirst({
          where: {
            id: input.messageId,
            organizationId: input.organizationId,
            ownerUserId: input.ownerUserId,
            status: input.fromMessageStatus
          }
        }),
        tx.crmSequenceEnrollment.findFirst({
          where: {
            id: input.enrollmentId,
            organizationId: input.organizationId,
            ownerUserId: input.ownerUserId,
            status: input.fromEnrollmentStatus
          }
        })
      ]);

      if (!targetMessage || !targetEnrollment) {
        return null;
      }

      const messages = await tx.crmMessage.updateManyAndReturn({
        where: {
          id: input.messageId,
          organizationId: input.organizationId,
          ownerUserId: input.ownerUserId,
          status: input.fromMessageStatus
        },
        data: { status: input.toMessageStatus },
        limit: 1
      });
      const message = messages[0];

      if (!message) {
        return null;
      }

      const enrollments = await tx.crmSequenceEnrollment.updateManyAndReturn({
        where: {
          id: input.enrollmentId,
          organizationId: input.organizationId,
          ownerUserId: input.ownerUserId,
          status: input.fromEnrollmentStatus
        },
        data: { status: input.toEnrollmentStatus },
        limit: 1
      });
      const enrollment = enrollments[0];

      if (!enrollment) {
        return null;
      }

      const account = await tx.crmAccount.update({
        where: { id: input.accountId },
        data: { status: input.accountStatus }
      });
      const event = await tx.crmTimelineEvent.create({
        data: {
          organizationId: input.organizationId,
          accountId: input.accountId,
          contactId: input.contactId,
          ownerUserId: input.ownerUserId,
          eventType: 'draft_approved',
          title: '首封开发信人工确认',
          content: message.subject,
          metadata: {
            enrollmentId: enrollment.id,
            messageId: message.id,
            fromStatus: input.fromEnrollmentStatus,
            toStatus: input.toEnrollmentStatus
          }
        }
      });

      return {
        enrollment: toSequenceEnrollmentRecord(enrollment),
        message: toMessageRecord(message),
        account: toAccountRecord(account),
        event: toTimelineEventRecord(event)
      };
    });
  }
}
