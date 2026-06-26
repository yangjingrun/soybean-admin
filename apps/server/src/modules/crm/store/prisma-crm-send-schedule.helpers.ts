import { Prisma } from '../../../generated/prisma/client';

/** Deduplicates owner pairs by organization and user. */
export function toUniqueOwnerPairs(owners: Array<{ organizationId: string; ownerUserId: string }>) {
  return Array.from(
    new Map(owners.map(owner => [toOwnerPairKey(owner.organizationId, owner.ownerUserId), owner])).values()
  );
}

/** Maps owner pairs into Prisma OR filters. */
export function toOwnerPairFilters(owners: Array<{ organizationId: string; ownerUserId: string }>) {
  return owners.map(owner => ({
    organizationId: owner.organizationId,
    ownerUserId: owner.ownerUserId
  }));
}

/** Builds the dispatched message window for scheduled quota previews. */
export function toDispatchedMessageRangeWhere(from: Date, to: Date): Prisma.CrmMessageWhereInput {
  return {
    OR: [
      {
        status: 'queued',
        scheduledAt: {
          gte: from,
          lt: to
        }
      },
      {
        status: 'sent',
        sentAt: {
          gte: from,
          lt: to
        }
      }
    ]
  };
}

/** Creates a stable organization-owner pair key. */
export function toOwnerPairKey(organizationId: string, ownerUserId: string) {
  return `${organizationId}:${ownerUserId}`;
}

/** Deduplicates mailbox pairs by organization and mailbox id. */
export function toUniqueMailboxPairs(mailboxes: Array<{ organizationId: string; mailboxId: string }>) {
  return Array.from(
    new Map(mailboxes.map(mailbox => [toMailboxPairKey(mailbox.organizationId, mailbox.mailboxId), mailbox])).values()
  );
}

/** Maps mailbox pairs into Prisma OR filters. */
export function toMailboxPairFilters(mailboxes: Array<{ organizationId: string; mailboxId: string }>) {
  return mailboxes.map(mailbox => ({
    organizationId: mailbox.organizationId,
    mailboxId: mailbox.mailboxId
  }));
}

/** Converts grouped mailbox counts into a lookup map keyed by organization and mailbox. */
export function toMailboxCountMap(
  rows: Array<{ organizationId: string; mailboxId: string | null; _count: { _all: number } }>
) {
  const result = new Map<string, number>();

  for (const row of rows) {
    if (!row.mailboxId) {
      continue;
    }

    result.set(toMailboxPairKey(row.organizationId, row.mailboxId), row['_count']['_all']);
  }

  return result;
}

/** Creates a stable organization-mailbox pair key. */
export function toMailboxPairKey(organizationId: string, mailboxId: string) {
  return `${organizationId}:${mailboxId}`;
}
