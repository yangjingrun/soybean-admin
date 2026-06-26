import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PrismaCrmSettingsStore } from './prisma-crm-settings.store';

describe('PrismaCrmSettingsStore', () => {
  it('routes CRM global and organization config calls through the composed settings store', async () => {
    const prisma = new SettingsPrisma();
    const store = new PrismaCrmSettingsStore(prisma as never);

    const current = await store.getGlobalConfig();
    const organizationConfig = await store.saveOrganizationConfig({
      organizationId: 'org-1',
      allowAdminViewMemberEmailBody: true,
      updatedById: 'admin-1',
      updatedByName: 'Admin'
    });

    assert.equal(current.emailVerificationCooldownDays, 30);
    assert.equal(organizationConfig.allowAdminViewMemberEmailBody, true);
    assert.deepEqual(prisma.crmGlobalConfig.findUniqueCalls[0].where, { configKey: 'default' });
    assert.deepEqual(prisma.crmOrganizationConfig.upsertCalls[0].where, { organizationId: 'org-1' });
  });

  it('routes product line reads through the composed settings store with organization scope', async () => {
    const prisma = new SettingsPrisma();
    const store = new PrismaCrmSettingsStore(prisma as never);

    const result = await store.listProductLines({
      organizationId: 'org-1',
      keyword: 'bearing',
      status: 'active',
      skip: 0,
      take: 20
    });

    assert.equal(result.records[0].id, 'product-line-1');
    assert.deepEqual(prisma.crmProductLine.findManyCalls[0].where, {
      organizationId: 'org-1',
      status: 'active',
      OR: [
        { name: { contains: 'bearing', mode: 'insensitive' } },
        { targetCustomerType: { contains: 'bearing', mode: 'insensitive' } },
        { coreSellingPoints: { contains: 'bearing', mode: 'insensitive' } },
        { moq: { contains: 'bearing', mode: 'insensitive' } },
        { leadTime: { contains: 'bearing', mode: 'insensitive' } },
        { paymentTerms: { contains: 'bearing', mode: 'insensitive' } },
        { certifications: { contains: 'bearing', mode: 'insensitive' } },
        { commonModelsText: { contains: 'bearing', mode: 'insensitive' } }
      ]
    });
  });

  it('clears current owner outreach state with organization and owner guards', async () => {
    const prisma = new SettingsPrisma();
    const store = new PrismaCrmSettingsStore(prisma as never);

    const result = await store.clearCurrentUserOutreachState({
      organizationId: 'org-1',
      ownerUserId: 'user-1'
    });

    assert.deepEqual(result, {
      deletedAiDraftTaskCount: 1,
      deletedAiDraftTaskItemCount: 2,
      deletedDraftVersionCount: 3,
      deletedEnrollmentCount: 2,
      deletedMessageCount: 5,
      deletedOpenEventCount: 4,
      deletedTimelineEventCount: 6,
      resetAccountCount: 2
    });
    assert.deepEqual(prisma.crmSequenceEnrollment.deleteManyCalls[0].where, {
      organizationId: 'org-1',
      ownerUserId: 'user-1'
    });
    assert.deepEqual(prisma.crmAccount.updateManyCalls[0], {
      where: {
        organizationId: 'org-1',
        ownerUserId: 'user-1',
        id: { in: ['account-1', 'account-2'] },
        status: { in: ['sequence_running', 'replied_pending', 'followed_up'] }
      },
      data: { status: 'ready' }
    });
    assert.equal(prisma.transactionCallCount, 1);
  });
});

interface ListCall {
  where: unknown;
  skip?: number;
  take?: number;
  orderBy?: unknown;
}

interface UniqueCall {
  where: unknown;
}

interface DeleteManyCall {
  where: unknown;
}

interface CountCall {
  where: unknown;
}

interface UpdateManyCall {
  where: unknown;
  data: unknown;
}

interface UpsertCall<TCreate, TUpdate> {
  where: unknown;
  create: TCreate;
  update: TUpdate;
}

function createGlobalConfig() {
  return {
    configKey: 'default',
    emailVerificationCooldownDays: 30,
    ownerConcurrentSendLimit: 5,
    ownerDailySendLimitMax: 200,
    followUpDelayDaysText: '3,7,12,18',
    updatedById: null,
    updatedByName: null,
    updatedAt: new Date('2026-06-18T09:00:00.000Z')
  };
}

function createOrganizationConfig(input: Record<string, unknown> = {}) {
  return {
    id: 'crm-organization-config-1',
    organizationId: 'org-1',
    allowAdminViewMemberEmailBody: false,
    updatedById: 'user-1',
    updatedByName: 'Alice',
    createdAt: new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: new Date('2026-06-18T10:00:00.000Z'),
    ...input
  };
}

