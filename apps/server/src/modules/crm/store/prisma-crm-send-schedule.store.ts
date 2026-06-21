import { PrismaService } from '../../database/prisma.service';
import type {
  CrmDispatchedMessageCountInput,
  CrmDueSendCandidateListInput,
  CrmDueSendCandidateRecord,
  CrmMailboxSendStateBatchInput,
  CrmMessageRecord,
  CrmOwnerSendStateBatchInput
} from '../crm.types';
import {
  toAccountRecord,
  toContactRecord,
  toCrmBlacklistPairKey,
  toDispatchedMessageRangeWhere,
  toMailboxCountMap,
  toMailboxPairFilters,
  toMailboxPairKey,
  toMailboxRecord,
  toMessageRecord,
  toOwnerPairFilters,
  toOwnerPairKey,
  toProductLineRecord,
  toSendPreferenceRecord,
  toSequenceEnrollmentRecord,
  toStepKindWhere,
  toUniqueMailboxPairs,
  toUniqueOwnerPairs
} from './prisma-crm-store.helpers';

export class PrismaCrmSendScheduleStore {
  constructor(private readonly prisma: PrismaService) {}

  countOwnerQueuedMessages(args: { organizationId: string; ownerUserId: string }) {
    return this.prisma.crmMessage.count({
      where: {
        organizationId: args.organizationId,
        ownerUserId: args.ownerUserId,
        status: 'queued'
      }
    });
  }

  countDispatchedMessages(input: CrmDispatchedMessageCountInput) {
    return this.prisma.crmMessage.count({
      where: {
        organizationId: input.organizationId,
        ...(input.ownerUserId ? { ownerUserId: input.ownerUserId } : {}),
        ...(input.mailboxId ? { mailboxId: input.mailboxId } : {}),
        ...toStepKindWhere(input.stepKind),
        OR: [
          {
            status: 'queued',
            scheduledAt: {
              gte: input.from,
              lt: input.to
            }
          },
          {
            status: 'sent',
            sentAt: {
              gte: input.from,
              lt: input.to
            }
          }
        ]
      }
    });
  }

  /** Batch loads owner-level send scheduler state to avoid per-owner count queries. */
  async listOwnerSendStates(input: CrmOwnerSendStateBatchInput) {
    const owners = toUniqueOwnerPairs(input.owners);

    if (owners.length === 0) {
      return [];
    }

    const ownerFilters = toOwnerPairFilters(owners);
    const [preferences, queuedRows, dispatchedRows] = await Promise.all([
      this.prisma.crmUserSendPreference.findMany({
        where: {
          OR: ownerFilters
        }
      }),
      this.prisma.crmMessage.groupBy({
        by: ['organizationId', 'ownerUserId'],
        where: {
          AND: [{ OR: ownerFilters }, { status: 'queued' }]
        },
        _count: {
          _all: true
        }
      }),
      this.prisma.crmMessage.groupBy({
        by: ['organizationId', 'ownerUserId', 'stepIndex'],
        where: {
          AND: [{ OR: ownerFilters }, toDispatchedMessageRangeWhere(input.from, input.to)]
        },
        _count: {
          _all: true
        }
      })
    ]);
    const preferencesByOwner = new Map(
      preferences.map(preference => [toOwnerPairKey(preference.organizationId, preference.ownerUserId), preference])
    );
    const queuedCountByOwner = new Map(
      queuedRows.map(row => [toOwnerPairKey(row.organizationId, row.ownerUserId), row['_count']['_all']])
    );
    const dispatchedCountByOwner = new Map<
      string,
      {
        dailyCount: number;
        firstTouchCount: number;
        followUpCount: number;
      }
    >();

    for (const row of dispatchedRows) {
      const key = toOwnerPairKey(row.organizationId, row.ownerUserId);
      const count = row['_count']['_all'];
      const current = dispatchedCountByOwner.get(key) ?? {
        dailyCount: 0,
        firstTouchCount: 0,
        followUpCount: 0
      };

      current.dailyCount += count;
      if (row.stepIndex === 1) {
        current.firstTouchCount += count;
      } else {
        current.followUpCount += count;
      }
      dispatchedCountByOwner.set(key, current);
    }

    return owners.map(owner => {
      const key = toOwnerPairKey(owner.organizationId, owner.ownerUserId);
      const dispatchedCount = dispatchedCountByOwner.get(key);
      const preference = preferencesByOwner.get(key);

      return {
        organizationId: owner.organizationId,
        ownerUserId: owner.ownerUserId,
        preference: preference ? toSendPreferenceRecord(preference) : null,
        queuedCount: queuedCountByOwner.get(key) ?? 0,
        dailyCount: dispatchedCount?.dailyCount ?? 0,
        firstTouchCount: dispatchedCount?.firstTouchCount ?? 0,
        followUpCount: dispatchedCount?.followUpCount ?? 0
      };
    });
  }

