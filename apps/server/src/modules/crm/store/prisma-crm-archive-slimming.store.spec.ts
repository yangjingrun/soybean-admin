import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PrismaCrmArchiveSlimmingStore } from './prisma-crm-archive-slimming.store';

describe('PrismaCrmArchiveSlimmingStore', () => {
  it('lists and slims archived accounts after the recovery window', async () => {
    const prisma = createPrismaArchiveSlimmingPrisma();
    const store = new PrismaCrmArchiveSlimmingStore(prisma as never);
    const archivedBefore = new Date('2026-05-20T00:00:00.000Z');
    const slimmedAt = new Date('2026-06-19T00:00:00.000Z');

    await store.listAccountsForArchiveSlimming({
      archivedBefore,
      take: 100
    });
    await store.slimArchivedAccount({
      id: 'account-1',
      organizationId: 'org-1',
      archivedBefore,
      slimmedAt
    });

    assert.deepEqual(prisma.crmAccount.findManyCalls[0], {
      where: {
        status: 'archived',
        archiveSlimmedAt: null,
        archivedAt: {
          lte: archivedBefore
        }
      },
      orderBy: { archivedAt: 'asc' },
      take: 100
    });
    assert.deepEqual(prisma.crmAccount.updateManyAndReturnCalls[0], {
      where: {
        id: 'account-1',
        organizationId: 'org-1',
        status: 'archived',
        archiveSlimmedAt: null,
        archivedAt: {
          lte: archivedBefore
        }
      },
      data: {
        archiveSlimmedAt: slimmedAt,
        customerType: null,
        websiteUrl: null
      },
      limit: 1
    });
  });
});

function createPrismaArchiveSlimmingPrisma() {
  const account = {
    id: 'account-1',
    organizationId: 'org-1',
    ownerUserId: 'user-1',
    name: 'ABC Trading',
    normalizedName: 'abc trading',
    websiteUrl: 'https://abc.example',
    domain: 'abc.example',
    country: 'AE',
    customerType: 'distributor',
    status: 'archived',
    sourceTaskId: 'task-1',
    archivedAt: new Date('2026-04-18T09:00:00.000Z'),
    archiveReason: 'Not a fit',
    archiveSlimmedAt: null,
    createdAt: new Date('2026-04-18T09:00:00.000Z'),
    updatedAt: new Date('2026-05-18T09:00:00.000Z')
  };

  return {
    crmAccount: {
      findManyCalls: [] as Array<{
        where: Record<string, unknown>;
        orderBy: Record<string, unknown>;
        take: number;
      }>,
      updateManyAndReturnCalls: [] as Array<{
        where: Record<string, unknown>;
        data: Record<string, unknown>;
        limit: number;
      }>,
      async findMany(args: { where: Record<string, unknown>; orderBy: Record<string, unknown>; take: number }) {
        this.findManyCalls.push(args);

        return [account];
      },
      async updateManyAndReturn(args: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
        limit: number;
      }) {
        this.updateManyAndReturnCalls.push(args);

        return [{ ...account, ...args.data, updatedAt: new Date('2026-06-19T00:00:00.000Z') }];
      }
    }
  };
}
