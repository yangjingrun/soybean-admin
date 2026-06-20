import { Prisma } from '../../../generated/prisma/client';
import { isPrismaUniqueConflict } from './prisma-error.helpers';

export type MailboxSendQuotaBucketType = 'daily' | 'hourly';

export interface MailboxSendQuotaInput {
  organizationId: string;
  mailboxId: string;
  dailyLimit: number;
  hourlyLimit: number;
  at: Date;
}

export interface MailboxSendQuotaBucketInput {
  organizationId: string;
  mailboxId: string;
  bucketType: MailboxSendQuotaBucketType;
  bucketKey: string;
  limit: number;
}

/** Reserves daily and hourly mailbox send quota in the same transaction. */
export async function reserveMailboxSendQuota(tx: Prisma.TransactionClient, input: MailboxSendQuotaInput) {
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

/** Atomically reserves one usage bucket while respecting the configured limit. */
export async function reserveMailboxSendQuotaBucket(tx: Prisma.TransactionClient, input: MailboxSendQuotaBucketInput) {
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

/** Releases a prior daily or hourly reservation when the paired bucket cannot be reserved. */
export async function releaseMailboxSendQuotaBucket(tx: Prisma.TransactionClient, input: MailboxSendQuotaBucketInput) {
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

export function toMailboxSendQuotaBuckets(at: Date) {
  const iso = at.toISOString();

  return {
    daily: iso.slice(0, 10),
    hourly: iso.slice(0, 13)
  };
}
