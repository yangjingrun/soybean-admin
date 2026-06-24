import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  isPrismaUniqueConflict,
  toAccountIdentityWhere,
  toAccountListWhere,
  toAccountRecord,
  toArchivedFingerprintRecord,
  toContactIdentityWhere,
  toContactRecord,
  toEmailVerificationCacheRecord,
  toLeadEnrichmentHistoryRecord,
  toTimelineEventRecord
} from './prisma-crm-store.helpers';
import type {
  CrmAccountCreateInput,
  CrmAccountListRecord,
  CrmAccountStatus,
  CrmAccountUpdateInput,
  CrmArchiveSlimInput,
  CrmArchiveSlimmingListInput,
  CrmArchivedFingerprintLookupInput,
  CrmArchivedFingerprintUpsertInput,
  CrmContactCreateInput,
  CrmContactRecord,
  CrmContactUpdateInput,
  CrmEmailStatus,
  CrmEmailVerificationCacheUpsertInput,
  CrmLeadEnrichmentHistoryLookupInput,
  CrmLeadEnrichmentHistoryUpsertInput,
  CrmLeadImportPrecheckInput,
  CrmTimelineEventCreateInput
} from '../crm.types';
import type { CrmAccountRepository } from '../accounts/crm-account.repository';

type PrismaAccountListRecord = Prisma.CrmAccountGetPayload<{
  include: {
    _count: {
      select: {
        contacts: true;
      };
    };
    contacts: true;
  };
}>;

type ContactEmailProgress = Pick<
  CrmContactRecord,
  | 'emailProgressStatus'
  | 'emailProgressLabel'
  | 'emailProgressAt'
  | 'emailProgressMessageId'
  | 'emailProgressStepIndex'
  | 'emailProgressTotalSteps'
>;

type ContactProgressMessageRow = {
  id: string;
  contactId: string;
  status: string;
  stepIndex: number;
  scheduledAt: Date | null;
  sentAt: Date | null;
  updatedAt: Date;
  enrollment: {
    totalSteps: number;
  } | null;
};

type ContactProgressThreadRow = {
  contactId: string;
  lastInboundAt: Date;
};

@Injectable()
export class PrismaCrmAccountStore implements CrmAccountRepository {
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

