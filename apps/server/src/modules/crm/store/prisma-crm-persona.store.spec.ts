import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PrismaCrmPersonaStore } from './prisma-crm-persona.store';

describe('PrismaCrmPersonaStore', () => {
  it('creates, lists, updates and defaults persona profiles with organization scope', async () => {
    const prisma = new PersonaPrisma();
    const store = new PrismaCrmPersonaStore(prisma as never);

    await store.createPersonaProfile({
      organizationId: 'org-1',
      name: 'Procurement lead',
      titleKeywordsText: 'procurement\nbuyer',
      customerTypeKeywordsText: 'distributor',
      painPoints: 'price volatility',
      focusText: 'MOQ and lead time',
      avoidText: 'cheap',
      status: 'active',
      isDefault: false,
      createdById: 'user-1',
      createdByName: 'Alice'
    });
    const listed = await store.listPersonaProfiles({
      organizationId: 'org-1',
      keyword: 'procurement',
      status: 'active',
      skip: 0,
      take: 20
    });
    const found = await store.findPersonaProfileById({ id: 'persona-profile-1', organizationId: 'org-1' });
    const updated = await store.updatePersonaProfile('persona-profile-1', 'org-1', {
      name: 'Senior buyer',
      isDefault: true
    });
    const defaulted = await store.setDefaultPersonaProfile('persona-profile-1', 'org-1');

    assert.equal(prisma.transactionCalls, 3);
    assert.equal(prisma.crmPersonaProfile.createCalls[0].data.organizationId, 'org-1');
    assert.deepEqual(prisma.crmPersonaProfile.findManyCalls[0].where, {
      organizationId: 'org-1',
      status: 'active',
      OR: [
        { name: { contains: 'procurement', mode: 'insensitive' } },
        { description: { contains: 'procurement', mode: 'insensitive' } },
        { titleKeywordsText: { contains: 'procurement', mode: 'insensitive' } },
        { customerTypeKeywordsText: { contains: 'procurement', mode: 'insensitive' } },
        { painPoints: { contains: 'procurement', mode: 'insensitive' } },
        { focusText: { contains: 'procurement', mode: 'insensitive' } },
        { avoidText: { contains: 'procurement', mode: 'insensitive' } }
      ]
    });
    assert.equal(listed.records[0].titleKeywordsText, 'procurement\nbuyer');
    assert.equal(found?.id, 'persona-profile-1');
    assert.equal(updated?.isDefault, true);
    assert.equal(defaulted?.isDefault, true);
    assert.deepEqual(prisma.crmPersonaProfile.findFirstCalls[0].where, {
      id: 'persona-profile-1',
      organizationId: 'org-1'
    });
    assert.deepEqual(prisma.crmPersonaProfile.updateManyAndReturnCalls.at(-1)?.where, {
      id: 'persona-profile-1',
      organizationId: 'org-1',
      status: 'active'
    });
    assert.deepEqual(prisma.crmPersonaProfile.updateManyCalls.at(-1), {
      where: {
        organizationId: 'org-1',
        id: { not: 'persona-profile-1' },
        isDefault: true
      },
      data: { isDefault: false }
    });
  });
});

interface PersonaRecord {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  titleKeywordsText: string | null;
  customerTypeKeywordsText: string | null;
  painPoints: string | null;
  focusText: string | null;
  avoidText: string | null;
  status: string;
  isDefault: boolean;
  createdById: string;
  createdByName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface ListCall {
  where: unknown;
  skip?: number;
  take?: number;
  orderBy?: unknown;
}

function createPersona(input: Partial<PersonaRecord> = {}): PersonaRecord {
  return {
    id: 'persona-profile-1',
    organizationId: 'org-1',
    name: 'Procurement lead',
    description: null,
    titleKeywordsText: 'procurement\nbuyer',
    customerTypeKeywordsText: 'distributor',
    painPoints: 'price volatility',
    focusText: 'MOQ and lead time',
    avoidText: 'cheap',
    status: 'active',
    isDefault: false,
    createdById: 'user-1',
    createdByName: 'Alice',
    createdAt: new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: new Date('2026-06-18T09:00:00.000Z'),
    ...input
  };
}

class PersonaPrisma {
  transactionCalls = 0;

  readonly crmPersonaProfile = {
    createCalls: [] as Array<{ data: Partial<PersonaRecord> }>,
    findManyCalls: [] as ListCall[],
    countCalls: [] as Array<{ where: unknown }>,
    findFirstCalls: [] as Array<{ where: unknown }>,
    updateManyCalls: [] as Array<{ where: unknown; data: Partial<PersonaRecord> }>,
    updateManyAndReturnCalls: [] as Array<{ where: unknown; data: Partial<PersonaRecord>; limit: number }>,
    create: async (args: { data: Partial<PersonaRecord> }) => {
      this.crmPersonaProfile.createCalls.push(args);
      return createPersona(args.data);
    },
    findMany: async (args: ListCall) => {
      this.crmPersonaProfile.findManyCalls.push(args);
      return [createPersona()];
    },
    count: async (args: { where: unknown }) => {
      this.crmPersonaProfile.countCalls.push(args);
      return 1;
    },
    findFirst: async (args: { where: unknown }) => {
      this.crmPersonaProfile.findFirstCalls.push(args);
      return createPersona();
    },
    updateMany: async (args: { where: unknown; data: Partial<PersonaRecord> }) => {
      this.crmPersonaProfile.updateManyCalls.push(args);
      return { count: 1 };
    },
    updateManyAndReturn: async (args: { where: unknown; data: Partial<PersonaRecord>; limit: number }) => {
      this.crmPersonaProfile.updateManyAndReturnCalls.push(args);
      return [createPersona(args.data)];
    }
  };

  async $transaction<T>(callback: (tx: this) => Promise<T>) {
    this.transactionCalls += 1;
    return callback(this);
  }
}
