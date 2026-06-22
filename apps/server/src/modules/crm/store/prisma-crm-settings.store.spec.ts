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
    followUpDelayDaysText: '3,7,14,21',
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
}
