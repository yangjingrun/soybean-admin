import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PrismaCrmProductLineStore } from './prisma-crm-product-line.store';
import type { CrmProductLineAiWritingConfig } from '../crm.types';

describe('PrismaCrmProductLineStore', () => {
  it('creates and lists product lines with organization scope only', async () => {
    const prisma = new ProductLinePrisma();
    const store = new PrismaCrmProductLineStore(prisma as never);

    await store.createProductLine({
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
      status: 'active',
      createdById: 'user-1',
      createdByName: 'Alice'
    });
    const result = await store.listProductLines({
      organizationId: 'org-1',
      keyword: 'bearing',
      status: 'active',
      skip: 0,
      take: 20
    });

    assert.equal(prisma.crmProductLine.createCalls[0].data.organizationId, 'org-1');
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
    assert.deepEqual(prisma.crmProductLine.findManyCalls[0].orderBy, { updatedAt: 'desc' });
    assert.equal(result.records[0].id, 'product-line-1');
    assert.equal(result.total, 1);
  });

  it('finds product line by organization name for duplicate checks', async () => {
    const prisma = new ProductLinePrisma();
    const store = new PrismaCrmProductLineStore(prisma as never);

    const productLine = await store.findProductLineByName('org-1', 'Bearing Series');

    assert.equal(productLine?.id, 'product-line-1');
    assert.deepEqual(prisma.crmProductLine.findUniqueCalls[0].where, {
      organizationId_name: {
        organizationId: 'org-1',
        name: 'Bearing Series'
      }
    });
  });

  it('finds and updates product lines through organization scoped identity', async () => {
    const prisma = new ProductLinePrisma();
    const store = new PrismaCrmProductLineStore(prisma as never);

    const found = await store.findProductLineById({
      id: 'product-line-1',
      organizationId: 'org-1'
    });
    const updated = await store.updateProductLine('product-line-1', 'org-1', {
      name: 'Premium Bearing Series',
      status: 'archived'
    });

    assert.equal(found?.id, 'product-line-1');
    assert.equal(updated?.status, 'archived');
    assert.deepEqual(prisma.crmProductLine.findFirstCalls[0].where, {
      id: 'product-line-1',
      organizationId: 'org-1'
    });
    assert.deepEqual(prisma.crmProductLine.updateManyAndReturnCalls[0], {
      where: {
        id: 'product-line-1',
        organizationId: 'org-1'
      },
      data: {
        name: 'Premium Bearing Series',
        status: 'archived'
      },
      limit: 1
    });
  });

  it('persists product line AI writing config through Prisma', async () => {
    const prisma = new ProductLinePrisma();
    const store = new PrismaCrmProductLineStore(prisma as never);
    const aiWritingConfig = createAiWritingConfig();

    const created = await store.createProductLine({
      organizationId: 'org-1',
      name: 'Bearing Series',
      aiWritingConfig,
      status: 'active',
      createdById: 'user-1',
      createdByName: 'User One'
    });
    const updated = await store.updateProductLine(created.id, 'org-1', {
      aiWritingConfig: { ...aiWritingConfig, productEmphasis: 'Focus on sealed bearings.' }
    });

    assert.deepEqual(prisma.crmProductLine.createCalls[0].data.aiWritingConfig, aiWritingConfig);
    assert.deepEqual(created.aiWritingConfig, aiWritingConfig);
    assert.equal(updated?.aiWritingConfig?.productEmphasis, 'Focus on sealed bearings.');
    assert.deepEqual(prisma.crmProductLine.updateManyAndReturnCalls[0].data.aiWritingConfig, {
      ...aiWritingConfig,
      productEmphasis: 'Focus on sealed bearings.'
    });
  });

  it('creates and lists product line AI prompt versions by version descending', async () => {
    const prisma = new ProductLinePrisma();
    const store = new PrismaCrmProductLineStore(prisma as never);
    const aiWritingConfig = createAiWritingConfig();

    const created = await store.createProductLineAiPromptVersion({
      organizationId: 'org-1',
      productLineId: 'product-line-1',
      aiWritingConfig,
      editorId: 'user-1',
      editorName: 'Alice',
      changeSummary: '初始 AI 写信配置'
    });
    const versions = await store.listProductLineAiPromptVersions({
      organizationId: 'org-1',
      productLineId: 'product-line-1'
    });

    assert.equal(created.version, 3);
    assert.deepEqual(prisma.crmProductLineAiPromptVersion.createCalls[0].data, {
      organizationId: 'org-1',
      productLineId: 'product-line-1',
      version: 3,
      aiWritingConfig,
      editorId: 'user-1',
      editorName: 'Alice',
      changeSummary: '初始 AI 写信配置'
    });
    assert.deepEqual(prisma.crmProductLineAiPromptVersion.findManyCalls[0], {
      where: {
        organizationId: 'org-1',
        productLineId: 'product-line-1'
      },
      orderBy: { version: 'desc' }
    });
    assert.deepEqual(
      versions.map(version => version.version),
      [2, 1]
    );
  });

  it('restores product line AI prompt versions in one Prisma transaction', async () => {
    const prisma = new ProductLinePrisma();
    const store = new PrismaCrmProductLineStore(prisma as never);

    const restored = await store.restoreProductLineAiPromptVersion({
      organizationId: 'org-1',
      productLineId: 'product-line-1',
      versionId: 'product-line-prompt-version-1',
      editorId: 'admin-1',
      editorName: 'Admin',
      changeSummary: '恢复版本 1'
    });

    assert.equal(prisma.transactionCalls, 1);
    assert.equal(restored?.productLine.aiWritingConfig?.productEmphasis, 'Historic emphasis.');
    assert.equal(restored?.currentVersion.version, 3);
    assert.deepEqual(prisma.crmProductLineAiPromptVersion.findFirstCalls[0], {
      where: {
        id: 'product-line-prompt-version-1',
        organizationId: 'org-1',
        productLineId: 'product-line-1'
      }
    });
    assert.deepEqual(prisma.crmProductLine.updateManyAndReturnCalls.at(-1), {
      where: {
        id: 'product-line-1',
        organizationId: 'org-1'
      },
      data: {
        aiWritingConfig: restored?.restoredVersion.aiWritingConfig
      },
      limit: 1
    });
    assert.equal(prisma.crmProductLineAiPromptVersion.createCalls.at(-1)?.data.version, 3);
    assert.equal(prisma.crmProductLineAiPromptVersion.createCalls.at(-1)?.data.changeSummary, '恢复版本 1');
  });
});