function createProductLine(input: Record<string, unknown> = {}) {
  return {
    id: 'product-line-1',
    organizationId: 'org-1',
    name: 'Bearing Series',
    targetCustomerType: 'distributor',
    coreSellingPoints: 'Stable supply',
    moq: '100 pcs',
    leadTime: '15 days',
    paymentTerms: 'T/T',
    certifications: 'ISO 9001',
    catalogUrl: '/catalog/bearing.pdf',
    websiteUrl: 'https://example.com/bearing',
    commonModelsText: '6204, 6205',
    aiWritingConfig: null,
    status: 'active',
    createdById: 'user-1',
    createdByName: 'Alice',
    createdAt: new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: new Date('2026-06-18T09:00:00.000Z'),
    ...input
  };
}

class SettingsPrisma {
  transactionCallCount = 0;

  async $transaction<T>(callback: (tx: this) => Promise<T>) {
    this.transactionCallCount += 1;
    return callback(this);
  }

  readonly crmGlobalConfig = {
    findUniqueCalls: [] as UniqueCall[],
    findUnique: async (args: UniqueCall) => {
      this.crmGlobalConfig.findUniqueCalls.push(args);
      return createGlobalConfig();
    }
  };

  readonly crmOrganizationConfig = {
    upsertCalls: [] as Array<
      UpsertCall<ReturnType<typeof createOrganizationConfig>, Partial<ReturnType<typeof createOrganizationConfig>>>
    >,
    upsert: async (
      args: UpsertCall<
        ReturnType<typeof createOrganizationConfig>,
        Partial<ReturnType<typeof createOrganizationConfig>>
      >
    ) => {
      this.crmOrganizationConfig.upsertCalls.push(args);
      return createOrganizationConfig(args.create);
    }
  };

  readonly crmProductLine = {
    findManyCalls: [] as ListCall[],
    countCalls: [] as Array<{ where: unknown }>,
    findMany: async (args: ListCall) => {
      this.crmProductLine.findManyCalls.push(args);
      return [createProductLine()];
    },
    count: async (args: { where: unknown }) => {
      this.crmProductLine.countCalls.push(args);
      return 1;
    }
  };

  readonly crmSequenceEnrollment = {
    findManyCalls: [] as Array<{ where: unknown; select: unknown }>,
    deleteManyCalls: [] as DeleteManyCall[],
    findMany: async (args: { where: unknown; select: unknown }) => {
      this.crmSequenceEnrollment.findManyCalls.push(args);
      return [
        { id: 'enrollment-1', accountId: 'account-1' },
        { id: 'enrollment-2', accountId: 'account-2' },
        { id: 'enrollment-3', accountId: 'account-1' }
      ];
    },
    deleteMany: async (args: DeleteManyCall) => {
      this.crmSequenceEnrollment.deleteManyCalls.push(args);
      return { count: 2 };
    }
  };

  readonly crmMessage = {
    countCalls: [] as CountCall[],
    count: async (args: CountCall) => {
      this.crmMessage.countCalls.push(args);
      return 5;
    }
  };

  readonly crmMessageDraftVersion = {
    countCalls: [] as CountCall[],
    count: async (args: CountCall) => {
      this.crmMessageDraftVersion.countCalls.push(args);
      return 3;
    }
  };

  readonly crmEmailOpenEvent = {
    countCalls: [] as CountCall[],
    count: async (args: CountCall) => {
      this.crmEmailOpenEvent.countCalls.push(args);
      return 4;
    }
  };

  readonly crmAiDraftTask = {
    countCalls: [] as CountCall[],
    deleteManyCalls: [] as DeleteManyCall[],
    count: async (args: CountCall) => {
      this.crmAiDraftTask.countCalls.push(args);
      return 1;
    },
    deleteMany: async (args: DeleteManyCall) => {
      this.crmAiDraftTask.deleteManyCalls.push(args);
      return { count: 1 };
    }
  };

  readonly crmAiDraftTaskItem = {
    countCalls: [] as CountCall[],
    count: async (args: CountCall) => {
      this.crmAiDraftTaskItem.countCalls.push(args);
      return 2;
    }
  };

  readonly crmTimelineEvent = {
    deleteManyCalls: [] as DeleteManyCall[],
    deleteMany: async (args: DeleteManyCall) => {
      this.crmTimelineEvent.deleteManyCalls.push(args);
      return { count: 6 };
    }
  };

  readonly crmAccount = {
    updateManyCalls: [] as UpdateManyCall[],
    updateMany: async (args: UpdateManyCall) => {
      this.crmAccount.updateManyCalls.push(args);
      return { count: 2 };
    }
  };
}
