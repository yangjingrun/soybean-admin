import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { UnauthorizedException } from '@nestjs/common';
import type { UserInfo } from '../auth/auth.types';
import type { AiGatewayService } from '../ai-gateway/ai-gateway.service';
import type { GenerateAiTextDto } from '../ai-gateway/dto/generate-ai-text.dto';
import {
  defaultAiModelConfigKey,
  leadKeywordOptimizePromptKey,
  leadMapsKeywordOptimizePromptKey
} from '../ai-gateway/ai-gateway.constants';
import type { AiLeadSearchOrchestrator } from './ai-lead-search-orchestrator.service';
import type { LeadSearchProgressReporter } from './ai-lead-search-progress';
import { AiLeadsService } from './ai-leads.service';
import type {
  AiLeadKeywordHistoryRecord,
  AiLeadKeywordHistoryStore,
  SaveKeywordHistoryInput,
  UpdateKeywordHistoryInput
} from './ai-leads.types';

const keywordPlan = {
  resolvedProductKeywords: '6204 bearing',
  resolvedTargetRegions: '沙特阿拉伯',
  resolvedTargetCustomerProfile: '进口商和经销商',
  resolvedTargetLeadCount: null,
  structuredRequirement: '寻找沙特轴承进口商',
  buyerSegments: [],
  serperSearchQueries: [
    {
      endpoint: 'search',
      requestBody: {
        q: '6204 bearing importer Saudi Arabia',
        gl: 'sa',
        hl: 'en',
        location: 'Saudi Arabia',
        num: 10,
        page: 1
      },
      meta: { priority: '高' }
    },
    {
      endpoint: 'search',
      requestBody: {
        q: 'مستورد محامل السعودية',
        gl: 'sa',
        hl: 'ar',
        location: 'Saudi Arabia',
        num: 10,
        page: 1
      },
      meta: { priority: '高' }
    },
    {
      endpoint: 'search',
      requestBody: {
        q: 'موزع محامل الرياض',
        gl: 'sa',
        hl: 'ar',
        location: 'Riyadh, Saudi Arabia',
        num: 10,
        page: 1
      },
      meta: { priority: '高' }
    }
  ],
  serperPlacesQueries: [
    {
      endpoint: 'places',
      requestBody: {
        q: 'مورد محامل الرياض',
        gl: 'sa',
        hl: 'ar',
        location: 'Riyadh, Saudi Arabia',
        num: 10,
        page: 1
      },
      meta: { priority: '高' }
    },
    {
      endpoint: 'places',
      requestBody: {
        q: 'محل محامل جدة',
        gl: 'sa',
        hl: 'ar',
        location: 'Jeddah, Saudi Arabia',
        num: 10,
        page: 1
      },
      meta: { priority: '中' }
    }
  ],
  searchExecutionRules: {
    keep: [],
    exclude: [],
    websiteCheckPages: [],
    dedupeKeys: []
  }
};

const koreaMexicoKeywordPlan = {
  ...keywordPlan,
  resolvedTargetRegions: '韩国、墨西哥',
  serperSearchQueries: [
    {
      endpoint: 'search',
      requestBody: {
        q: '6203 베어링 수입업체 한국',
        gl: 'kr',
        hl: 'ko',
        location: 'South Korea',
        num: 10,
        page: 1
      }
    },
    {
      endpoint: 'search',
      requestBody: {
        q: '베어링 유통업체 서울',
        gl: 'kr',
        hl: 'ko',
        location: 'Seoul, South Korea',
        num: 10,
        page: 1
      }
    },
    {
      endpoint: 'search',
      requestBody: {
        q: 'importador de rodamientos Mexico',
        gl: 'mx',
        hl: 'es',
        location: 'Mexico',
        num: 10,
        page: 1
      }
    },
    {
      endpoint: 'search',
      requestBody: {
        q: 'distribuidor de rodamientos Monterrey',
        gl: 'mx',
        hl: 'es',
        location: 'Monterrey, Mexico',
        num: 10,
        page: 1
      }
    }
  ],
  serperPlacesQueries: []
};