interface ProductLineRecord {
  id: string;
  organizationId: string;
  name: string;
  targetCustomerType: string | null;
  coreSellingPoints: string | null;
  moq: string | null;
  leadTime: string | null;
  paymentTerms: string | null;
  certifications: string | null;
  catalogUrl: string | null;
  websiteUrl: string | null;
  commonModelsText: string | null;
  aiWritingConfig: CrmProductLineAiWritingConfig | null;
  status: string;
  createdById: string;
  createdByName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface PromptVersionRecord {
  id: string;
  organizationId: string;
  productLineId: string;
  version: number;
  aiWritingConfig: CrmProductLineAiWritingConfig | null;
  editorId: string;
  editorName: string | null;
  changeSummary: string | null;
  createdAt: Date;
}

interface ListCall {
  where: unknown;
  skip?: number;
  take?: number;
  orderBy?: unknown;
}

interface CreateCall<T> {
  data: T;
}

interface UpdateManyAndReturnCall<T> {
  where: unknown;
  data: T;
  limit: number;
}

function createAiWritingConfig(input: Partial<CrmProductLineAiWritingConfig> = {}): CrmProductLineAiWritingConfig {
  return {
    enabled: true,
    commonRequirements: 'Write concise B2B emails.',
    forbiddenClaims: 'Do not invent prices.',
    productEmphasis: 'Focus on supply reliability.',
    steps: ([1, 2, 3, 4, 5] as const).map(stepIndex => ({
      stepIndex,
      prompt: `Prompt ${stepIndex}`
    })),
    ...input
  };
}

function createProductLine(input: Partial<ProductLineRecord> = {}): ProductLineRecord {
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

function createPromptVersion(input: Partial<PromptVersionRecord> = {}): PromptVersionRecord {
  return {
    id: 'product-line-prompt-version-1',
    organizationId: 'org-1',
    productLineId: 'product-line-1',
    version: 1,
    aiWritingConfig: createAiWritingConfig({ productEmphasis: 'Historic emphasis.' }),
    editorId: 'user-1',
    editorName: 'Alice',
    changeSummary: 'AI 写信配置更新',
    createdAt: new Date('2026-06-18T10:00:00.000Z'),
    ...input
  };
}

class ProductLinePrisma {
  transactionCalls = 0;

  readonly crmProductLine = {
    createCalls: [] as Array<CreateCall<Partial<ProductLineRecord>>>,
    findManyCalls: [] as ListCall[],
    countCalls: [] as Array<{ where: unknown }>,
    findUniqueCalls: [] as Array<{ where: unknown }>,
    findFirstCalls: [] as Array<{ where: unknown }>,
    updateManyAndReturnCalls: [] as Array<UpdateManyAndReturnCall<Partial<ProductLineRecord>>>,
    create: async (args: CreateCall<Partial<ProductLineRecord>>) => {
      this.crmProductLine.createCalls.push(args);
      return createProductLine(args.data);
    },
    findMany: async (args: ListCall) => {
      this.crmProductLine.findManyCalls.push(args);
      return [createProductLine()];
    },
    count: async (args: { where: unknown }) => {
      this.crmProductLine.countCalls.push(args);
      return 1;
    },
    findUnique: async (args: { where: unknown }) => {
      this.crmProductLine.findUniqueCalls.push(args);
      return createProductLine();
    },
    findFirst: async (args: { where: unknown }) => {
      this.crmProductLine.findFirstCalls.push(args);
      return createProductLine();
    },
    updateManyAndReturn: async (args: UpdateManyAndReturnCall<Partial<ProductLineRecord>>) => {
      this.crmProductLine.updateManyAndReturnCalls.push(args);
      return [createProductLine(args.data)];
    }
  };

  readonly crmProductLineAiPromptVersion = {
    createCalls: [] as Array<CreateCall<Partial<PromptVersionRecord>>>,
    findFirstCalls: [] as Array<{ where: unknown; orderBy?: unknown }>,
    findManyCalls: [] as Array<{ where: unknown; orderBy?: unknown }>,
    findFirst: async (args: { where: unknown; orderBy?: unknown }) => {
      this.crmProductLineAiPromptVersion.findFirstCalls.push(args);
      if (args.orderBy) {
        return createPromptVersion({ id: 'product-line-prompt-version-2', version: 2 });
      }

      return createPromptVersion();
    },
    create: async (args: CreateCall<Partial<PromptVersionRecord>>) => {
      this.crmProductLineAiPromptVersion.createCalls.push(args);
      return createPromptVersion(args.data);
    },
    findMany: async (args: { where: unknown; orderBy?: unknown }) => {
      this.crmProductLineAiPromptVersion.findManyCalls.push(args);
      return [
        createPromptVersion({ id: 'product-line-prompt-version-2', version: 2 }),
        createPromptVersion({ id: 'product-line-prompt-version-1', version: 1 })
      ];
    }
  };

  async $transaction<T>(callback: (tx: this) => Promise<T>) {
    this.transactionCalls += 1;
    return callback(this);
  }
}
