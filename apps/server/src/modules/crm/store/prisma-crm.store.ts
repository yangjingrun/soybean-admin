import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import type { CrmAccountModel } from '../../../generated/prisma/models/CrmAccount';
import type { CrmContactModel } from '../../../generated/prisma/models/CrmContact';
import type { CrmInboxMessageModel } from '../../../generated/prisma/models/CrmInboxMessage';
import type { CrmInboxThreadModel } from '../../../generated/prisma/models/CrmInboxThread';
import type { CrmMailboxModel } from '../../../generated/prisma/models/CrmMailbox';
import type { CrmMessageModel } from '../../../generated/prisma/models/CrmMessage';
import type { CrmProductLineModel } from '../../../generated/prisma/models/CrmProductLine';
import type { CrmSequenceEnrollmentModel } from '../../../generated/prisma/models/CrmSequenceEnrollment';
import type { CrmTimelineEventModel } from '../../../generated/prisma/models/CrmTimelineEvent';
import { PrismaService } from '../../database/prisma.service';
import type {
  CrmAccountCreateInput,
  CrmAccountRecord,
  CrmAccountStatus,
  CrmAccountUpdateInput,
  CrmMailboxCreateInput,
  CrmMailboxAuthorizationExpiredInput,
  CrmMailboxAuthorizationExpiredRecord,
  CrmMailboxProvider,
  CrmMailboxRecord,
  CrmMailboxStatus,
  CrmMailboxHistoryAdvanceInput,
  CrmMailboxUpdateInput,
  CrmContactCreateInput,
  CrmContactRecord,
  CrmContactUpdateInput,
  CrmCustomerReplyIngestInput,
  CrmCustomerReplyIngestRecord,
  CrmEmailStatus,
  CrmInboxThreadDetailRecord,
  CrmInboxThreadListRecord,
  CrmInboxMessageRecord,
  CrmInboxThreadRecord,
  CrmInboxThreadReplyInput,
  CrmInboxThreadReplyRecord,
  CrmInboxThreadStatus,
  CrmInboxThreadStatusUpdateInput,
  CrmInboxThreadStatusUpdateRecord,
  CrmProductLineCreateInput,
  CrmProductLineRecord,
  CrmProductLineStatus,
  CrmProductLineUpdateInput,
  CrmMessageCreateInput,
  CrmMessageDraftUpdateGuard,
  CrmMessageRecord,
  CrmMessageUpdateInput,
  CrmDraftApprovalInput,
  CrmDraftApprovalRecord,
  CrmSequenceEnrollmentCreateInput,
  CrmSequenceEnrollmentRecord,
  CrmSequenceEnrollmentStatus,
  CrmSequenceEnrollmentUpdateInput,
  CrmSequenceDraftBundleCreateInput,
  CrmSequenceDraftBundleRecord,
  CrmSequenceReviewRecord,
  CrmSendCompletionInput,
  CrmSendCompletionRecord,
  CrmSendDeliveryClaimInput,
  CrmSendDeliveryClaimRecord,
  CrmSendFailureInput,
  CrmSendFailureRecord,
  CrmSendStartInput,
  CrmSendStartRecord,
  CrmSequenceStopInput,
  CrmSequenceStopRecord,
  CrmStore,
  CrmTimelineEventCreateInput,
  CrmTimelineEventRecord
} from '../crm.types';

@Injectable()
export class PrismaCrmStore implements CrmStore {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  findAccountByDomain(organizationId: string, ownerUserId: string, domain: string) {
    return this.prisma.crmAccount
      .findUnique({
        where: {
          organizationId_ownerUserId_domain: {
            organizationId,
            ownerUserId,
            domain
          }
        }
      })
      .then(record => (record ? toAccountRecord(record) : null));
  }

  async createAccount(input: CrmAccountCreateInput) {
    try {
      const record = await this.prisma.crmAccount.create({
        data: input as Prisma.CrmAccountUncheckedCreateInput
      });

      return toAccountRecord(record);
    } catch (error) {
      if (isPrismaUniqueConflict(error) && input.domain) {
        const existingAccount = await this.findAccountByDomain(input.organizationId, input.ownerUserId, input.domain);

        if (existingAccount) return existingAccount;
      }

      throw error;
    }
  }

  async updateAccount(id: string, input: CrmAccountUpdateInput) {
    const records = await this.prisma.crmAccount.updateManyAndReturn({
      where: { id },
      data: input,
      limit: 1
    });

    return records[0] ? toAccountRecord(records[0]) : null;
  }

  findContactByEmailHash(organizationId: string, ownerUserId: string, emailHash: string) {
    return this.prisma.crmContact
      .findUnique({
        where: {
          organizationId_ownerUserId_emailHash: {
            organizationId,
            ownerUserId,
            emailHash
          }
        }
      })
      .then(record => (record ? toContactRecord(record) : null));
  }

  async createContact(input: CrmContactCreateInput) {
    try {
      const record = await this.prisma.crmContact.create({
        data: input as Prisma.CrmContactUncheckedCreateInput
      });

      return toContactRecord(record);
    } catch (error) {
      if (isPrismaUniqueConflict(error)) {
        const existingContact = await this.findContactByEmailHash(
          input.organizationId,
          input.ownerUserId,
          input.emailHash
        );

        if (existingContact) return existingContact;
      }

      throw error;
    }
  }

  async updateContact(id: string, input: CrmContactUpdateInput) {
    const records = await this.prisma.crmContact.updateManyAndReturn({
      where: { id },
      data: input,
      limit: 1
    });

    return records[0] ? toContactRecord(records[0]) : null;
  }

