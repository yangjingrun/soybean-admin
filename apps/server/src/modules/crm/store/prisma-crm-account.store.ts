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
  CrmAccountStatus,
  CrmAccountUpdateInput,
  CrmArchiveSlimInput,
  CrmArchiveSlimmingListInput,
  CrmArchivedFingerprintLookupInput,
  CrmArchivedFingerprintUpsertInput,
  CrmContactCreateInput,
  CrmContactUpdateInput,
  CrmEmailStatus,
  CrmEmailVerificationCacheUpsertInput,
  CrmLeadEnrichmentHistoryLookupInput,
  CrmLeadEnrichmentHistoryUpsertInput,
  CrmLeadImportPrecheckInput,
  CrmTimelineEventCreateInput
} from '../crm.types';
import type { CrmAccountRepository } from '../accounts/crm-account.repository';

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

    return {
      account: toAccountRecord(account),
      contacts: contacts.map(toContactRecord),
      enrichmentHistories: enrichmentHistories.map(toLeadEnrichmentHistoryRecord),
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
}

function toUniqueValues(values: string[]) {
  return Array.from(new Set(values.map(value => value.trim()).filter(Boolean)));
}
