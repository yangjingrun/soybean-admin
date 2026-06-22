import { Inject } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import type { CrmMessageModel } from '../../../generated/prisma/models/CrmMessage';
import { PrismaService } from '../../database/prisma.service';
import type {
  CrmSendCompletionInput,
  CrmSendCompletionRecord,
  CrmSendDeliveryClaimInput,
  CrmSendDeliveryClaimRecord,
  CrmSendFailureInput,
  CrmSendFailureRecord,
  CrmQueuedMessageSendDeferInput,
  CrmQueuedMessageSendTargetInput,
  CrmQueuedMessageSendTargetRecord,
  CrmSendStartInput,
  CrmSendStartRecord,
  CrmSequenceStopInput,
  CrmSequenceStopRecord
} from '../crm.types';
import { reserveMailboxSendQuota } from './prisma-crm-mailbox-quota.helpers';
import {
  toAccountRecord,
  toContactRecord,
  toMailboxRecord,
  toMessageRecord,
  toSequenceEnrollmentRecord,
  toSequenceReviewInclude,
  toSequenceReviewRecord,
  toTimelineEventRecord
} from './prisma-crm-store.helpers';

export class PrismaCrmSequenceSendStateStore {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async startFirstMessageSend(input: CrmSendStartInput): Promise<CrmSendStartRecord | null> {
    return this.prisma.$transaction(async tx => {
      const targetEnrollment = await tx.crmSequenceEnrollment.findFirst({
        where: {
          id: input.enrollmentId,
          organizationId: input.organizationId,
          ownerUserId: input.ownerUserId,
          status: input.fromEnrollmentStatus
        }
      });

      if (!targetEnrollment?.mailboxId) {
        return null;
      }

      const [targetMessage, contact, mailbox] = await Promise.all([
        tx.crmMessage.findFirst({
          where: {
            enrollmentId: targetEnrollment.id,
            organizationId: input.organizationId,
            ownerUserId: input.ownerUserId,
            stepIndex: 1,
            status: input.fromMessageStatus
          }
        }),
        tx.crmContact.findUnique({ where: { id: targetEnrollment.contactId } }),
        tx.crmMailbox.findUnique({ where: { id: targetEnrollment.mailboxId } })
      ]);

      if (!targetMessage || !contact || !mailbox || mailbox.status !== 'active') {
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

      const messages = await tx.crmMessage.updateManyAndReturn({
        where: {
          enrollmentId: enrollment.id,
          organizationId: input.organizationId,
          ownerUserId: input.ownerUserId,
          stepIndex: 1,
          status: input.fromMessageStatus
        },
        data: {
          status: input.toMessageStatus,
          scheduledAt: input.scheduledAt
        },
        limit: 1
      });
      const message = messages[0];

      if (!message) {
        return null;
      }

      const [account, event] = await Promise.all([
        tx.crmAccount.update({
          where: { id: enrollment.accountId },
          data: { status: input.accountStatus }
        }),
        tx.crmTimelineEvent.create({
          data: {
            organizationId: input.organizationId,
            accountId: enrollment.accountId,
            contactId: enrollment.contactId,
            ownerUserId: input.ownerUserId,
            eventType: 'message_send_scheduled',
            title: '首封开发信等待发送调度',
            content: message.subject,
            metadata: {
              enrollmentId: enrollment.id,
              messageId: message.id,
              runVersion: enrollment.runVersion
            }
          }
        })
      ]);

      return {
        enrollment: toSequenceEnrollmentRecord(enrollment),
        message: toMessageRecord(message),
        account: toAccountRecord(account),
        contact: toContactRecord(contact),
        mailbox: toMailboxRecord(mailbox),
        event: toTimelineEventRecord(event)
      };
    });
  }

  async claimFirstMessageSendDelivery(input: CrmSendDeliveryClaimInput): Promise<CrmSendDeliveryClaimRecord | null> {
    return this.prisma.$transaction(async tx => {
      const record = await tx.crmSequenceEnrollment.findFirst({
        where: {
          id: input.enrollmentId,
          organizationId: input.organizationId,
          ownerUserId: input.ownerUserId,
          runVersion: input.runVersion,
          status: 'sequence_running'
        },
        include: toSequenceReviewInclude()
      });

      if (!record) {
        return null;
      }

      const reviewItem = toSequenceReviewRecord(record);
      const targetMessage = reviewItem.messages.find(message => message.id === input.messageId) ?? null;

      if (
        !targetMessage ||
        targetMessage.status !== 'queued' ||
        !reviewItem.mailbox ||
        reviewItem.mailbox.status !== 'active'
      ) {
        return null;
      }

      const blacklistEntry = await tx.crmBlacklist.findUnique({
        where: {
          organizationId_emailHash: {
            organizationId: input.organizationId,
            emailHash: reviewItem.contact.emailHash
          }
        }
      });

      if (blacklistEntry) {
        await Promise.all([
          tx.crmSequenceEnrollment.updateMany({
            where: {
              id: input.enrollmentId,
              organizationId: input.organizationId,
              ownerUserId: input.ownerUserId,
              runVersion: input.runVersion,
              status: 'sequence_running'
            },
            data: {
              status: 'stopped',
              runVersion: { increment: 1 }
            }
          }),
          tx.crmMessage.updateMany({
            where: {
              id: input.messageId,
              organizationId: input.organizationId,
              ownerUserId: input.ownerUserId,
              status: 'queued'
            },
            data: {
              status: 'skipped',
              bullJobId: null
            }
          })
        ]);

        return null;
      }

      const reserved = await reserveMailboxSendQuota(tx, {
        organizationId: input.organizationId,
        mailboxId: reviewItem.mailbox.id,
        dailyLimit: reviewItem.mailbox.dailyLimit,
        hourlyLimit: reviewItem.mailbox.hourlyLimit,
        at: input.claimedAt
      });

      if (!reserved) {
        return null;
      }

      return {
        ...reviewItem,
        mailbox: reviewItem.mailbox,
        firstMessage: targetMessage
      };
    });
  }

