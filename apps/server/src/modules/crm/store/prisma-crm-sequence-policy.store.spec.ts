import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PrismaCrmSequencePolicyStore } from './prisma-crm-sequence-policy.store';
import type { CrmSequencePolicyStep } from '../crm-sequence-policy';

describe('PrismaCrmSequencePolicyStore', () => {
  it('creates, lists, updates and sets default organization sequence policies', async () => {
    const prisma = new SequencePolicyPrisma();
    const store = new PrismaCrmSequencePolicyStore(prisma as never);
    const steps: CrmSequencePolicyStep[] = [
      { stepIndex: 1, delayDays: 0, threadMode: 'new_subject' },
      { stepIndex: 2, delayDays: 2, threadMode: 'same_thread' },
      { stepIndex: 3, delayDays: 5, threadMode: 'new_subject' },
      { stepIndex: 4, delayDays: 9, threadMode: 'new_subject' },
      { stepIndex: 5, delayDays: 14, threadMode: 'new_subject' }
    ];

    const created = await store.createSequencePolicy({
      organizationId: 'org-1',
      name: 'Fast follow-up',
      description: 'Shorter first week',
      status: 'active',
      isDefault: false,
      steps,
      linkPolicy: 'block_new_links',
      allowLowRiskAutoSend: true,
      sameCompanyContactStrategy: 'single_active_per_company',
      createdById: 'user-1',
      createdByName: 'Alice'
    });
    const listed = await store.listSequencePolicies({
      organizationId: 'org-1',
      keyword: 'fast',
      status: 'active',
      skip: 0,
      take: 10
    });
    const updated = await store.updateSequencePolicy('policy-1', 'org-1', {
      name: 'Updated fast follow-up',
      steps
    });
    const defaultPolicy = await store.setDefaultSequencePolicy('policy-1', 'org-1');

    assert.equal(prisma.transactionCalls, 3);
    assert.equal(created.steps[1].delayDays, 2);
    assert.equal(created.linkPolicy, 'block_new_links');
    assert.equal(listed.records[0].organizationId, 'org-1');
    assert.equal(updated?.name, 'Updated fast follow-up');
    assert.equal(defaultPolicy?.isDefault, true);
    assert.equal(prisma.crmSequencePolicy.createCalls[0].data.stepDelayDaysText, '0,2,5,9,14');
    assert.equal(
      prisma.crmSequencePolicy.createCalls[0].data.stepThreadModesText,
      'new_subject,same_thread,new_subject,new_subject,new_subject'
    );
    assert.deepEqual(prisma.crmSequencePolicy.findManyCalls[0].where, {
      organizationId: 'org-1',
      status: 'active',
      OR: [
        { name: { contains: 'fast', mode: 'insensitive' } },
        { description: { contains: 'fast', mode: 'insensitive' } }
      ]
    });
    assert.deepEqual(prisma.crmSequencePolicy.updateManyCalls.at(-1), {
      where: {
        organizationId: 'org-1',
        id: { not: 'policy-1' },
        isDefault: true
      },
      data: { isDefault: false }
    });
  });
});

interface SequencePolicyRecord {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  status: string;
  isDefault: boolean;
  stepDelayDaysText: string;
  stepThreadModesText: string;
  linkPolicy: string;
  allowLowRiskAutoSend: boolean;
  sameCompanyContactStrategy: string;
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

function createSequencePolicy(input: Partial<SequencePolicyRecord> = {}): SequencePolicyRecord {
  return {
    id: 'policy-1',
    organizationId: 'org-1',
    name: 'Default sequence policy',
    description: null,
    status: 'active',
    isDefault: false,
    stepDelayDaysText: '0,3,7,12,18',
    stepThreadModesText: 'new_subject,same_thread,new_subject,new_subject,new_subject',
    linkPolicy: 'preserve_template_links',
    allowLowRiskAutoSend: false,
    sameCompanyContactStrategy: 'single_active_per_company',
    createdById: 'user-1',
    createdByName: 'Alice',
    createdAt: new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: new Date('2026-06-18T09:00:00.000Z'),
    ...input
  };
}

class SequencePolicyPrisma {
  transactionCalls = 0;

  readonly crmSequencePolicy = {
    createCalls: [] as Array<{ data: Partial<SequencePolicyRecord> }>,
    findManyCalls: [] as ListCall[],
    countCalls: [] as Array<{ where: unknown }>,
    updateManyCalls: [] as Array<{ where: unknown; data: Partial<SequencePolicyRecord> }>,
    updateManyAndReturnCalls: [] as Array<{ where: unknown; data: Partial<SequencePolicyRecord>; limit: number }>,
    create: async (args: { data: Partial<SequencePolicyRecord> }) => {
      this.crmSequencePolicy.createCalls.push(args);
      return createSequencePolicy(args.data);
    },
    findMany: async (args: ListCall) => {
      this.crmSequencePolicy.findManyCalls.push(args);
      return [createSequencePolicy()];
    },
    count: async (args: { where: unknown }) => {
      this.crmSequencePolicy.countCalls.push(args);
      return 1;
    },
    updateMany: async (args: { where: unknown; data: Partial<SequencePolicyRecord> }) => {
      this.crmSequencePolicy.updateManyCalls.push(args);
      return { count: 1 };
    },
    updateManyAndReturn: async (args: { where: unknown; data: Partial<SequencePolicyRecord>; limit: number }) => {
      this.crmSequencePolicy.updateManyAndReturnCalls.push(args);
      return [createSequencePolicy(args.data)];
    }
  };

  async $transaction<T>(callback: (tx: this) => Promise<T>) {
    this.transactionCalls += 1;
    return callback(this);
  }
}
