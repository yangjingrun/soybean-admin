import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PrismaCrmEmailTemplateGroupStore } from './prisma-crm-email-template-group.store';
import type { CrmEmailTemplateStepInput } from '../crm.types';

describe('PrismaCrmEmailTemplateGroupStore', () => {
  it('creates, lists, updates and sets default organization email template groups', async () => {
    const prisma = new EmailTemplateGroupPrisma();
    const store = new PrismaCrmEmailTemplateGroupStore(prisma as never);
    const steps = createEmailTemplateSteps();

    const created = await store.createEmailTemplateGroup({
      organizationId: 'org-1',
      name: 'Distributor follow-up',
      language: 'en',
      description: 'Default distributor sequence',
      status: 'active',
      isDefault: false,
      steps,
      createdById: 'user-1',
      createdByName: 'Alice'
    });
    const listed = await store.listEmailTemplateGroups({
      organizationId: 'org-1',
      keyword: 'distributor',
      status: 'active',
      skip: 0,
      take: 10
    });
    const updated = await store.updateEmailTemplateGroup('template-group-1', 'org-1', {
      name: 'Updated distributor follow-up',
      steps
    });
    const defaultGroup = await store.setDefaultEmailTemplateGroup('template-group-1', 'org-1');

    assert.equal(prisma.transactionCalls, 3);
    assert.equal(created.steps.length, 5);
    assert.equal(listed.records[0].organizationId, 'org-1');
    assert.equal(updated?.name, 'Updated distributor follow-up');
    assert.equal(defaultGroup?.isDefault, true);
    assert.equal(prisma.crmEmailTemplateGroup.createCalls[0].data.organizationId, 'org-1');
    assert.deepEqual(prisma.crmEmailTemplateGroup.findManyCalls[0].where, {
      organizationId: 'org-1',
      status: 'active',
      OR: [
        { name: { contains: 'distributor', mode: 'insensitive' } },
        { description: { contains: 'distributor', mode: 'insensitive' } }
      ]
    });
    assert.equal(prisma.crmEmailTemplateGroup.updateManyAndReturnCalls[0].where.organizationId, 'org-1');
    assert.equal(prisma.crmEmailTemplateStep.deleteManyCalls[0].where.templateGroupId, 'template-group-1');
    assert.equal(prisma.crmEmailTemplateStep.createManyCalls[0].data.length, 5);
    assert.deepEqual(prisma.crmEmailTemplateGroup.updateManyCalls[0], {
      where: {
        organizationId: 'org-1',
        id: { not: 'template-group-1' },
        isDefault: true
      },
      data: { isDefault: false }
    });
  });
});

interface TemplateStepRecord extends CrmEmailTemplateStepInput {
  id: string;
  organizationId: string;
  templateGroupId: string;
  createdAt: Date;
  updatedAt: Date;
}

interface TemplateGroupRecord {
  id: string;
  organizationId: string;
  name: string;
  language: string;
  description: string | null;
  status: string;
  isDefault: boolean;
  createdById: string;
  createdByName: string | null;
  createdAt: Date;
  updatedAt: Date;
  steps: TemplateStepRecord[];
}

interface ListCall {
  where: unknown;
  skip?: number;
  take?: number;
  orderBy?: unknown;
  include?: unknown;
}

function createEmailTemplateSteps(): CrmEmailTemplateStepInput[] {
  return [1, 2, 3, 4, 5].map(stepIndex => ({
    stepIndex,
    name: `Step ${stepIndex}`,
    threadMode: stepIndex === 2 ? 'same_thread' : 'new_subject',
    delayDays: stepIndex === 1 ? 0 : stepIndex * 2,
    subjectTemplate: stepIndex === 2 ? '' : `Subject ${stepIndex}`,
    bodyTemplate: `Body ${stepIndex}`
  }));
}