const georgiaKeywordPlan = {
  ...keywordPlan,
  resolvedTargetRegions: '格鲁吉亚',
  searchExecutionRules: {
    ...keywordPlan.searchExecutionRules,
    marketLanguagePlan: [
      {
        marketName: '格鲁吉亚',
        languageName: '格鲁吉亚语',
        languageCode: 'ka',
        localQueryRequired: true,
        reason: '本地经销商和工业品供应商可能使用格鲁吉亚语官网或目录'
      }
    ]
  },
  serperSearchQueries: [
    {
      endpoint: 'search',
      requestBody: {
        q: '6203 bearing importer Georgia',
        gl: 'ge',
        hl: 'en',
        location: 'Georgia',
        num: 10,
        page: 1
      }
    }
  ],
  serperPlacesQueries: []
};

const repairedGeorgiaKeywordPlan = {
  ...georgiaKeywordPlan,
  serperSearchQueries: [
    ...georgiaKeywordPlan.serperSearchQueries,
    {
      endpoint: 'search',
      requestBody: {
        q: 'საკისრების იმპორტიორი საქართველო',
        gl: 'ge',
        hl: 'ka',
        location: 'Georgia',
        num: 10,
        page: 1
      }
    },
    {
      endpoint: 'search',
      requestBody: {
        q: 'საკისრების დისტრიბუტორი თბილისი',
        gl: 'ge',
        hl: 'ka',
        location: 'Tbilisi, Georgia',
        num: 10,
        page: 1
      }
    }
  ]
};