  async findAccountsForLeadImportPrecheck(
    input: CrmLeadImportPrecheckInput & { organizationId: string; ownerUserId: string }
  ) {
    const domains = toUniqueValues(input.domains);
    const normalizedNames = toUniqueValues(input.normalizedNames);
    const filters: Prisma.CrmAccountWhereInput[] = [
      ...(domains.length ? [{ domain: { in: domains } }] : []),
      ...(normalizedNames.length ? [{ normalizedName: { in: normalizedNames } }] : [])
    ];

    if (filters.length === 0) {
      return [];
    }

    const records = await this.prisma.crmAccount.findMany({
      where: {
        organizationId: input.organizationId,
        ownerUserId: input.ownerUserId,
        OR: filters
      }
    });

    return records.map(toAccountRecord);
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

  async listAccountsForArchiveSlimming(input: CrmArchiveSlimmingListInput) {
    const records = await this.prisma.crmAccount.findMany({
      where: {
        status: 'archived',
        archiveSlimmedAt: null,
        archivedAt: {
          lte: input.archivedBefore
        }
      },
      orderBy: { archivedAt: 'asc' },
      take: input.take
    });

    return records.map(toAccountRecord);
  }

  async slimArchivedAccount(input: CrmArchiveSlimInput) {
    const records = await this.prisma.crmAccount.updateManyAndReturn({
      where: {
        id: input.id,
        organizationId: input.organizationId,
        status: 'archived',
        archiveSlimmedAt: null,
        archivedAt: {
          lte: input.archivedBefore
        }
      },
      data: {
        archiveSlimmedAt: input.slimmedAt,
        customerType: null,
        websiteUrl: null
      },
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

  async deleteContact(id: string) {
    const records = await this.prisma.crmContact.deleteManyAndReturn({
      where: { id },
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

  findEmailVerificationCache(args: { emailHash: string }) {
    return this.prisma.crmEmailVerificationCache
      .findUnique({
        where: {
          emailHash: args.emailHash
        }
      })
      .then(record => (record ? toEmailVerificationCacheRecord(record) : null));
  }

  async upsertEmailVerificationCache(input: CrmEmailVerificationCacheUpsertInput) {
    const record = await this.prisma.crmEmailVerificationCache.upsert({
      where: {
        emailHash: input.emailHash
      },
      create: input,
      update: {
        maskedEmail: input.maskedEmail,
        domain: input.domain,
        status: input.status,
        reason: input.reason,
        verifiedAt: input.verifiedAt,
        expiresAt: input.expiresAt,
        checkedById: input.checkedById,
        checkedByName: input.checkedByName
      }
    });

    return toEmailVerificationCacheRecord(record);
  }

  async findArchivedFingerprints(input: CrmArchivedFingerprintLookupInput) {
    if (input.fingerprints.length === 0) {
      return [];
    }

    const records = await this.prisma.crmArchivedFingerprint.findMany({
      where: {
        organizationId: input.organizationId,
        OR: input.fingerprints.map(fingerprint => ({
          fingerprintType: fingerprint.fingerprintType,
          fingerprintValue: fingerprint.fingerprintValue
        }))
      },
      orderBy: {
        archivedAt: 'desc'
      }
    });

    return records.map(toArchivedFingerprintRecord);
  }

  async upsertArchivedFingerprint(input: CrmArchivedFingerprintUpsertInput) {
    const record = await this.prisma.crmArchivedFingerprint.upsert({
      where: {
        organizationId_fingerprintType_fingerprintValue: {
          organizationId: input.organizationId,
          fingerprintType: input.fingerprintType,
          fingerprintValue: input.fingerprintValue
        }
      },
      create: input,
      update: {
        maskedValue: input.maskedValue ?? null,
        accountName: input.accountName ?? null,
        normalizedName: input.normalizedName ?? null,
        country: input.country ?? null,
        sourceAccountId: input.sourceAccountId ?? null,
        sourceContactId: input.sourceContactId ?? null,
        sourceTaskId: input.sourceTaskId ?? null,
        archiveReason: input.archiveReason ?? null,
        archivedAt: input.archivedAt
      }
    });

    return toArchivedFingerprintRecord(record);
  }

  async findLeadEnrichmentHistories(input: CrmLeadEnrichmentHistoryLookupInput) {
    const identityValues = toUniqueValues(input.identityValues);

    if (identityValues.length === 0) {
      return [];
    }

    const records = await this.prisma.crmLeadEnrichmentHistory.findMany({
      where: {
        organizationId: input.organizationId,
        ownerUserId: input.ownerUserId,
        provider: input.provider,
        identityType: input.identityType,
        identityValue: {
          in: identityValues
        }
      }
    });

    return records.map(toLeadEnrichmentHistoryRecord);
  }

  async upsertLeadEnrichmentHistory(input: CrmLeadEnrichmentHistoryUpsertInput) {
    const record = await this.prisma.crmLeadEnrichmentHistory.upsert({
      where: {
        organizationId_ownerUserId_provider_identityType_identityValue: {
          organizationId: input.organizationId,
          ownerUserId: input.ownerUserId,
          provider: input.provider,
          identityType: input.identityType,
          identityValue: input.identityValue
        }
      },
      create: {
        organizationId: input.organizationId,
        ownerUserId: input.ownerUserId,
        accountId: input.accountId ?? null,
        contactId: input.contactId ?? null,
        provider: input.provider,
        identityType: input.identityType,
        identityValue: input.identityValue,
        status: input.status,
        lastAttemptedAt: input.lastAttemptedAt,
        lastSucceededAt: input.lastSucceededAt ?? null,
        maskedEmail: input.maskedEmail ?? null,
        errorMessage: input.errorMessage ?? null
      },
      update: {
        accountId: input.accountId ?? null,
        contactId: input.contactId ?? null,
        status: input.status,
        lastAttemptedAt: input.lastAttemptedAt,
        lastSucceededAt: input.lastSucceededAt ?? null,
        maskedEmail: input.maskedEmail ?? null,
        errorMessage: input.errorMessage ?? null
      }
    });

    return toLeadEnrichmentHistoryRecord(record);
  }

  async listAccounts(args: {
    organizationId: string;
    ownerUserId?: string;
    keyword?: string;
    contactTitle?: string;
    customerType?: string;
    region?: string;
    regionKeywords?: string[];
    status?: CrmAccountStatus;
    sourceTaskId?: string;
    updatedFrom?: Date;
    updatedTo?: Date;
    skip: number;
    take: number;
  }) {
    const where = toAccountListWhere(args);
    const [records, total] = await Promise.all([
      this.prisma.crmAccount.findMany({
        where,
        include: {
          _count: {
            select: {
              contacts: true
            }
          },
          contacts: {
            orderBy: { createdAt: 'asc' },
            take: 1
          }
        },
        skip: args.skip,
        take: args.take,
        orderBy: { updatedAt: 'desc' }
      }),
      this.prisma.crmAccount.count({ where })
    ]);
    const progressByContactId = await this.getContactEmailProgressMap({
      organizationId: args.organizationId,
      contactIds: records.flatMap(record => record.contacts.map(contact => contact.id))
    });

    return {
      records: records.map(record => toAccountListRecord(record, progressByContactId)),
      total
    };
  }

  async getAccountDetail(args: { id: string; organizationId: string; ownerUserId?: string }) {
    const account = await this.prisma.crmAccount.findFirst({
      where: toAccountIdentityWhere(args)
    });

    if (!account) return null;

    const [contacts, timelineEvents, enrichmentHistories] = await Promise.all([
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
      }),
      this.prisma.crmLeadEnrichmentHistory.findMany({
        where: {
          organizationId: args.organizationId,
          ownerUserId: account.ownerUserId,
          OR: [
            { accountId: account.id },
            ...(account.domain ? [{ identityType: 'domain', identityValue: account.domain }] : [])
          ]
        },
        orderBy: {
          lastAttemptedAt: 'desc'
        }
      })
    ]);
    const progressByContactId = await this.getContactEmailProgressMap({
      organizationId: args.organizationId,
      contactIds: contacts.map(contact => contact.id)
    });

    return {
      account: toAccountRecord(account),
      contacts: contacts.map(contact => withContactEmailProgress(toContactRecord(contact), progressByContactId)),
      enrichmentHistories: enrichmentHistories.map(toLeadEnrichmentHistoryRecord),
      timelineEvents: timelineEvents.map(toTimelineEventRecord)
    };
  }

  private async getContactEmailProgressMap(input: { organizationId: string; contactIds: string[] }) {
    const contactIds = toUniqueValues(input.contactIds);
    const progressByContactId = new Map<string, ContactEmailProgress>();

    if (contactIds.length === 0) {
      return progressByContactId;
    }

    const [messages, threads] = await Promise.all([
      this.prisma.crmMessage.findMany({
        where: {
          organizationId: input.organizationId,
          contactId: { in: contactIds }
        },
        select: {
          id: true,
          contactId: true,
          status: true,
          stepIndex: true,
          scheduledAt: true,
          sentAt: true,
          updatedAt: true,
          enrollment: {
            select: {
              totalSteps: true
            }
          }
        },
        orderBy: [{ updatedAt: 'desc' }]
      }),
      this.prisma.crmInboxThread.findMany({
        where: {
          organizationId: input.organizationId,
          contactId: { in: contactIds }
        },
        select: {
          contactId: true,
          lastInboundAt: true
        },
        orderBy: {
          lastInboundAt: 'desc'
        }
      })
    ]);
    const messagesByContactId = groupByContactId(messages);
    const latestThreadByContactId = new Map<string, ContactProgressThreadRow>();

    for (const thread of threads) {
      if (!latestThreadByContactId.has(thread.contactId)) {
        latestThreadByContactId.set(thread.contactId, thread);
      }
    }

    for (const contactId of contactIds) {
      progressByContactId.set(
        contactId,
        buildContactEmailProgress(messagesByContactId.get(contactId) ?? [], latestThreadByContactId.get(contactId))
      );
    }

    return progressByContactId;
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
}

function toUniqueValues(values: string[]) {
  return Array.from(new Set(values.map(value => value.trim()).filter(Boolean)));
}

function toAccountListRecord(
  record: PrismaAccountListRecord,
  progressByContactId: Map<string, ContactEmailProgress>
): CrmAccountListRecord {
  const { _count, contacts, ...account } = record;

  return {
    ...toAccountRecord(account),
    contactCount: _count.contacts,
    primaryContact: contacts[0] ? withContactEmailProgress(toContactRecord(contacts[0]), progressByContactId) : null
  };
}

function withContactEmailProgress(
  contact: CrmContactRecord,
  progressByContactId: Map<string, ContactEmailProgress>
): CrmContactRecord {
  const progress = progressByContactId.get(contact.id);

  if (!progress) return contact;

  return {
    ...contact,
    ...progress
  };
}

function groupByContactId(messages: ContactProgressMessageRow[]) {
  const grouped = new Map<string, ContactProgressMessageRow[]>();

  for (const message of messages) {
    grouped.set(message.contactId, [...(grouped.get(message.contactId) ?? []), message]);
  }

  return grouped;
}

function buildContactEmailProgress(
  messages: ContactProgressMessageRow[],
  latestThread?: ContactProgressThreadRow
): ContactEmailProgress {
  if (latestThread) {
    return {
      emailProgressStatus: 'replied',
      emailProgressLabel: '客户已回复',
      emailProgressAt: latestThread.lastInboundAt,
      emailProgressMessageId: null,
      emailProgressStepIndex: null,
      emailProgressTotalSteps: null
    };
  }

  const message =
    pickLatestMessage(messages, ['failed']) ??
    pickNextScheduledMessage(messages) ??
    pickLatestMessage(messages, ['draft_pending_review']) ??
    pickLatestMessage(messages, ['sent']) ??
    pickLatestMessage(messages, ['skipped']);

  if (!message) {
    return {
      emailProgressStatus: 'not_generated',
      emailProgressLabel: '首封待生成',
      emailProgressAt: null,
      emailProgressMessageId: null,
      emailProgressStepIndex: null,
      emailProgressTotalSteps: null
    };
  }

  const status = message.status as ContactEmailProgress['emailProgressStatus'];
  const totalSteps = message.enrollment?.totalSteps ?? null;

  return {
    emailProgressStatus: status,
    emailProgressLabel: formatContactEmailProgressLabel(status, message.stepIndex, totalSteps),
    emailProgressAt: getMessageProgressTime(message),
    emailProgressMessageId: message.id,
    emailProgressStepIndex: message.stepIndex,
    emailProgressTotalSteps: totalSteps
  };
}

function pickLatestMessage(messages: ContactProgressMessageRow[], statuses: string[]) {
  return messages
    .filter(message => statuses.includes(message.status))
    .sort((left, right) => getMessageProgressTime(right).getTime() - getMessageProgressTime(left).getTime())[0];
}

function pickNextScheduledMessage(messages: ContactProgressMessageRow[]) {
  return messages
    .filter(message => ['draft_ready', 'queued'].includes(message.status))
    .sort((left, right) => getMessageProgressTime(left).getTime() - getMessageProgressTime(right).getTime())[0];
}

function getMessageProgressTime(message: ContactProgressMessageRow) {
  return message.scheduledAt ?? message.sentAt ?? message.updatedAt;
}

function formatContactEmailProgressLabel(
  status: ContactEmailProgress['emailProgressStatus'],
  stepIndex: number,
  totalSteps: number | null
) {
  const stepText = totalSteps ? `第 ${stepIndex}/${totalSteps} 封` : `第 ${stepIndex} 封`;

  if (status === 'draft_pending_review') return `${stepText}待确认`;
  if (status === 'draft_ready') return `${stepText}已排期`;
  if (status === 'queued') return `${stepText}发送中`;
  if (status === 'sent') return `${stepText}已发送`;
  if (status === 'failed') return `${stepText}发送失败`;
  if (status === 'skipped') return `${stepText}已跳过`;

  return '首封待生成';
}