  findContactById(args: { id: string; organizationId: string; ownerUserId?: string }) {
    return this.prisma.crmContact
      .findFirst({
        where: toContactIdentityWhere(args)
      })
      .then(record => (record ? toContactRecord(record) : null));
  }

  async updateContactEmailStatus(id: string, emailStatus: CrmEmailStatus) {
    const records = await this.prisma.crmContact.updateManyAndReturn({
      where: { id },
      data: { emailStatus },
      limit: 1
    });

    return records[0] ? toContactRecord(records[0]) : null;
  }

  async listAccounts(args: {
    organizationId: string;
    ownerUserId?: string;
    keyword?: string;
    status?: CrmAccountStatus;
    skip: number;
    take: number;
  }) {
    const where = toAccountListWhere(args);
    const [records, total] = await Promise.all([
      this.prisma.crmAccount.findMany({
        where,
        skip: args.skip,
        take: args.take,
        orderBy: { updatedAt: 'desc' }
      }),
      this.prisma.crmAccount.count({ where })
    ]);

    return {
      records: records.map(toAccountRecord),
      total
    };
  }

  async getAccountDetail(args: { id: string; organizationId: string; ownerUserId?: string }) {
    const account = await this.prisma.crmAccount.findFirst({
      where: toAccountIdentityWhere(args)
    });

    if (!account) return null;

    const [contacts, timelineEvents] = await Promise.all([
      this.prisma.crmContact.findMany({
        where: {
          organizationId: args.organizationId,
          accountId: account.id
        },
        orderBy: {
          createdAt: 'asc'
        }
      }),
      this.prisma.crmTimelineEvent.findMany({
        where: {
          organizationId: args.organizationId,
          accountId: account.id
        },
        orderBy: {
          createdAt: 'desc'
        }
      })
    ]);

    return {
      account: toAccountRecord(account),
      contacts: contacts.map(toContactRecord),
      timelineEvents: timelineEvents.map(toTimelineEventRecord)
    };
  }

  async createTimelineEvent(input: CrmTimelineEventCreateInput) {
    const record = await this.prisma.crmTimelineEvent.create({
      data: {
        organizationId: input.organizationId,
        accountId: input.accountId,
        contactId: input.contactId,
        ownerUserId: input.ownerUserId,
        eventType: input.eventType,
        title: input.title,
        content: input.content,
        metadata: input.metadata as Prisma.CrmTimelineEventCreateInput['metadata']
      }
    });

    return toTimelineEventRecord(record);
  }

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

  async advanceMailboxHistoryId(input: CrmMailboxHistoryAdvanceInput) {
    const records = await this.prisma.crmMailbox.updateManyAndReturn({
      where: {
        id: input.mailboxId,
        organizationId: input.organizationId,
        ownerUserId: input.ownerUserId,
        lastHistoryId: input.fromHistoryId
      },
      data: {
        lastHistoryId: input.toHistoryId
      },
      limit: 1
    });

    return records[0] ? toMailboxRecord(records[0]) : null;
  }

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
    const records = await this.prisma.crmProductLine.updateManyAndReturn({
      where: {
        id,
        organizationId
      },
      data: input,
      limit: 1
    });