  /** Reads a queued delivery target without reserving mailbox quota. */
  async findQueuedMessageSendTarget(
    input: CrmQueuedMessageSendTargetInput
  ): Promise<CrmQueuedMessageSendTargetRecord | null> {
    const record = await this.prisma.crmSequenceEnrollment.findFirst({
      where: {
        id: input.enrollmentId,
        organizationId: input.organizationId,
        ownerUserId: input.ownerUserId,
        runVersion: input.runVersion,
        status: 'sequence_running'
      },
      include: toSequenceReviewInclude()
    });

    if (!record) {
      return null;
    }

    const reviewItem = toSequenceReviewRecord(record);
    const targetMessage = reviewItem.messages.find(message => message.id === input.messageId) ?? null;

    if (
      !targetMessage ||
      targetMessage.status !== 'queued' ||
      !reviewItem.mailbox ||
      reviewItem.mailbox.status !== 'active'
    ) {
      return null;
    }

    return {
      ...reviewItem,
      mailbox: reviewItem.mailbox,
      firstMessage: targetMessage
    };
  }

  /** Moves a queued message back to draft_ready before quota claim when recipient timing blocks delivery. */
  async deferQueuedMessageSend(input: CrmQueuedMessageSendDeferInput) {
    return this.prisma.$transaction(async tx => {
      const enrollment = await tx.crmSequenceEnrollment.findFirst({
        where: {
          id: input.enrollmentId,
          organizationId: input.organizationId,
          ownerUserId: input.ownerUserId,
          runVersion: input.runVersion,
          status: 'sequence_running'
        },
        select: { id: true }
      });

      if (!enrollment) {
        return null;
      }

      const messages = await tx.crmMessage.updateManyAndReturn({
        where: {
          id: input.messageId,
          enrollmentId: enrollment.id,
          organizationId: input.organizationId,
          ownerUserId: input.ownerUserId,
          status: 'queued'
        },
        data: {
          status: 'draft_ready',
          bullJobId: null,
          scheduledAt: input.scheduledAt
        },
        limit: 1
      });

      return messages[0] ? toMessageRecord(messages[0]) : null;
    });
  }

  async stopSequenceEnrollment(input: CrmSequenceStopInput): Promise<CrmSequenceStopRecord | null> {
    return this.prisma.$transaction(async tx => {
      const enrollments = await tx.crmSequenceEnrollment.updateManyAndReturn({
        where: {
          id: input.enrollmentId,
          organizationId: input.organizationId,
          ...(input.ownerUserId ? { ownerUserId: input.ownerUserId } : {}),
          status: { in: input.fromStatuses }
        },
        data: {
          status: 'stopped',
          runVersion: { increment: 1 }
        },
        limit: 1
      });
      const enrollment = enrollments[0];

      if (!enrollment) {
        return null;
      }

      const skippedMessages = await tx.crmMessage.updateManyAndReturn({
        where: {
          enrollmentId: enrollment.id,
          organizationId: input.organizationId,
          status: 'queued'
        },
        data: {
          status: 'skipped',
          bullJobId: null
        }
      });
      const [account, event] = await Promise.all([
        tx.crmAccount.update({
          where: { id: enrollment.accountId },
          data: { status: input.accountStatus }
        }),
        tx.crmTimelineEvent.create({
          data: {
            organizationId: input.organizationId,
            accountId: enrollment.accountId,
            contactId: enrollment.contactId,
            ownerUserId: input.actorUserId,
            eventType: 'sequence_stopped',
            title: '开发信序列已停止',
            content: enrollment.name,
            metadata: {
              enrollmentId: enrollment.id,
              fromStatuses: input.fromStatuses,
              toStatus: 'stopped',
              runVersion: enrollment.runVersion
            }
          }
        })
      ]);

      return {
        enrollment: toSequenceEnrollmentRecord(enrollment),
        message: skippedMessages[0] ? toMessageRecord(skippedMessages[0]) : null,
        account: toAccountRecord(account),
        event: toTimelineEventRecord(event)
      };
    });
  }