describe('AiLeadsService', () => {
  const user: UserInfo = {
    userId: 'u-1',
    userName: 'Super',
    nickName: null,
    phone: null,
    email: null,
    roles: ['R_SUPER'],
    buttons: [],
    organizationId: 'org-1',
    organizationName: 'Org One',
    organizationRole: 'admin'
  };
  const ordinaryUser: UserInfo = {
    userId: 'u-2',
    userName: 'Operator',
    nickName: null,
    phone: null,
    email: null,
    roles: ['R_USER'],
    buttons: [],
    organizationId: 'org-1',
    organizationName: 'Org One',
    organizationRole: 'member'
  };

  it('uses the fixed keyword optimization prompt and saves the result as current user history', async () => {
    let capturedDto: GenerateAiTextDto | null = null;
    let capturedContext: unknown = null;
    let capturedHistoryInput: SaveKeywordHistoryInput | null = null;
    const aiGatewayService = {
      async generateText(dto: GenerateAiTextDto, context: unknown) {
        capturedDto = dto;
        capturedContext = context;

        return {
          text: JSON.stringify(keywordPlan),
          finishReason: 'stop',
          usage: {
            inputTokens: 12,
            outputTokens: 8,
            totalTokens: 20
          }
        };
      }
    } as unknown as AiGatewayService;
    const historyStore = createHistoryStore({
      async create(input) {
        capturedHistoryInput = input;

        return createHistoryRecord({
          id: 'history-1',
          ...input,
          createdAt: new Date('2026-06-18T01:00:00.000Z'),
          updatedAt: new Date('2026-06-18T01:00:00.000Z')
        });
      }
    });
    const service = new AiLeadsService(aiGatewayService, historyStore);

    const result = await service.optimizeKeywords(
      {
        requirement: '  我是河北卖轴承的，想找沙特进口商  '
      },
      { user }
    );

    assert.ok(capturedDto);
    const optimizeDto = capturedDto as GenerateAiTextDto;

    assert.equal(optimizeDto.modelConfigKey, defaultAiModelConfigKey);
    assert.equal(optimizeDto.promptKey, leadKeywordOptimizePromptKey);
    assert.equal(optimizeDto.maxOutputTokens, 3600);
    assert.match(optimizeDto.prompt, /^我是河北卖轴承的，想找沙特进口商/);
    assert.match(optimizeDto.prompt, /目标市场本地语言查询强约束/);
    assert.match(optimizeDto.prompt, /沙特阿拉伯=阿拉伯语，hl=ar/);
    assert.deepEqual(
      {
        modelConfigKey: optimizeDto.modelConfigKey,
        promptKey: optimizeDto.promptKey,
        maxOutputTokens: optimizeDto.maxOutputTokens
      },
      {
        modelConfigKey: defaultAiModelConfigKey,
        promptKey: leadKeywordOptimizePromptKey,
        maxOutputTokens: 3600
      }
    );
    assert.deepEqual(capturedContext, { user });
    assert.deepEqual(capturedHistoryInput, {
      userId: 'u-1',
      userName: 'Super',
      requirement: '我是河北卖轴承的，想找沙特进口商',
      resultText: JSON.stringify(keywordPlan),
      keywordPlan,
      finishReason: 'stop',
      inputTokens: 12,
      outputTokens: 8,
      totalTokens: 20
    });
    assert.equal(result.text, JSON.stringify(keywordPlan));
    assert.equal(result.historyRecord.id, 'history-1');
    assert.deepEqual(result.keywordPlan, keywordPlan);
  });

  it('uses the Maps keyword prompt when the lead source mode is maps', async () => {
    let capturedDto: GenerateAiTextDto | null = null;
    const mapsKeywordPlan = {
      ...keywordPlan,
      serperSearchQueries: [],
      serperPlacesQueries: [],
      serperMapsQueries: [
        {
          endpoint: 'maps',
          requestBody: {
            q: 'bearing distributor',
            hl: 'en',
            ll: '@41.6469296,-73.2681778,8z',
            page: 1
          },
          meta: { priority: '高' }
        }
      ]
    };
    const aiGatewayService = {
      async generateText(dto: GenerateAiTextDto) {
        capturedDto = dto;

        return {
          text: JSON.stringify(mapsKeywordPlan),
          finishReason: 'stop',
          usage: {
            inputTokens: 12,
            outputTokens: 8,
            totalTokens: 20
          }
        };
      }
    } as unknown as AiGatewayService;
    const historyStore = createHistoryStore();
    const service = new AiLeadsService(aiGatewayService, historyStore);

    const result = await service.optimizeKeywords(
      { requirement: '用地图找美国轴承经销商', leadSourceMode: 'maps' },
      { user }
    );

    assert.equal(capturedDto?.promptKey, leadMapsKeywordOptimizePromptKey);
    assert.deepEqual(result.qualityWarnings, []);
    assert.equal(result.keywordPlan.serperMapsQueries?.[0]?.requestBody.q, 'bearing distributor');
  });

  it('adds generic local-language query requirements when optimizing non-English markets', async () => {
    let capturedDto: GenerateAiTextDto | null = null;
    const aiGatewayService = {
      async generateText(dto: GenerateAiTextDto) {
        capturedDto = dto;

        return {
          text: JSON.stringify(koreaMexicoKeywordPlan),
          finishReason: 'stop',
          usage: {
            inputTokens: 12,
            outputTokens: 8,
            totalTokens: 20
          }
        };
      }
    } as unknown as AiGatewayService;
    const service = new AiLeadsService(aiGatewayService, createHistoryStore());

    await service.optimizeKeywords(
      {
        requirement: '我是中国河北卖轴承的，主打 6203及以上 轴承，找韩国和墨西哥进口商和经销商'
      },
      { user }
    );

    assert.ok(capturedDto);
    const localLanguageDto = capturedDto as GenerateAiTextDto;

    assert.match(localLanguageDto.prompt, /目标市场本地语言查询强约束/);
    assert.match(localLanguageDto.prompt, /韩国=韩语，hl=ko/);
    assert.match(localLanguageDto.prompt, /墨西哥=西班牙语，hl=es/);
    assert.match(localLanguageDto.prompt, /serperSearchQueries[\s\S]*至少输出 2 条当地语言查询/);
    assert.match(localLanguageDto.prompt, /前 6 条 Search 查询/);
    assert.match(localLanguageDto.prompt, /requestBody\.hl 必须使用对应语言代码/);
  });

  it('returns quality warnings instead of blocking keyword plans missing local-language Search queries', async () => {
    const invalidKeywordPlan = {
      ...keywordPlan,
      serperSearchQueries: [
        {
          endpoint: 'search',
          requestBody: {
            q: '6203 bearing importer South Korea',
            gl: 'kr',
            hl: 'en',
            location: 'South Korea',
            num: 10,
            page: 1
          }
        }
      ],
      serperPlacesQueries: []
    };
    let callCount = 0;
    let capturedHistoryInput: SaveKeywordHistoryInput | null = null;
    const aiGatewayService = {
      async generateText() {
        callCount += 1;

        return {
          text: JSON.stringify(invalidKeywordPlan),
          finishReason: 'stop',
          usage: {
            inputTokens: 12,
            outputTokens: 8,
            totalTokens: 20
          }
        };
      }
    } as unknown as AiGatewayService;
    const service = new AiLeadsService(
      aiGatewayService,
      createHistoryStore({
        async create(input) {
          capturedHistoryInput = input;

          return createHistoryRecord(input);
        }
      })
    );

    const result = await service.optimizeKeywords(
      {
        requirement: '我是河北卖轴承的，找韩国进口商和经销商'
      },
      { user }
    );

    assert.equal(callCount, 2);
    assert.match(result.qualityWarnings?.[0] || '', /关键词优化结果缺少韩国韩语 Search 查询/);
    assert.equal(requireCapturedHistoryInput(capturedHistoryInput).resultText, JSON.stringify(invalidKeywordPlan));
  });

  it('repairs keyword plans once when local-language validation fails', async () => {
    const generatedTexts = [JSON.stringify(georgiaKeywordPlan), JSON.stringify(repairedGeorgiaKeywordPlan)];
    const capturedPrompts: string[] = [];
    let capturedHistoryInput: SaveKeywordHistoryInput | null = null;
    const aiGatewayService = {
      async generateText(dto: GenerateAiTextDto) {
        capturedPrompts.push(dto.prompt);

        return {
          text: generatedTexts.shift() || JSON.stringify(repairedGeorgiaKeywordPlan),
          finishReason: 'stop',
          usage: {
            inputTokens: 12,
            outputTokens: 8,
            totalTokens: 20
          }
        };
      }
    } as unknown as AiGatewayService;
    const service = new AiLeadsService(
      aiGatewayService,
      createHistoryStore({
        async create(input) {
          capturedHistoryInput = input;

          return createHistoryRecord(input);
        }
      })
    );

    const result = await service.optimizeKeywords(
      {
        requirement: '我是河北卖轴承的，找格鲁吉亚进口商和经销商'
      },
      { user }
    );

    assert.equal(capturedPrompts.length, 2);
    assert.match(capturedPrompts[1], /关键词优化结果需要修复/);
    assert.match(capturedPrompts[1], /缺少格鲁吉亚格鲁吉亚语 Search 查询/);
    assert.deepEqual(result.keywordPlan, repairedGeorgiaKeywordPlan);
    assert.equal(
      requireCapturedHistoryInput(capturedHistoryInput).resultText,
      JSON.stringify(repairedGeorgiaKeywordPlan)
    );
  });

  it('lists keyword histories for the current user only', async () => {
    let capturedUserId = '';
    const service = new AiLeadsService(
      createAiGatewayService(),
      createHistoryStore({
        async listByUser(userId) {
          capturedUserId = userId;

          return [
            createHistoryRecord({
              id: 'history-latest',
              userId,
              keywordPlan,
              updatedAt: new Date('2026-06-18T02:00:00.000Z')
            })
          ];
        }
      })
    );

    const result = await service.listKeywordHistories({}, { user });

    assert.equal(capturedUserId, 'u-1');
    assert.equal(result.records[0].id, 'history-latest');
    assert.equal(result.records[0].updatedAt, '2026-06-18T02:00:00.000Z');
  });

  it('normalizes keyword history query size before passing it to the store', async () => {
    let capturedTake: number | undefined;
    const service = new AiLeadsService(
      createAiGatewayService(),
      createHistoryStore({
        async listByUser(_userId, take) {
          capturedTake = take;

          return [];
        }
      })
    );

    await service.listKeywordHistories({ size: '20' } as never, { user });

    assert.equal(capturedTake, 20);
  });

  it('updates one keyword history inside the current user boundary', async () => {
    let capturedId = '';
    let capturedUserId = '';
    let capturedInput: UpdateKeywordHistoryInput | undefined;
    const service = new AiLeadsService(
      createAiGatewayService(),
      createHistoryStore({
        async updateByIdForUser(id, userId, input) {
          capturedId = id;
          capturedUserId = userId;
          capturedInput = input;

          return createHistoryRecord({
            id,
            userId,
            ...input,
            updatedAt: new Date('2026-06-18T03:00:00.000Z')
          });
        }
      })
    );

    const result = await service.updateKeywordHistory(
      'history-1',
      {
        requirement: '更新后的需求',
        keywordPlan
      },
      { user }
    );

    assert.equal(capturedId, 'history-1');
    assert.equal(capturedUserId, 'u-1');
    assert.equal(capturedInput!.requirement, '更新后的需求');
    assert.equal(capturedInput!.resultText, JSON.stringify(keywordPlan));
    assert.equal(result.updatedAt, '2026-06-18T03:00:00.000Z');
  });

  it('deletes one keyword history inside the current user boundary', async () => {
    let capturedId = '';
    let capturedUserId = '';
    const service = new AiLeadsService(
      createAiGatewayService(),
      createHistoryStore({
        async deleteByIdForUser(id, userId) {
          capturedId = id;
          capturedUserId = userId;

          return true;
        }
      })
    );

    const result = await service.deleteKeywordHistory('history-1', { user });

    assert.equal(capturedId, 'history-1');
    assert.equal(capturedUserId, 'u-1');
    assert.deepEqual(result, { id: 'history-1' });
  });

  it('passes trimmed stream search requests and reporter to the search orchestrator', async () => {
    let capturedDto: unknown;
    let capturedContext: unknown;
    let capturedReporter: unknown;
    const reporter: LeadSearchProgressReporter = {
      emit() {}
    };
    const searchOrchestrator = {
      async search(dto: unknown, context: unknown, progressReporter: unknown) {
        capturedDto = dto;
        capturedContext = context;
        capturedReporter = progressReporter;

        return { stopReason: '所有查询已完成' };
      }
    } as unknown as AiLeadSearchOrchestrator;
    const service = new AiLeadsService(createAiGatewayService(), createHistoryStore(), undefined, searchOrchestrator);

    const result = await service.searchOrchestrateStream(
      {
        requirement: '  找沙特轴承进口商  ',
        targetLeadCount: 20
      },
      { user },
      reporter
    );

    assert.deepEqual(capturedDto, {
      requirement: '找沙特轴承进口商',
      targetLeadCount: 20
    });
    assert.deepEqual(capturedContext, { user });
    assert.equal(capturedReporter, reporter);
    assert.deepEqual(result, { stopReason: '所有查询已完成' });
  });

  it('requires login before running the synchronous search orchestrator', async () => {
    let called = false;
    const searchOrchestrator = {
      async search() {
        called = true;
      }
    } as unknown as AiLeadSearchOrchestrator;
    const service = new AiLeadsService(createAiGatewayService(), createHistoryStore(), undefined, searchOrchestrator);

    await assert.rejects(
      () =>
        service.searchOrchestrate({
          requirement: '找沙特轴承进口商',
          targetLeadCount: 20
        }),
      UnauthorizedException
    );
    assert.equal(called, false);
  });

  it('requires login before running the stream search orchestrator', async () => {
    let called = false;
    const searchOrchestrator = {
      async search() {
        called = true;
      }
    } as unknown as AiLeadSearchOrchestrator;
    const service = new AiLeadsService(createAiGatewayService(), createHistoryStore(), undefined, searchOrchestrator);

    await assert.rejects(
      () =>
        service.searchOrchestrateStream({
          requirement: '找沙特轴承进口商',
          targetLeadCount: 20
        }),
      UnauthorizedException
    );
    assert.equal(called, false);
  });

  it('returns public synchronous search result without raw traces for ordinary users', async () => {
    const rawResult = createRawSearchResult();
    const searchOrchestrator = {
      async search() {
        return rawResult;
      }
    } as unknown as AiLeadSearchOrchestrator;
    const service = new AiLeadsService(createAiGatewayService(), createHistoryStore(), undefined, searchOrchestrator);

    const result = (await service.searchOrchestrate(
      {
        requirement: '找沙特轴承进口商',
        targetLeadCount: 20
      },
      { user: ordinaryUser }
    )) as {
      summary: { candidateCount: number; actionCount?: number; qualityCheckCount?: number; stopReason?: string };
      candidates: Array<Record<string, unknown>>;
      serperResults: unknown[];
      decisions?: unknown[];
    };

    assert.deepEqual(result.summary, {
      candidateCount: 1
    });
    assert.equal('sourceLabel' in result.candidates[0], false);
    assert.deepEqual(result.serperResults, []);
    assert.equal('decisions' in result, false);
  });

  it('keeps raw synchronous search result visible for super admins', async () => {
    const rawResult = createRawSearchResult();
    const searchOrchestrator = {
      async search() {
        return rawResult;
      }
    } as unknown as AiLeadSearchOrchestrator;
    const service = new AiLeadsService(createAiGatewayService(), createHistoryStore(), undefined, searchOrchestrator);

    const result = await service.searchOrchestrate(
      {
        requirement: '找沙特轴承进口商',
        targetLeadCount: 20
      },
      { user }
    );

    assert.deepEqual(result, rawResult);
  });
});