  /** Batch loads mailbox daily and hourly send counters for scheduler capacity checks. */
  async listMailboxSendStates(input: CrmMailboxSendStateBatchInput) {
    const mailboxes = toUniqueMailboxPairs(input.mailboxes);

    if (mailboxes.length === 0) {
      return [];
    }

    const mailboxFilters = toMailboxPairFilters(mailboxes);
    const [dailyRows, hourlyRows] = await Promise.all([
      this.prisma.crmMessage.groupBy({
        by: ['organizationId', 'mailboxId'],
        where: {
          AND: [{ OR: mailboxFilters }, toDispatchedMessageRangeWhere(input.day.from, input.day.to)]
        },
        _count: {
          _all: true
        }
      }),
      this.prisma.crmMessage.groupBy({
        by: ['organizationId', 'mailboxId'],
        where: {
          AND: [{ OR: mailboxFilters }, toDispatchedMessageRangeWhere(input.hour.from, input.hour.to)]
        },
        _count: {
          _all: true
        }
      })
    ]);
    const dailyCountByMailbox = toMailboxCountMap(dailyRows);
    const hourlyCountByMailbox = toMailboxCountMap(hourlyRows);

    return mailboxes.map(mailbox => {
      const key = toMailboxPairKey(mailbox.organizationId, mailbox.mailboxId);

      return {
        organizationId: mailbox.organizationId,
        mailboxId: mailbox.mailboxId,
        dailyCount: dailyCountByMailbox.get(key) ?? 0,
        hourlyCount: hourlyCountByMailbox.get(key) ?? 0
      };
    });
  }

  async listDueSendCandidates(input: CrmDueSendCandidateListInput): Promise<CrmDueSendCandidateRecord[]> {
    const records = await this.prisma.crmMessage.findMany({
      where: {
        status: 'draft_ready',
        scheduledAt: {
          lte: input.now
        },
        mailboxId: {
          not: null
        },
        mailbox: {
          is: {
            status: 'active'
          }
        },
        enrollment: {
          status: 'sequence_running'
        },
        contact: {
          emailStatus: {
            not: 'unsubscribed'
          }
        }
      },
      include: {
        account: true,
        contact: true,
        mailbox: true,
        enrollment: {
          include: {
            productLine: true
          }
        }
      },
      orderBy: [{ scheduledAt: 'asc' }, { updatedAt: 'asc' }],
      take: input.take
    });
    const blacklistedContactKeys = await this.findBlacklistedDueCandidateKeys(records);
    const candidates: CrmDueSendCandidateRecord[] = [];

    for (const record of records) {
      if (!record.mailbox || record.mailbox.status !== 'active') {
        continue;
      }

      if (record.enrollment.status !== 'sequence_running' || record.contact.emailStatus === 'unsubscribed') {
        continue;
      }

      if (blacklistedContactKeys.has(toCrmBlacklistPairKey(record.organizationId, record.contact.emailHash))) {
        continue;
      }

      candidates.push({
        enrollment: toSequenceEnrollmentRecord(record.enrollment),
        account: toAccountRecord(record.account),
        contact: toContactRecord(record.contact),
        productLine: record.enrollment.productLine ? toProductLineRecord(record.enrollment.productLine) : null,
        mailbox: toMailboxRecord(record.mailbox),
        firstMessage: record.stepIndex === 1 ? toMessageRecord(record) : null,
        messages: [toMessageRecord(record)],
        message: toMessageRecord(record),
        stepKind: record.stepIndex === 1 ? 'first_touch' : 'follow_up'
      });
    }

    return candidates;
  }

  /** Batch loads blacklist keys for due send candidates to avoid per-message blacklist lookups. */
  private async findBlacklistedDueCandidateKeys(
    records: Array<{ organizationId: string; contact: { emailHash: string } }>
  ) {
    const blacklistPairs = Array.from(
      new Map(
        records.map(record => [
          toCrmBlacklistPairKey(record.organizationId, record.contact.emailHash),
          {
            organizationId: record.organizationId,
            emailHash: record.contact.emailHash
          }
        ])
      ).values()
    );

    if (blacklistPairs.length === 0) {
      return new Set<string>();
    }

    const blacklists = await this.prisma.crmBlacklist.findMany({
      where: {
        OR: blacklistPairs
      },
      select: {
        organizationId: true,
        emailHash: true
      }
    });

    return new Set(blacklists.map(record => toCrmBlacklistPairKey(record.organizationId, record.emailHash)));
  }

  async listStaleQueuedMessages(input: { before: Date; take: number }): Promise<CrmMessageRecord[]> {
    const records = await this.prisma.crmMessage.findMany({
      where: {
        status: 'queued',
        bullJobId: {
          not: null
        },
        scheduledAt: {
          lte: input.before
        }
      },
      orderBy: [{ scheduledAt: 'asc' }, { updatedAt: 'asc' }],
      take: input.take
    });

    return records.map(toMessageRecord);
  }
}