  async completeFirstMessageSend(input: CrmSendCompletionInput): Promise<CrmSendCompletionRecord | null> {
    return this.prisma.$transaction(async tx => {
      const targetMessage = await tx.crmMessage.findFirst({
        where: {
          id: input.messageId,
          enrollmentId: input.enrollmentId,
          organizationId: input.organizationId,
          ownerUserId: input.ownerUserId,
          status: 'queued'
        }
      });

      if (!targetMessage) {
        return null;
      }

      const enrollments = await tx.crmSequenceEnrollment.updateManyAndReturn({
        where: {
          id: input.enrollmentId,
          organizationId: input.organizationId,
          ownerUserId: input.ownerUserId,
          runVersion: input.runVersion,
          status: 'sequence_running'
        },
        data: { currentStep: targetMessage.stepIndex },
        limit: 1
      });
      const enrollment = enrollments[0];

      if (!enrollment) {
        return null;
      }

      const recipientAccount = await tx.crmAccount.findUnique({
        where: { id: targetMessage.accountId },
        select: { timeZone: true }
      });

      const messages = await tx.crmMessage.updateManyAndReturn({
        where: {
          id: input.messageId,
          enrollmentId: input.enrollmentId,
          organizationId: input.organizationId,
          ownerUserId: input.ownerUserId,
          status: 'queued'
        },
        data: {
          status: 'sent',
          sentAt: input.sentAt,
          providerMessageId: input.providerMessageId ?? null,
          providerThreadId: input.providerThreadId ?? null,
          recipientTimeZone: recipientAccount?.timeZone ?? null
        },
        limit: 1
      });
      const message = messages[0];

      if (!message) {
        return null;
      }

      let nextMessage: CrmMessageModel | null = null;

      if (input.nextMessage) {
        nextMessage = await tx.crmMessage.findFirst({
          where: {
            enrollmentId: enrollment.id,
            organizationId: input.organizationId,
            ownerUserId: input.ownerUserId,
            stepIndex: input.nextMessage.stepIndex
          }
        });

        if (!nextMessage) {
          nextMessage = await tx.crmMessage.create({
            data: {
              ...input.nextMessage,
              enrollmentId: enrollment.id
            } as Prisma.CrmMessageUncheckedCreateInput
          });
        }
      }

      const account = await tx.crmAccount.update({
        where: { id: enrollment.accountId },
        data: { status: 'sequence_running' }
      });
      const event = await tx.crmTimelineEvent.create({
        data: {
          organizationId: input.organizationId,
          accountId: enrollment.accountId,
          contactId: enrollment.contactId,
          ownerUserId: input.ownerUserId,
          eventType: 'message_sent',
          title: '首封开发信已发送',
          content: message.subject,
          metadata: {
            enrollmentId: enrollment.id,
            messageId: message.id,
            runVersion: enrollment.runVersion,
            nextMessageId: nextMessage?.id ?? null,
            nextStepIndex: nextMessage?.stepIndex ?? null
          }
        }
      });

      return {
        enrollment: toSequenceEnrollmentRecord(enrollment),
        message: toMessageRecord(message),
        nextMessage: nextMessage ? toMessageRecord(nextMessage) : null,
        account: toAccountRecord(account),
        event: toTimelineEventRecord(event)
      };
    });
  }

  async failFirstMessageSend(input: CrmSendFailureInput): Promise<CrmSendFailureRecord | null> {
    return this.prisma.$transaction(async tx => {
      const enrollments = await tx.crmSequenceEnrollment.updateManyAndReturn({
        where: {
          id: input.enrollmentId,
          organizationId: input.organizationId,
          ownerUserId: input.ownerUserId,
          runVersion: input.runVersion,
          status: 'sequence_running'
        },
        data: { status: 'ready_to_send' },
        limit: 1
      });
      const enrollment = enrollments[0];

      if (!enrollment) {
        return null;
      }

      const messages = await tx.crmMessage.updateManyAndReturn({
        where: {
          id: input.messageId,
          enrollmentId: input.enrollmentId,
          organizationId: input.organizationId,
          ownerUserId: input.ownerUserId,
          status: 'queued'
        },
        data: {
          status: 'draft_ready',
          bullJobId: null
        },
        limit: 1
      });
      const message = messages[0];

      if (!message) {
        return null;
      }

      const account = await tx.crmAccount.update({
        where: { id: enrollment.accountId },
        data: { status: 'ready' }
      });
      const event = await tx.crmTimelineEvent.create({
        data: {
          organizationId: input.organizationId,
          accountId: enrollment.accountId,
          contactId: enrollment.contactId,
          ownerUserId: input.ownerUserId,
          eventType: 'message_send_failed',
          title: '首封开发信发送失败',
          content: input.reason,
          metadata: {
            enrollmentId: enrollment.id,
            messageId: message.id,
            runVersion: enrollment.runVersion
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