function createAiGatewayService() {
  return {
    async generateText() {
      throw new Error('generateText should not be called');
    }
  } as unknown as AiGatewayService;
}

function requireCapturedHistoryInput(input: SaveKeywordHistoryInput | null) {
  assert.ok(input);

  return input;
}

function createHistoryStore(overrides: Partial<AiLeadKeywordHistoryStore> = {}): AiLeadKeywordHistoryStore {
  return {
    async create(input) {
      return createHistoryRecord(input);
    },
    async listByUser() {
      return [];
    },
    async updateByIdForUser(id, userId, input) {
      return createHistoryRecord({ id, userId, ...input });
    },
    async deleteByIdForUser() {
      return true;
    },
    ...overrides
  };
}

function createHistoryRecord(input: Partial<AiLeadKeywordHistoryRecord> = {}): AiLeadKeywordHistoryRecord {
  return {
    id: input.id || 'history-id',
    userId: input.userId || 'u-1',
    userName: input.userName ?? 'Super',
    requirement: input.requirement || '找沙特轴承进口商',
    resultText: input.resultText || JSON.stringify(keywordPlan),
    keywordPlan: input.keywordPlan || keywordPlan,
    finishReason: input.finishReason || 'stop',
    inputTokens: input.inputTokens ?? 12,
    outputTokens: input.outputTokens ?? 8,
    totalTokens: input.totalTokens ?? 20,
    createdAt: input.createdAt || new Date('2026-06-18T00:00:00.000Z'),
    updatedAt: input.updatedAt || new Date('2026-06-18T00:00:00.000Z')
  };
}

function createRawSearchResult() {
  return {
    keywordOptimization: keywordPlan,
    keywordOptimizationText: JSON.stringify(keywordPlan),
    qualityWarnings: [],
    serperRequests: [
      {
        endpoint: 'search',
        requestBody: {
          q: '6204 bearing importer Saudi Arabia',
          gl: 'sa',
          hl: 'en',
          location: 'Saudi Arabia',
          num: 10,
          page: 1
        }
      }
    ],
    serperResults: [
      {
        endpoint: 'search',
        requestBody: {
          q: '6204 bearing importer Saudi Arabia',
          gl: 'sa',
          hl: 'en',
          location: 'Saudi Arabia',
          num: 10,
          page: 1
        },
        result: {
          organic: [{ title: 'A', link: 'https://a.example.com', snippet: 'bearing importer' }]
        }
      }
    ],
    decisions: [{ decision: { nextAction: 'stop' } }],
    candidates: [{ sourceType: 'organic', title: 'A', url: 'https://a.example.com', snippet: 'bearing importer' }],
    stopReason: '所有查询已完成'
  };
}