function createTemplateStep(input: Partial<TemplateStepRecord> = {}): TemplateStepRecord {
  return {
    id: `template-step-${input.stepIndex ?? 1}`,
    organizationId: 'org-1',
    templateGroupId: 'template-group-1',
    stepIndex: 1,
    name: 'Step 1',
    threadMode: 'new_subject',
    delayDays: 0,
    subjectTemplate: 'Subject 1',
    bodyTemplate: 'Body 1',
    createdAt: new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: new Date('2026-06-18T09:00:00.000Z'),
    ...input
  };
}

function createTemplateGroup(input: Partial<TemplateGroupRecord> = {}): TemplateGroupRecord {
  const steps = createEmailTemplateSteps().map(step => createTemplateStep(step));

  return {
    id: 'template-group-1',
    organizationId: 'org-1',
    name: 'Distributor follow-up',
    language: 'en',
    description: 'Default distributor sequence',
    status: 'active',
    isDefault: false,
    createdById: 'user-1',
    createdByName: 'Alice',
    createdAt: new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: new Date('2026-06-18T09:00:00.000Z'),
    steps,
    ...input
  };
}

class EmailTemplateGroupPrisma {
  transactionCalls = 0;
  private latestGroupData: Partial<TemplateGroupRecord> = {};

  readonly crmEmailTemplateGroup = {
    createCalls: [] as Array<{ data: Partial<TemplateGroupRecord> }>,
    findManyCalls: [] as ListCall[],
    countCalls: [] as Array<{ where: unknown }>,
    findUniqueCalls: [] as Array<{ where: unknown; include?: unknown }>,
    updateManyCalls: [] as Array<{ where: { organizationId?: string; id?: unknown; isDefault?: boolean }; data: Partial<TemplateGroupRecord> }>,
    updateManyAndReturnCalls: [] as Array<{
      where: { id?: string; organizationId?: string; status?: string };
      data: Partial<TemplateGroupRecord>;
      limit: number;
    }>,
    create: async (args: { data: Partial<TemplateGroupRecord> }) => {
      this.crmEmailTemplateGroup.createCalls.push(args);
      this.latestGroupData = args.data;
      return createTemplateGroup(args.data);
    },
    findMany: async (args: ListCall) => {
      this.crmEmailTemplateGroup.findManyCalls.push(args);
      return [createTemplateGroup()];
    },
    count: async (args: { where: unknown }) => {
      this.crmEmailTemplateGroup.countCalls.push(args);
      return 1;
    },
    findUnique: async (args: { where: unknown; include?: unknown }) => {
      this.crmEmailTemplateGroup.findUniqueCalls.push(args);
      return createTemplateGroup(this.latestGroupData);
    },
    updateMany: async (args: { where: { organizationId?: string; id?: unknown; isDefault?: boolean }; data: Partial<TemplateGroupRecord> }) => {
      this.crmEmailTemplateGroup.updateManyCalls.push(args);
      return { count: 1 };
    },
    updateManyAndReturn: async (args: {
      where: { id?: string; organizationId?: string; status?: string };
      data: Partial<TemplateGroupRecord>;
      limit: number;
    }) => {
      this.crmEmailTemplateGroup.updateManyAndReturnCalls.push(args);
      this.latestGroupData = { ...this.latestGroupData, ...args.data };
      return [createTemplateGroup(args.data)];
    }
  };

  readonly crmEmailTemplateStep = {
    createManyCalls: [] as Array<{ data: Array<Partial<TemplateStepRecord>> }>,
    deleteManyCalls: [] as Array<{ where: { organizationId?: string; templateGroupId?: string } }>,
    createMany: async (args: { data: Array<Partial<TemplateStepRecord>> }) => {
      this.crmEmailTemplateStep.createManyCalls.push(args);
      return { count: args.data.length };
    },
    deleteMany: async (args: { where: { organizationId?: string; templateGroupId?: string } }) => {
      this.crmEmailTemplateStep.deleteManyCalls.push(args);
      return { count: 5 };
    }
  };

  async $transaction<T>(callback: (tx: this) => Promise<T>) {
    this.transactionCalls += 1;
    return callback(this);
  }
}
