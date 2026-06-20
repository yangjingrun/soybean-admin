import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PrismaCrmConfigStore } from './prisma-crm-config.store';

describe('PrismaCrmConfigStore', () => {
  it('reads and saves CRM global config with normalized cooldown days', async () => {
    const prisma = new ConfigPrisma();
    const store = new PrismaCrmConfigStore(prisma as never);

    const current = await store.getGlobalConfig();
    const saved = await store.saveGlobalConfig({
      emailVerificationCooldownDays: 999,
      ownerConcurrentSendLimit: 0,
      ownerDailySendLimitMax: 3000,
      followUpDelayDays: { step2Days: 0, step3Days: 8, step4Days: 120, step5Days: 30 },
      updatedById: 'super-1',
      updatedByName: 'Super Admin'
    });

    assert.equal(current.emailVerificationCooldownDays, 30);
    assert.deepEqual(current.followUpDelayDays, { step2Days: 3, step3Days: 7, step4Days: 14, step5Days: 21 });
    assert.equal(saved.emailVerificationCooldownDays, 365);
    assert.equal(saved.ownerConcurrentSendLimit, 5);
    assert.equal(saved.ownerDailySendLimitMax, 1000);
    assert.deepEqual(saved.followUpDelayDays, { step2Days: 3, step3Days: 8, step4Days: 90, step5Days: 30 });
    assert.deepEqual(prisma.crmGlobalConfig.findUniqueCalls[0].where, { configKey: 'default' });
    assert.deepEqual(prisma.crmGlobalConfig.upsertCalls[0].where, { configKey: 'default' });
    assert.equal(prisma.crmGlobalConfig.upsertCalls[0].create.emailVerificationCooldownDays, 365);
    assert.equal(prisma.crmGlobalConfig.upsertCalls[0].create.ownerConcurrentSendLimit, 5);
    assert.equal(prisma.crmGlobalConfig.upsertCalls[0].create.ownerDailySendLimitMax, 1000);
    assert.equal(prisma.crmGlobalConfig.upsertCalls[0].create.followUpDelayDaysText, '3,8,90,30');
  });

  it('reads and saves organization CRM permission config', async () => {
    const prisma = new ConfigPrisma({ organizationConfig: createOrganizationConfig() });
    const store = new PrismaCrmConfigStore(prisma as never);

    const current = await store.getOrganizationConfig('org-1');
    const saved = await store.saveOrganizationConfig({
      organizationId: 'org-1',
      allowAdminViewMemberEmailBody: true,
      updatedById: 'user-1',
      updatedByName: 'Alice'
    });

    assert.equal(current?.allowAdminViewMemberEmailBody, false);
    assert.equal(saved.allowAdminViewMemberEmailBody, true);
    assert.deepEqual(prisma.crmOrganizationConfig.findUniqueCalls[0].where, { organizationId: 'org-1' });
    assert.deepEqual(prisma.crmOrganizationConfig.upsertCalls[0].where, { organizationId: 'org-1' });
    assert.equal(prisma.crmOrganizationConfig.upsertCalls[0].create.allowAdminViewMemberEmailBody, true);
    assert.equal(prisma.crmOrganizationConfig.upsertCalls[0].update.updatedByName, 'Alice');
  });
});

interface GlobalConfigRecord {
  configKey: string;
  emailVerificationCooldownDays: number;
  ownerConcurrentSendLimit: number;
  ownerDailySendLimitMax: number;
  followUpDelayDaysText: string;
  updatedById: string | null;
  updatedByName: string | null;
  updatedAt: Date;
}

interface OrganizationConfigRecord {
  id: string;
  organizationId: string;
  allowAdminViewMemberEmailBody: boolean;
  updatedById: string | null;
  updatedByName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface UniqueCall {
  where: unknown;
}

interface UpsertCall<TCreate, TUpdate> {
  where: unknown;
  create: TCreate;
  update: TUpdate;
}

function createGlobalConfig(input: Partial<GlobalConfigRecord> = {}): GlobalConfigRecord {
  return {
    configKey: 'default',
    emailVerificationCooldownDays: 30,
    ownerConcurrentSendLimit: 5,
    ownerDailySendLimitMax: 200,
    followUpDelayDaysText: '3,7,14,21',
    updatedById: null,
    updatedByName: null,
    updatedAt: new Date('2026-06-18T09:00:00.000Z'),
    ...input
  };
}

function createOrganizationConfig(input: Partial<OrganizationConfigRecord> = {}): OrganizationConfigRecord {
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

class ConfigPrisma {
  readonly globalConfig = createGlobalConfig();
  readonly organizationConfig: OrganizationConfigRecord | null;

  readonly crmGlobalConfig = {
    findUniqueCalls: [] as UniqueCall[],
    upsertCalls: [] as Array<UpsertCall<GlobalConfigRecord, Partial<GlobalConfigRecord>>>,
    findUnique: async (args: UniqueCall) => {
      this.crmGlobalConfig.findUniqueCalls.push(args);
      return null;
    },
    upsert: async (args: UpsertCall<GlobalConfigRecord, Partial<GlobalConfigRecord>>) => {
      this.crmGlobalConfig.upsertCalls.push(args);
      return createGlobalConfig(args.create);
    }
  };

  readonly crmOrganizationConfig = {
    findUniqueCalls: [] as UniqueCall[],
    upsertCalls: [] as Array<UpsertCall<OrganizationConfigRecord, Partial<OrganizationConfigRecord>>>,
    findUnique: async (args: UniqueCall) => {
      this.crmOrganizationConfig.findUniqueCalls.push(args);
      return this.organizationConfig;
    },
    upsert: async (args: UpsertCall<OrganizationConfigRecord, Partial<OrganizationConfigRecord>>) => {
      this.crmOrganizationConfig.upsertCalls.push(args);
      return createOrganizationConfig(args.create);
    }
  };

  constructor(options: { organizationConfig?: OrganizationConfigRecord | null } = {}) {
    this.organizationConfig = options.organizationConfig ?? null;
  }
}
