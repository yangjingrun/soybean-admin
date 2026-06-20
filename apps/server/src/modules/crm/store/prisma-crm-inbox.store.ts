import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type {
  CrmCustomerReplyIngestInput,
  CrmCustomerReplyIngestRecord,
  CrmInboxReplyDraftSaveInput,
  CrmInboxThreadDetailRecord,
  CrmInboxThreadGmailStateSyncInput,
  CrmInboxThreadListRecord,
  CrmInboxThreadReplyInput,
  CrmInboxThreadReplyRecord,
  CrmInboxThreadStatus,
  CrmInboxThreadStatusUpdateInput,
  CrmInboxThreadStatusUpdateRecord,
  CrmInboxUnsubscribeConfirmInput,
  CrmInboxUnsubscribeConfirmRecord
} from '../crm.types';
import {
  isPrismaUniqueConflict,
  resolveGmailThreadStateUpdate,
  toAccountRecord,
  toContactRecord,
  toInboxMessageRecord,
  toInboxThreadDetailInclude,
  toInboxThreadDetailRecord,
  toInboxThreadIdentityWhere,
  toInboxThreadListInclude,
  toInboxThreadListRecord,
  toInboxThreadListWhere,
  toInboxThreadRecord,
  toMailboxRecord,
  toNullableJsonInput,
  toSequenceEnrollmentRecord,
  toSnippet,
  toTimelineEventRecord
} from './prisma-crm-store.helpers';

export class PrismaCrmInboxStore {
  constructor(private readonly prisma: PrismaService) {}

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

        // 客户回信后，同公司当前开发序列统一停发，避免其他联系人继续跟进。
        await tx.crmSequenceEnrollment.updateMany({
          where: {
            organizationId: input.organizationId,
            ownerUserId: input.ownerUserId,
            accountId: outboundMessage.accountId,
            status: {
              in: ['draft_review_pending', 'ready_to_send', 'sequence_running', 'paused']
            }
          },
          data: {
            status: 'replied',
            runVersion: { increment: 1 }
          }
        });
        await tx.crmMessage.updateMany({
          where: {
            organizationId: input.organizationId,
            ownerUserId: input.ownerUserId,
            accountId: outboundMessage.accountId,
            status: 'queued'
          },
          data: {
            status: 'skipped',
            bullJobId: null
          }
        });
        const isUnsubscribeHint = messageType === 'unsubscribe_hint';
        const isBounce = messageType === 'bounce';
        if (isUnsubscribeHint) {
          await tx.crmBlacklist.upsert({
            where: {
              organizationId_emailHash: {
                organizationId: input.organizationId,
                emailHash: outboundMessage.contact.emailHash
              }
            },
            create: {
              organizationId: input.organizationId,
              emailHash: outboundMessage.contact.emailHash,
              maskedEmail: outboundMessage.contact.maskedEmail,
              reason: 'unsubscribe',
              sourceAccountId: outboundMessage.accountId,
              sourceContactId: outboundMessage.contactId,
              sourceMessageId: inboxMessage.id,
              createdById: input.ownerUserId,
              createdByName: outboundMessage.mailbox?.ownerUserName ?? null
            },
            update: {
              maskedEmail: outboundMessage.contact.maskedEmail,
              reason: 'unsubscribe',
              sourceAccountId: outboundMessage.accountId,
              sourceContactId: outboundMessage.contactId,
              sourceMessageId: inboxMessage.id,
              createdById: input.ownerUserId,
              createdByName: outboundMessage.mailbox?.ownerUserName ?? null
            }
          });
        }
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
                data: {
                  emailStatus: isUnsubscribeHint ? 'unsubscribed' : 'unreachable'
                }
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