    return records[0] ? toProductLineRecord(records[0]) : null;
  }

  findActiveEnrollmentByContact(args: {
    organizationId: string;
    ownerUserId: string;
    contactId: string;
    statuses: CrmSequenceEnrollmentStatus[];
  }) {
    return this.prisma.crmSequenceEnrollment
      .findFirst({
        where: {
          organizationId: args.organizationId,
          ownerUserId: args.ownerUserId,
          contactId: args.contactId,
          status: { in: args.statuses }
        },
        orderBy: { updatedAt: 'desc' }
      })
      .then(record => (record ? toSequenceEnrollmentRecord(record) : null));
  }

  async createSequenceEnrollment(input: CrmSequenceEnrollmentCreateInput) {
    const record = await this.prisma.crmSequenceEnrollment.create({
      data: input as Prisma.CrmSequenceEnrollmentUncheckedCreateInput
    });

    return toSequenceEnrollmentRecord(record);
  }

  async createSequenceDraftBundle(input: CrmSequenceDraftBundleCreateInput): Promise<CrmSequenceDraftBundleRecord> {
    return this.prisma.$transaction(async tx => {
      const enrollment = await tx.crmSequenceEnrollment.create({
        data: input.enrollment as Prisma.CrmSequenceEnrollmentUncheckedCreateInput
      });
      const message = await tx.crmMessage.create({
        data: {
          ...input.message,
          enrollmentId: enrollment.id
        } as Prisma.CrmMessageUncheckedCreateInput
      });
      const account = await tx.crmAccount.update({
        where: { id: input.enrollment.accountId },
        data: { status: input.accountStatus }
      });
      const event = await tx.crmTimelineEvent.create({
        data: {
          organizationId: input.timelineEvent.organizationId,
          accountId: input.timelineEvent.accountId,
          contactId: input.timelineEvent.contactId,
          ownerUserId: input.timelineEvent.ownerUserId,
          eventType: input.timelineEvent.eventType,
          title: input.timelineEvent.title,
          content: input.timelineEvent.content,
          metadata: {
            ...input.timelineEvent.metadata,
            enrollmentId: enrollment.id,
            messageId: message.id
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

  async listSequenceReviewItems(args: {
    organizationId: string;
    ownerUserId?: string;
    keyword?: string;
    status?: CrmSequenceEnrollmentStatus;
    skip: number;
    take: number;
  }) {
    const where = toSequenceEnrollmentListWhere(args);
    const [records, total] = await Promise.all([
      this.prisma.crmSequenceEnrollment.findMany({
        where,
        skip: args.skip,
        take: args.take,
        orderBy: { updatedAt: 'desc' },
        include: toSequenceReviewInclude()
      }),
      this.prisma.crmSequenceEnrollment.count({ where })
    ]);

    return {
      records: records.map(toSequenceReviewRecord),
      total
    };
  }

  async getSequenceReviewItem(args: { id: string; organizationId: string; ownerUserId?: string }) {
    const record = await this.prisma.crmSequenceEnrollment.findFirst({
      where: toSequenceEnrollmentIdentityWhere(args),
      include: toSequenceReviewInclude()
    });

    return record ? toSequenceReviewRecord(record) : null;
  }

  async updateSequenceEnrollment(
    id: string,
    organizationId: string,
    input: CrmSequenceEnrollmentUpdateInput
  ) {
    const records = await this.prisma.crmSequenceEnrollment.updateManyAndReturn({
      where: {
        id,
        organizationId
      },
      data: input,
      limit: 1
    });

    return records[0] ? toSequenceEnrollmentRecord(records[0]) : null;
  }

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
      data: input,
      limit: 1
    });

    return records[0] ? toMessageRecord(records[0]) : null;
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
            eventType: 'message_queued',
            title: '首封开发信进入发送队列',
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

      if (!record || record.messages[0]?.id !== input.messageId) {
        return null;
      }

      const reviewItem = toSequenceReviewRecord(record);

      if (
        !reviewItem.firstMessage ||
        reviewItem.firstMessage.status !== 'queued' ||
        !reviewItem.mailbox ||
        reviewItem.mailbox.status !== 'active'
      ) {
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
        firstMessage: reviewItem.firstMessage
      };
    });
  }

  async stopSequenceEnrollment(input: CrmSequenceStopInput): Promise<CrmSequenceStopRecord | null> {
    return this.prisma.$transaction(async tx => {
      const enrollments = await tx.crmSequenceEnrollment.updateManyAndReturn({
        where: {
          id: input.enrollmentId,
          organizationId: input.organizationId,
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
          stepIndex: 1,
          status: 'queued'
        },
        data: {
          status: 'skipped',
          bullJobId: null
        },
        limit: 1
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
      const enrollments = await tx.crmSequenceEnrollment.updateManyAndReturn({
        where: {
          id: input.enrollmentId,
          organizationId: input.organizationId,
          ownerUserId: input.ownerUserId,
          runVersion: input.runVersion,
          status: 'sequence_running'
        },
        data: { currentStep: 1 },
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
          status: 'sent',
          sentAt: input.sentAt,
          providerMessageId: input.providerMessageId ?? null,
          providerThreadId: input.providerThreadId ?? null
        },
        limit: 1
      });
      const message = messages[0];

      if (!message) {
        return null;
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

  async ingestCustomerReply(input: CrmCustomerReplyIngestInput): Promise<CrmCustomerReplyIngestRecord | null> {
    try {
      return await this.prisma.$transaction(async tx => {
        const outboundMessage = await tx.crmMessage.findFirst({
          where: {
            id: input.outboundMessageId,
            organizationId: input.organizationId,
            ownerUserId: input.ownerUserId,
            status: 'sent'
          },
          include: {
            account: true,
            contact: true,
            enrollment: true,
            mailbox: true
          }
        });

        if (!outboundMessage) {
          return null;
        }

        if (input.providerMessageId) {
          const existingMessage = await tx.crmInboxMessage.findFirst({
            where: {
              organizationId: input.organizationId,
              ownerUserId: input.ownerUserId,
              mailboxId: outboundMessage.mailboxId,
              providerMessageId: input.providerMessageId
            },
            include: { thread: true }
          });

          if (existingMessage) {
            return {
              thread: toInboxThreadRecord(existingMessage.thread),
              message: toInboxMessageRecord(existingMessage),
              account: toAccountRecord(outboundMessage.account),
              contact: toContactRecord(outboundMessage.contact),
              mailbox: outboundMessage.mailbox ? toMailboxRecord(outboundMessage.mailbox) : null,
              enrollment: outboundMessage.enrollment ? toSequenceEnrollmentRecord(outboundMessage.enrollment) : null,
              event: null,
              isDuplicate: true
            };
          }
        }

        const providerThreadId = input.providerThreadId ?? outboundMessage.enrollmentId;
        const threadIdentity = {
          organizationId: input.organizationId,
          ownerUserId: input.ownerUserId,
          accountId: outboundMessage.accountId,
          contactId: outboundMessage.contactId,
          enrollmentId: outboundMessage.enrollmentId,
          mailboxId: outboundMessage.mailboxId
        };
        const existingThread = await tx.crmInboxThread.findFirst({
          where: input.providerThreadId
            ? {
                organizationId: input.organizationId,
                ownerUserId: input.ownerUserId,
                mailboxId: outboundMessage.mailboxId,
                providerThreadId: input.providerThreadId
              }
            : threadIdentity
        });
        const thread =
          existingThread ??
          (await tx.crmInboxThread.create({
            data: {
              ...threadIdentity,
              provider: 'gmail',
              providerThreadId,
              subject: input.subject,
              status: 'pending',
              lastInboundAt: input.receivedAt,
              unreadCount: 0,
              messageCount: 0
            } as Prisma.CrmInboxThreadUncheckedCreateInput
          }));
        const messageType = input.messageType ?? 'customer_reply';
        const inboxMessage = await tx.crmInboxMessage.create({
          data: {
            threadId: thread.id,
            organizationId: input.organizationId,
            ownerUserId: input.ownerUserId,
            accountId: outboundMessage.accountId,
            contactId: outboundMessage.contactId,
            enrollmentId: outboundMessage.enrollmentId,
            mailboxId: outboundMessage.mailboxId,
            provider: 'gmail',
            providerMessageId: input.providerMessageId ?? null,
            replyToMessageId: outboundMessage.id,
            fromEmail: outboundMessage.contact.email,
            fromEmailHash: outboundMessage.contact.emailHash,
            maskedFromEmail: outboundMessage.contact.maskedEmail,
            subject: input.subject,
            snippet: toSnippet(input.bodyText),
            bodyText: input.bodyText,
            receivedAt: input.receivedAt,
            messageType
          } as Prisma.CrmInboxMessageUncheckedCreateInput
        });
        const updatedThread = await tx.crmInboxThread.update({
          where: { id: thread.id },
          data: {
            subject: input.subject,
            status: 'pending',
            lastInboundAt: input.receivedAt,
            unreadCount: { increment: 1 },
            messageCount: { increment: 1 }
          }
        });

        await tx.crmSequenceEnrollment.updateMany({
          where: {
            id: outboundMessage.enrollmentId,
            organizationId: input.organizationId,
            ownerUserId: input.ownerUserId,
            status: { in: ['draft_review_pending', 'ready_to_send', 'sequence_running', 'paused'] }
          },
          data: {
            status: 'replied',
            runVersion: { increment: 1 }
          }
        });
        const isUnsubscribeHint = messageType === 'unsubscribe_hint';
        const isBounce = messageType === 'bounce';
        const [account, contact] = await Promise.all([
          tx.crmAccount.update({
            where: { id: outboundMessage.accountId },
            data: {
              status: isUnsubscribeHint ? 'blocked' : isBounce ? 'manual_review_pending' : 'replied_pending'
            }
          }),
          isUnsubscribeHint || isBounce
            ? tx.crmContact.update({
                where: { id: outboundMessage.contactId },
                data: { emailStatus: isUnsubscribeHint ? 'unsubscribed' : 'unreachable' }
              })
            : Promise.resolve(outboundMessage.contact)
        ]);
        const event = await tx.crmTimelineEvent.create({
          data: {
            organizationId: input.organizationId,
            accountId: outboundMessage.accountId,
            contactId: outboundMessage.contactId,
            ownerUserId: input.ownerUserId,
            eventType: isUnsubscribeHint ? 'customer_unsubscribed' : isBounce ? 'email_bounced' : 'customer_replied',
            title: isUnsubscribeHint ? '客户要求停止联系' : isBounce ? '邮件退信' : '客户回信',
            content: input.subject,
            metadata: {
              enrollmentId: outboundMessage.enrollmentId,
              outboundMessageId: outboundMessage.id,
              inboxThreadId: updatedThread.id,
              inboxMessageId: inboxMessage.id,
              messageType
            }
          }
        });

        return {
          thread: toInboxThreadRecord(updatedThread),
          message: toInboxMessageRecord(inboxMessage),
          account: toAccountRecord(account),
          contact: toContactRecord(contact),
          mailbox: outboundMessage.mailbox ? toMailboxRecord(outboundMessage.mailbox) : null,
          enrollment: outboundMessage.enrollment ? toSequenceEnrollmentRecord(outboundMessage.enrollment) : null,
          event: toTimelineEventRecord(event),
          isDuplicate: false
        };
      });
    } catch (error) {
      if (input.providerMessageId && isPrismaUniqueConflict(error)) {
        const existingMessage = await this.findIngestedCustomerReplyByProviderMessage(input);

        if (existingMessage) return existingMessage;
      }

      throw error;
    }
  }

  /** Reads an already ingested provider message after duplicate delivery or a unique conflict. */
  private async findIngestedCustomerReplyByProviderMessage(
    input: CrmCustomerReplyIngestInput
  ): Promise<CrmCustomerReplyIngestRecord | null> {
    const outboundMessage = await this.prisma.crmMessage.findFirst({
      where: {
        id: input.outboundMessageId,
        organizationId: input.organizationId,
        ownerUserId: input.ownerUserId,
        status: 'sent'
      },
      select: { mailboxId: true }
    });

    if (!outboundMessage) return null;

    const inboxMessage = await this.prisma.crmInboxMessage.findFirst({
      where: {
        organizationId: input.organizationId,
        ownerUserId: input.ownerUserId,
        mailboxId: outboundMessage.mailboxId,
        providerMessageId: input.providerMessageId
      },
      include: {
        thread: true,
        account: true,
        contact: true,
        mailbox: true,
        enrollment: true
      }
    });

    if (!inboxMessage) return null;

    return {
      thread: toInboxThreadRecord(inboxMessage.thread),
      message: toInboxMessageRecord(inboxMessage),
      account: toAccountRecord(inboxMessage.account),
      contact: toContactRecord(inboxMessage.contact),
      mailbox: inboxMessage.mailbox ? toMailboxRecord(inboxMessage.mailbox) : null,
      enrollment: inboxMessage.enrollment ? toSequenceEnrollmentRecord(inboxMessage.enrollment) : null,
      event: null,
      isDuplicate: true
    };
  }

  async listInboxThreads(args: {
    organizationId: string;
    ownerUserId?: string;
    keyword?: string;
    status?: CrmInboxThreadStatus;
    mailboxId?: string;
    skip: number;
    take: number;
  }): Promise<{ records: CrmInboxThreadListRecord[]; total: number }> {
    const where = toInboxThreadListWhere(args);
    const [records, total] = await Promise.all([
      this.prisma.crmInboxThread.findMany({
        where,
        skip: args.skip,
        take: args.take,
        orderBy: { lastInboundAt: 'desc' },
        include: toInboxThreadListInclude()
      }),
      this.prisma.crmInboxThread.count({ where })
    ]);

    return {
      records: records.map(toInboxThreadListRecord),
      total
    };
  }

  async getInboxThread(args: {
    id: string;
    organizationId: string;
    ownerUserId?: string;
  }): Promise<CrmInboxThreadDetailRecord | null> {
    const record = await this.prisma.crmInboxThread.findFirst({
      where: toInboxThreadIdentityWhere(args),
      include: toInboxThreadDetailInclude()
    });

    if (!record) {
      return null;
    }

    const timelineEvents = await this.prisma.crmTimelineEvent.findMany({
      where: {
        organizationId: args.organizationId,
        accountId: record.accountId
      },
      orderBy: { createdAt: 'desc' }
    });

    return toInboxThreadDetailRecord(record, timelineEvents);
  }

  async updateInboxThreadStatus(
    input: CrmInboxThreadStatusUpdateInput
  ): Promise<CrmInboxThreadStatusUpdateRecord | null> {
    return this.prisma.$transaction(async tx => {
      const data: Prisma.CrmInboxThreadUpdateManyMutationInput = {
        status: input.toStatus,
        ...(input.toStatus === 'pending' ? {} : { unreadCount: 0 })
      };
      const threads = await tx.crmInboxThread.updateManyAndReturn({
        where: {
          id: input.id,
          organizationId: input.organizationId,
          ownerUserId: input.ownerUserId,
          ...(input.fromStatus ? { status: input.fromStatus } : {})
        },
        data,
        limit: 1
      });
      const thread = threads[0];

      if (!thread) {
        return null;
      }

      const account = input.accountStatus
        ? await tx.crmAccount.update({
            where: { id: thread.accountId },
            data: { status: input.accountStatus }
          })
        : await tx.crmAccount.findUnique({ where: { id: thread.accountId } });

      if (!account) {
        return null;
      }

      const event = await tx.crmTimelineEvent.create({
        data: {
          organizationId: input.organizationId,
          accountId: thread.accountId,
          contactId: thread.contactId,
          ownerUserId: input.ownerUserId,
          eventType: 'inbox_status_changed',
          title: '收件箱处理状态变更',
          content: thread.subject,
          metadata: {
            threadId: thread.id,
            fromStatus: input.fromStatus ?? null,
            toStatus: input.toStatus
          }
        }
      });

      return {
        thread: toInboxThreadRecord(thread),
        account: toAccountRecord(account),
        event: toTimelineEventRecord(event)
      };
    });
  }

  async replyInboxThread(input: CrmInboxThreadReplyInput): Promise<CrmInboxThreadReplyRecord | null> {
    return this.prisma.$transaction(async tx => {
      const record = await tx.crmInboxThread.findFirst({
        where: {
          id: input.id,
          organizationId: input.organizationId,
          ownerUserId: input.ownerUserId
        },
        include: {
          account: true,
          contact: true,
          mailbox: true,
          enrollment: true,
          messages: {
            orderBy: { receivedAt: 'desc' },
            take: 1
          }
        }
      });

      if (!record?.mailbox || record.mailbox.status !== 'active') {
        return null;
      }

      const inboxMessage = await tx.crmInboxMessage.create({
        data: {
          threadId: record.id,
          organizationId: input.organizationId,
          ownerUserId: input.ownerUserId,
          accountId: record.accountId,
          contactId: record.contactId,
          enrollmentId: record.enrollmentId,
          mailboxId: record.mailboxId,
          provider: record.provider,
          providerMessageId: input.providerMessageId ?? null,
          replyToMessageId: record.messages[0]?.id ?? null,
          fromEmail: record.mailbox.emailAddress,
          fromEmailHash: record.mailbox.emailHash,
          maskedFromEmail: record.mailbox.maskedEmail,
          subject: input.subject,
          snippet: toSnippet(input.bodyText),
          bodyText: input.bodyText,
          receivedAt: input.sentAt,
          messageType: 'customer_reply'
        } as Prisma.CrmInboxMessageUncheckedCreateInput
      });
      const [thread, account, event] = await Promise.all([
        tx.crmInboxThread.update({
          where: { id: record.id },
          data: {
            status: 'handled',
            unreadCount: 0,
            messageCount: { increment: 1 }
          }
        }),
        tx.crmAccount.update({
          where: { id: record.accountId },
          data: { status: 'followed_up' }
        }),
        tx.crmTimelineEvent.create({
          data: {
            organizationId: input.organizationId,
            accountId: record.accountId,
            contactId: record.contactId,
            ownerUserId: input.ownerUserId,
            eventType: 'inbox_replied',
            title: '已在系统内回复',
            content: input.subject,
            metadata: {
              threadId: record.id,
              inboxMessageId: inboxMessage.id,
              providerMessageId: input.providerMessageId ?? null
            }
          }
        })
      ]);

      return {
        thread: toInboxThreadRecord(thread),
        message: toInboxMessageRecord(inboxMessage),
        account: toAccountRecord(account),
        contact: toContactRecord(record.contact),
        mailbox: toMailboxRecord(record.mailbox),
        enrollment: record.enrollment ? toSequenceEnrollmentRecord(record.enrollment) : null,
        event: toTimelineEventRecord(event)
      };
    });
  }
}

/** Builds the scoped account identity filter used before detail reads and writes. */
function toAccountIdentityWhere(args: {
  id: string;
  organizationId: string;
  ownerUserId?: string;
}): Prisma.CrmAccountWhereInput {
  return {
    id: args.id,
    organizationId: args.organizationId,
    ...(args.ownerUserId ? { ownerUserId: args.ownerUserId } : {})
  };
}

/** Builds the scoped contact identity filter used before contact writes. */
function toContactIdentityWhere(args: {
  id: string;
  organizationId: string;
  ownerUserId?: string;
}): Prisma.CrmContactWhereInput {
  return {
    id: args.id,
    organizationId: args.organizationId,
    ...(args.ownerUserId ? { ownerUserId: args.ownerUserId } : {})
  };
}

/** Builds the scoped mailbox identity filter used before mailbox writes. */
function toMailboxIdentityWhere(args: {
  id: string;
  organizationId: string;
  ownerUserId?: string;
}): Prisma.CrmMailboxWhereInput {
  return {
    id: args.id,
    organizationId: args.organizationId,
    ...(args.ownerUserId ? { ownerUserId: args.ownerUserId } : {})
  };
}

/** Builds the scoped product line identity filter used before organization-level writes. */
function toProductLineIdentityWhere(args: { id: string; organizationId: string }): Prisma.CrmProductLineWhereInput {
  return {
    id: args.id,
    organizationId: args.organizationId
  };
}

/** Builds the scoped sequence identity filter used before sequence reads and writes. */
function toSequenceEnrollmentIdentityWhere(args: {
  id: string;
  organizationId: string;
  ownerUserId?: string;
}): Prisma.CrmSequenceEnrollmentWhereInput {
  return {
    id: args.id,
    organizationId: args.organizationId,
    ...(args.ownerUserId ? { ownerUserId: args.ownerUserId } : {})
  };
}

/** Builds the scoped message identity filter used before draft reads and writes. */
function toMessageIdentityWhere(args: {
  id: string;
  organizationId: string;
  ownerUserId?: string;
}): Prisma.CrmMessageWhereInput {
  return {
    id: args.id,
    organizationId: args.organizationId,
    ...(args.ownerUserId ? { ownerUserId: args.ownerUserId } : {})
  };
}

/** Builds the scoped inbox thread identity filter used before inbox detail and writes. */
function toInboxThreadIdentityWhere(args: {
  id: string;
  organizationId: string;
  ownerUserId?: string;
}): Prisma.CrmInboxThreadWhereInput {
  return {
    id: args.id,
    organizationId: args.organizationId,
    ...(args.ownerUserId ? { ownerUserId: args.ownerUserId } : {})
  };
}

/** Builds the Prisma account list scope and optional UI filters. */
function toAccountListWhere(args: {
  organizationId: string;
  ownerUserId?: string;
  keyword?: string;
  status?: CrmAccountStatus;
}): Prisma.CrmAccountWhereInput {
  const keywordFilter = args.keyword ? toAccountKeywordFilter(args.keyword) : undefined;

  return {
    organizationId: args.organizationId,
    ...(args.ownerUserId ? { ownerUserId: args.ownerUserId } : {}),
    ...(args.status ? { status: args.status } : {}),
    ...(keywordFilter ? { OR: keywordFilter } : {})
  };
}

/** Builds the Prisma mailbox list scope and optional UI filters. */
function toMailboxListWhere(args: {
  organizationId: string;
  ownerUserId?: string;
  keyword?: string;
  status?: CrmMailboxStatus;
}): Prisma.CrmMailboxWhereInput {
  const keywordFilter = args.keyword ? toMailboxKeywordFilter(args.keyword) : undefined;

  return {
    organizationId: args.organizationId,
    ...(args.ownerUserId ? { ownerUserId: args.ownerUserId } : {}),
    ...(args.status ? { status: args.status } : {}),
    ...(keywordFilter ? { OR: keywordFilter } : {})
  };
}

/** Builds the Prisma product line list scope and optional UI filters. */
function toProductLineListWhere(args: {
  organizationId: string;
  keyword?: string;
  status?: CrmProductLineStatus;
}): Prisma.CrmProductLineWhereInput {
  const keywordFilter = args.keyword ? toProductLineKeywordFilter(args.keyword) : undefined;

  return {
    organizationId: args.organizationId,
    ...(args.status ? { status: args.status } : {}),
    ...(keywordFilter ? { OR: keywordFilter } : {})
  };
}

/** Builds the sequence review list scope and optional UI filters. */
function toSequenceEnrollmentListWhere(args: {
  organizationId: string;
  ownerUserId?: string;
  keyword?: string;
  status?: CrmSequenceEnrollmentStatus;
}): Prisma.CrmSequenceEnrollmentWhereInput {
  const keywordFilter = args.keyword ? toSequenceEnrollmentKeywordFilter(args.keyword) : undefined;

  return {
    organizationId: args.organizationId,
    ...(args.ownerUserId ? { ownerUserId: args.ownerUserId } : {}),
    ...(args.status ? { status: args.status } : {}),
    ...(keywordFilter ? { OR: keywordFilter } : {})
  };
}

/** Builds the inbox thread list scope and optional UI filters. */
function toInboxThreadListWhere(args: {
  organizationId: string;
  ownerUserId?: string;
  keyword?: string;
  status?: CrmInboxThreadStatus;
  mailboxId?: string;
}): Prisma.CrmInboxThreadWhereInput {
  const keywordFilter = args.keyword ? toInboxThreadKeywordFilter(args.keyword) : undefined;

  return {
    organizationId: args.organizationId,
    ...(args.ownerUserId ? { ownerUserId: args.ownerUserId } : {}),
    ...(args.status ? { status: args.status } : {}),
    ...(args.mailboxId ? { mailboxId: args.mailboxId } : {}),
    ...(keywordFilter ? { OR: keywordFilter } : {})
  };
}

function toAccountKeywordFilter(keyword: string): Prisma.CrmAccountWhereInput[] {
  return ['name', 'domain', 'websiteUrl', 'country', 'customerType'].map(field => ({
    [field]: {
      contains: keyword,
      mode: 'insensitive'
    }
  }));
}

function toMailboxKeywordFilter(keyword: string): Prisma.CrmMailboxWhereInput[] {
  return ['emailAddress', 'maskedEmail', 'ownerUserName'].map(field => ({
    [field]: {
      contains: keyword,
      mode: 'insensitive'
    }
  }));
}

function toProductLineKeywordFilter(keyword: string): Prisma.CrmProductLineWhereInput[] {
  return [
    'name',
    'targetCustomerType',
    'coreSellingPoints',
    'moq',
    'leadTime',
    'paymentTerms',
    'certifications',
    'commonModelsText'
  ].map(field => ({
    [field]: {
      contains: keyword,
      mode: 'insensitive'
    }
  }));
}

function toSequenceEnrollmentKeywordFilter(keyword: string): Prisma.CrmSequenceEnrollmentWhereInput[] {
  return [
    { name: { contains: keyword, mode: 'insensitive' } },
    { account: { name: { contains: keyword, mode: 'insensitive' } } },
    { account: { domain: { contains: keyword, mode: 'insensitive' } } },
    { contact: { fullName: { contains: keyword, mode: 'insensitive' } } },
    { contact: { title: { contains: keyword, mode: 'insensitive' } } },
    { contact: { maskedEmail: { contains: keyword, mode: 'insensitive' } } }
  ];
}

function toInboxThreadKeywordFilter(keyword: string): Prisma.CrmInboxThreadWhereInput[] {
  return [
    { subject: { contains: keyword, mode: 'insensitive' } },
    { account: { name: { contains: keyword, mode: 'insensitive' } } },
    { account: { domain: { contains: keyword, mode: 'insensitive' } } },
    { contact: { fullName: { contains: keyword, mode: 'insensitive' } } },
    { contact: { title: { contains: keyword, mode: 'insensitive' } } },
    { contact: { maskedEmail: { contains: keyword, mode: 'insensitive' } } }
  ];
}

function toSequenceReviewInclude() {
  return {
    account: true,
    contact: true,
    productLine: true,
    mailbox: true,
    messages: {
      where: { stepIndex: 1 },
      take: 1,
      orderBy: { createdAt: 'asc' as const }
    }
  };
}

function toInboxThreadListInclude() {
  return {
    account: true,
    contact: true,
    mailbox: true,
    enrollment: true,
    messages: {
      take: 1,
      orderBy: { receivedAt: 'desc' as const }
    }
  };
}

function toInboxThreadDetailInclude() {
  return {
    account: true,
    contact: true,
    mailbox: true,
    enrollment: true,
    messages: {
      orderBy: { receivedAt: 'asc' as const }
    }
  };
}

function toAccountRecord(record: CrmAccountModel): CrmAccountRecord {
  return {
    ...record,
    status: record.status as CrmAccountRecord['status']
  };
}

function toContactRecord(record: CrmContactModel): CrmContactRecord {
  return {
    ...record,
    emailStatus: record.emailStatus as CrmContactRecord['emailStatus']
  };
}

function toTimelineEventRecord(record: CrmTimelineEventModel): CrmTimelineEventRecord {
  return record;
}

function toMailboxRecord(record: CrmMailboxModel): CrmMailboxRecord {
  return {
    ...record,
    provider: record.provider as CrmMailboxRecord['provider'],
    status: record.status as CrmMailboxRecord['status'],
    warmupStage: record.warmupStage as CrmMailboxRecord['warmupStage']
  };
}

function toProductLineRecord(record: CrmProductLineModel): CrmProductLineRecord {
  return {
    ...record,
    status: record.status as CrmProductLineRecord['status']
  };
}

function toSequenceEnrollmentRecord(record: CrmSequenceEnrollmentModel): CrmSequenceEnrollmentRecord {
  return {
    ...record,
    status: record.status as CrmSequenceEnrollmentRecord['status']
  };
}

function toMessageRecord(record: CrmMessageModel): CrmMessageRecord {
  const message = record as CrmMessageModel & {
    providerMessageId?: string | null;
    providerThreadId?: string | null;
  };

  return {
    ...message,
    threadMode: message.threadMode as CrmMessageRecord['threadMode'],
    status: message.status as CrmMessageRecord['status'],
    providerMessageId: message.providerMessageId ?? null,
    providerThreadId: message.providerThreadId ?? null
  };
}

function toInboxThreadRecord(record: CrmInboxThreadModel): CrmInboxThreadRecord {
  return {
    ...record,
    provider: record.provider as CrmInboxThreadRecord['provider'],
    status: record.status as CrmInboxThreadRecord['status']
  };
}

function toInboxMessageRecord(record: CrmInboxMessageModel): CrmInboxMessageRecord {
  return {
    ...record,
    provider: record.provider as CrmInboxMessageRecord['provider'],
    messageType: record.messageType as CrmInboxMessageRecord['messageType']
  };
}

function toSequenceReviewRecord(
  record: CrmSequenceEnrollmentModel & {
    account: CrmAccountModel;
    contact: CrmContactModel;
    productLine: CrmProductLineModel | null;
    mailbox: CrmMailboxModel | null;
    messages: CrmMessageModel[];
  }
): CrmSequenceReviewRecord {
  return {
    enrollment: toSequenceEnrollmentRecord(record),
    account: toAccountRecord(record.account),
    contact: toContactRecord(record.contact),
    productLine: record.productLine ? toProductLineRecord(record.productLine) : null,
    mailbox: record.mailbox ? toMailboxRecord(record.mailbox) : null,
    firstMessage: record.messages[0] ? toMessageRecord(record.messages[0]) : null
  };
}

function toInboxThreadListRecord(
  record: CrmInboxThreadModel & {
    account: CrmAccountModel;
    contact: CrmContactModel;
    mailbox: CrmMailboxModel | null;
    enrollment: CrmSequenceEnrollmentModel | null;
    messages: CrmInboxMessageModel[];
  }
): CrmInboxThreadListRecord {
  return {
    thread: toInboxThreadRecord(record),
    account: toAccountRecord(record.account),
    contact: toContactRecord(record.contact),
    mailbox: record.mailbox ? toMailboxRecord(record.mailbox) : null,
    enrollment: record.enrollment ? toSequenceEnrollmentRecord(record.enrollment) : null,
    lastMessage: record.messages[0] ? toInboxMessageRecord(record.messages[0]) : null
  };
}

function toInboxThreadDetailRecord(
  record: CrmInboxThreadModel & {
    account: CrmAccountModel;
    contact: CrmContactModel;
    mailbox: CrmMailboxModel | null;
    enrollment: CrmSequenceEnrollmentModel | null;
    messages: CrmInboxMessageModel[];
  },
  timelineEvents: CrmTimelineEventModel[]
): CrmInboxThreadDetailRecord {
  return {
    ...toInboxThreadListRecord(record),
    messages: record.messages.map(toInboxMessageRecord),
    timelineEvents: timelineEvents.map(toTimelineEventRecord)
  };
}

type MailboxSendQuotaBucketType = 'daily' | 'hourly';

interface MailboxSendQuotaInput {
  organizationId: string;
  mailboxId: string;
  dailyLimit: number;
  hourlyLimit: number;
  at: Date;
}

interface MailboxSendQuotaBucketInput {
  organizationId: string;
  mailboxId: string;
  bucketType: MailboxSendQuotaBucketType;
  bucketKey: string;
  limit: number;
}

async function reserveMailboxSendQuota(tx: Prisma.TransactionClient, input: MailboxSendQuotaInput) {
  const buckets = toMailboxSendQuotaBuckets(input.at);
  const dailyReserved = await reserveMailboxSendQuotaBucket(tx, {
    organizationId: input.organizationId,
    mailboxId: input.mailboxId,
    bucketType: 'daily',
    bucketKey: buckets.daily,
    limit: input.dailyLimit
  });

  if (!dailyReserved) {
    return false;
  }

  const hourlyReserved = await reserveMailboxSendQuotaBucket(tx, {
    organizationId: input.organizationId,
    mailboxId: input.mailboxId,
    bucketType: 'hourly',
    bucketKey: buckets.hourly,
    limit: input.hourlyLimit
  });

  if (!hourlyReserved) {
    await releaseMailboxSendQuotaBucket(tx, {
      organizationId: input.organizationId,
      mailboxId: input.mailboxId,
      bucketType: 'daily',
      bucketKey: buckets.daily,
      limit: input.dailyLimit
    });
    return false;
  }

  return true;
}

async function reserveMailboxSendQuotaBucket(tx: Prisma.TransactionClient, input: MailboxSendQuotaBucketInput) {
  if (input.limit <= 0) {
    return false;
  }

  const updated = await tx.crmMailboxSendUsage.updateMany({
    where: {
      mailboxId: input.mailboxId,
      bucketType: input.bucketType,
      bucketKey: input.bucketKey,
      usedCount: { lt: input.limit }
    },
    data: {
      usedCount: { increment: 1 }
    }
  });

  if (updated.count > 0) {
    return true;
  }

  const existing = await tx.crmMailboxSendUsage.findUnique({
    where: {
      mailboxId_bucketType_bucketKey: {
        mailboxId: input.mailboxId,
        bucketType: input.bucketType,
        bucketKey: input.bucketKey
      }
    }
  });

  if (existing) {
    return false;
  }

  try {
    await tx.crmMailboxSendUsage.create({
      data: {
        organizationId: input.organizationId,
        mailboxId: input.mailboxId,
        bucketType: input.bucketType,
        bucketKey: input.bucketKey,
        usedCount: 1
      }
    });
    return true;
  } catch (error) {
    if (!isPrismaUniqueConflict(error)) {
      throw error;
    }

    // Another worker created the bucket first; retry the guarded increment.
    const retryUpdated = await tx.crmMailboxSendUsage.updateMany({
      where: {
        mailboxId: input.mailboxId,
        bucketType: input.bucketType,
        bucketKey: input.bucketKey,
        usedCount: { lt: input.limit }
      },
      data: {
        usedCount: { increment: 1 }
      }
    });

    return retryUpdated.count > 0;
  }
}

async function releaseMailboxSendQuotaBucket(tx: Prisma.TransactionClient, input: MailboxSendQuotaBucketInput) {
  await tx.crmMailboxSendUsage.updateMany({
    where: {
      mailboxId: input.mailboxId,
      bucketType: input.bucketType,
      bucketKey: input.bucketKey,
      usedCount: { gt: 0 }
    },
    data: {
      usedCount: { decrement: 1 }
    }
  });
}

function toMailboxSendQuotaBuckets(at: Date) {
  const iso = at.toISOString();

  return {
    daily: iso.slice(0, 10),
    hourly: iso.slice(0, 13)
  };
}

function toSnippet(bodyText: string) {
  const normalized = bodyText.replace(/\s+/g, ' ').trim();
  return normalized.length > 160 ? `${normalized.slice(0, 157)}...` : normalized;
}

function isPrismaUniqueConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}
