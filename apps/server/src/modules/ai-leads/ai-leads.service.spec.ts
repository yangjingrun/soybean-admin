import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { UserInfo } from '../auth/auth.types';
import type { AiGatewayService } from '../ai-gateway/ai-gateway.service';
import type { GenerateAiTextDto } from '../ai-gateway/dto/generate-ai-text.dto';
import { defaultAiModelConfigKey, leadKeywordOptimizePromptKey } from '../ai-gateway/ai-gateway.constants';
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

describe('AiLeadsService', () => {
  const user: UserInfo = {
    userId: 'u-1',
    userName: 'Super',
    roles: ['R_SUPER'],
    buttons: []
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

  it('rejects keyword plans missing required local-language Search queries', async () => {
    let saved = false;
    const aiGatewayService = {
      async generateText() {
        return {
          text: JSON.stringify({
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
          }),
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
          saved = true;

          return createHistoryRecord(input);
        }
      })
    );

    await assert.rejects(
      () =>
        service.optimizeKeywords(
          {
            requirement: '我是河北卖轴承的，找韩国进口商和经销商'
          },
          { user }
        ),
      /关键词优化结果缺少韩国韩语 Search 查询/
    );
    assert.equal(saved, false);
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
});

function createAiGatewayService() {
  return {
    async generateText() {
      throw new Error('generateText should not be called');
    }
  } as unknown as AiGatewayService;
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