  async saveInboxThreadReplyDraft(input: CrmInboxReplyDraftSaveInput): Promise<CrmInboxThreadDetailRecord | null> {
    return this.prisma.$transaction(async tx => {
      const threads = await tx.crmInboxThread.updateManyAndReturn({
        where: {
          id: input.id,
          organizationId: input.organizationId,
          ownerUserId: input.ownerUserId
        },
        data: {
          replyDraftTopic: input.topic,
          replyDraftBodyText: input.bodyText,
          replyDraftMetadata: toNullableJsonInput(input.metadata ?? null),
          replyDraftUpdatedAt: input.updatedAt,
          replyDraftUpdatedById: input.updatedById,
          replyDraftUpdatedByName: input.updatedByName ?? null
        },
        limit: 1
      });
      const thread = threads[0];

      if (!thread) {
        return null;
      }

      const record = await tx.crmInboxThread.findFirst({
        where: {
          id: thread.id,
          organizationId: input.organizationId,
          ownerUserId: input.ownerUserId
        },
        include: toInboxThreadDetailInclude()
      });

      if (!record) {
        return null;
      }

      const timelineEvents = await tx.crmTimelineEvent.findMany({
        where: {
          organizationId: input.organizationId,
          accountId: record.accountId
        },
        orderBy: { createdAt: 'desc' }
      });

      return toInboxThreadDetailRecord(record, timelineEvents);
    });
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

  async syncInboxThreadGmailState(
    input: CrmInboxThreadGmailStateSyncInput
  ): Promise<CrmInboxThreadStatusUpdateRecord | null> {
    return this.prisma.$transaction(async tx => {
      const thread = await tx.crmInboxThread.findFirst({
        where: {
          organizationId: input.organizationId,
          ownerUserId: input.ownerUserId,
          mailboxId: input.mailboxId,
          providerThreadId: input.providerThreadId
        }
      });

      if (!thread) {
        return null;
      }

      const threadRecord = toInboxThreadRecord(thread);
      const update = resolveGmailThreadStateUpdate(threadRecord, input);
      if (!update) {
        return null;
      }

      const account = await tx.crmAccount.findUnique({
        where: { id: thread.accountId }
      });
      if (!account) {
        return null;
      }

      const [updatedThread, event] = await Promise.all([
        tx.crmInboxThread.update({
          where: { id: thread.id },
          data: update.data
        }),
        tx.crmTimelineEvent.create({
          data: {
            organizationId: input.organizationId,
            accountId: thread.accountId,
            contactId: thread.contactId,
            ownerUserId: input.ownerUserId,
            eventType: update.eventType,
            title: update.title,
            content: thread.subject,
            metadata: {
              providerMessageId: input.providerMessageId,
              providerThreadId: input.providerThreadId,
              changeType: input.changeType,
              labelIds: input.labelIds,
              fromStatus: thread.status,
              toStatus: update.nextStatus
            }
          }
        })
      ]);

      return {
        thread: toInboxThreadRecord(updatedThread),
        account: toAccountRecord(account),
        event: toTimelineEventRecord(event)
      };
    });
  }

  async confirmInboxMessageUnsubscribe(
    input: CrmInboxUnsubscribeConfirmInput
  ): Promise<CrmInboxUnsubscribeConfirmRecord | null> {
    return this.prisma.$transaction(async tx => {
      const inboxMessage = await tx.crmInboxMessage.findFirst({
        where: {
          id: input.messageId,
          organizationId: input.organizationId,
          ownerUserId: input.ownerUserId,
          messageType: {
            in: ['unsubscribe_hint', 'unsubscribe_review_pending']
          }
        },
        include: {
          thread: true,
          account: true,
          contact: true,
          mailbox: true,
          enrollment: true
        }
      });

      if (!inboxMessage) {
        return null;
      }

      const message =
        inboxMessage.messageType === 'unsubscribe_hint'
          ? inboxMessage
          : await tx.crmInboxMessage.update({
              where: { id: inboxMessage.id },
              data: { messageType: 'unsubscribe_hint' },
              include: {
                thread: true,
                account: true,
                contact: true,
                mailbox: true,
                enrollment: true
              }
            });

      await tx.crmBlacklist.upsert({
        where: {
          organizationId_emailHash: {
            organizationId: input.organizationId,
            emailHash: inboxMessage.contact.emailHash
          }
        },
        create: {
          organizationId: input.organizationId,
          emailHash: inboxMessage.contact.emailHash,
          maskedEmail: inboxMessage.contact.maskedEmail,
          reason: 'unsubscribe',
          sourceAccountId: inboxMessage.accountId,
          sourceContactId: inboxMessage.contactId,
          sourceMessageId: inboxMessage.id,
          createdById: input.confirmedById,
          createdByName: input.confirmedByName ?? null
        },
        update: {
          maskedEmail: inboxMessage.contact.maskedEmail,
          reason: 'unsubscribe',
          sourceAccountId: inboxMessage.accountId,
          sourceContactId: inboxMessage.contactId,
          sourceMessageId: inboxMessage.id,
          createdById: input.confirmedById,
          createdByName: input.confirmedByName ?? null
        }
      });

      await Promise.all([
        tx.crmSequenceEnrollment.updateMany({
          where: {
            organizationId: input.organizationId,
            ownerUserId: input.ownerUserId,
            accountId: inboxMessage.accountId,
            status: {
              in: ['draft_review_pending', 'ready_to_send', 'sequence_running', 'paused']
            }
          },
          data: {
            status: 'replied',
            runVersion: { increment: 1 }
          }
        }),
        tx.crmMessage.updateMany({
          where: {
            organizationId: input.organizationId,
            ownerUserId: input.ownerUserId,
            accountId: inboxMessage.accountId,
            status: 'queued'
          },
          data: {
            status: 'skipped',
            bullJobId: null
          }
        })
      ]);

      const [account, contact, enrollment, event] = await Promise.all([
        tx.crmAccount.update({
          where: { id: inboxMessage.accountId },
          data: { status: 'blocked' }
        }),
        tx.crmContact.update({
          where: { id: inboxMessage.contactId },
          data: { emailStatus: 'unsubscribed' }
        }),
        inboxMessage.enrollmentId
          ? tx.crmSequenceEnrollment.findUnique({
              where: { id: inboxMessage.enrollmentId }
            })
          : null,
        tx.crmTimelineEvent.create({
          data: {
            organizationId: input.organizationId,
            accountId: inboxMessage.accountId,
            contactId: inboxMessage.contactId,
            ownerUserId: input.ownerUserId,
            eventType: 'customer_unsubscribed',
            title: '确认客户退订',
            content: inboxMessage.subject,
            metadata: {
              inboxThreadId: inboxMessage.threadId,
              inboxMessageId: inboxMessage.id,
              confirmedAt: input.confirmedAt.toISOString(),
              confirmedById: input.confirmedById
            }
          }
        })
      ]);

      return {
        thread: toInboxThreadRecord(message.thread),
        message: toInboxMessageRecord(message),
        account: toAccountRecord(account),
        contact: toContactRecord(contact),
        mailbox: message.mailbox ? toMailboxRecord(message.mailbox) : null,
        enrollment: enrollment ? toSequenceEnrollmentRecord(enrollment) : null,
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
