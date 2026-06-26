import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AiGatewayService } from '../ai-gateway/ai-gateway.service';
import { leadMatchAnalyzePromptKey } from '../ai-gateway/ai-gateway.constants';
import { AiLeadPrecisionAnalysisService } from './ai-lead-precision-analysis.service';
import type { AiLeadSearchCandidate } from './ai-lead-search-orchestrator.service';

describe('AiLeadPrecisionAnalysisService', () => {
  it('asks AI to score candidates with Serper and website evidence', async () => {
    const aiGateway = createAiGateway([
      {
        text: JSON.stringify({
          candidates: [
            {
              dedupeKey: 'https://abc.example.com',
              score: 88,
              priority: 'high',
              buyerType: 'elevator component distributor',
              customerGroup: '海外电梯配件经销商',
              companyCountry: '土耳其',
              targetMarketFit: 'target',
              reason: '官网展示 elevator bearing 和 contact 邮箱',
              matchedSignals: ['elevator bearing', 'sales@abc.example.com'],
              risks: [],
              recommendedAction: '优先开发',
              reviewRequired: false,
              emailWritingContext: {
                companyBackgroundSummary: 'ABC Bearing serves elevator maintenance and component distribution customers.',
                industryChainPosition: 'Local elevator component distributor',
                mainProducts: ['elevator bearings', 'traction machine spare parts'],
                servedIndustries: ['elevator maintenance'],
                businessModel: 'Distributor with local sourcing support',
                productFitSummary: 'The site mentions elevator bearing supply, matching the product line.',
                recentBusinessTriggers: ['Maintains spare-part sourcing pages for elevator customers'],
                recommendedFirstEmailAngle: 'Open with elevator bearing designation comparison for their sourcing work.',
                negativeRelevanceSignals: [],
                confidenceScore: 88,
                evidenceItems: [
                  {
                    type: 'company_background',
                    url: 'https://abc.example.com/about',
                    text: 'ABC Bearing serves elevator maintenance customers.'
                  },
                  {
                    type: 'product',
                    url: 'https://abc.example.com/products',
                    text: 'Elevator bearing and traction machine spare parts.'
                  }
                ]
              }
            }
          ]
        })
      }
    ]);
    const service = new AiLeadPrecisionAnalysisService(aiGateway as unknown as AiGatewayService);

    const result = await service.analyzeCandidates(
      {
        requirement: '找电梯曳引机轴承客户',
        keywordPlan: {
          resolvedProductKeywords: 'traction machine bearing',
          resolvedTargetCustomerProfile: 'elevator component distributor',
          leadContextSnapshot: {
            targetRegion: {
              value: 'country:TR:Turkey',
              label: '土耳其',
              countryCode: 'TR'
            },
            targetCustomerTypes: [
              {
                key: 'distributor_dealer',
                label: '经销商/代理商',
                description: '服务本地渠道或行业客户',
                promptHint: 'distributor, dealer'
              }
            ],
            exclusionRules: [
              {
                key: 'china_supplier',
                label: '中国供应商/出口商',
                description: '排除中国官网、中国制造商、Alibaba/Made-in-China 等供应商来源',
                promptHint: 'exclude China supplier'
              },
              {
                key: 'b2c_only',
                label: '纯 B2C 零售站',
                description: '排除只面向个人消费者的购物站',
                promptHint: 'exclude B2C-only shops'
              }
            ],
            keywordText: 'traction machine bearing',
            supplementalRequirement: '只找本地经销商',
            targetLeadCount: 20
          },
          productLineSnapshot: {
            id: 'product-line-1',
            name: 'Elevator traction machine bearings',
            targetCustomerType: '电梯配件经销商',
            commonModelsText: '6204, 6305'
          }
        },
        candidates: [
          {
            dedupeKey: 'https://abc.example.com',
            sourceType: 'organic',
            title: 'ABC Bearing',
            website: 'https://abc.example.com',
            snippet: 'bearing supplier',
            websiteEvidence: {
              crawlStatus: 'completed',
              pageCount: 1,
              finalUrl: 'https://abc.example.com',
              title: 'ABC Bearing',
              description: '',
              emails: ['sales@abc.example.com'],
              phones: [],
              socialLinks: [],
              whatsappLinks: [],
              mapLinks: [],
              contactLinks: ['https://abc.example.com/contact'],
              keywordHits: ['bearing', 'elevator'],
              evidenceSnippets: ['elevator bearing supplier'],
              evidenceItems: [
                {
                  type: 'product',
                  url: 'https://abc.example.com/products',
                  text: 'elevator bearing supplier'
                }
              ],
              companyAddressEvidence: [],
              companyCountrySignals: [],
              negativeKeywordHits: [],
              negativeEvidenceSnippets: [],
              failureReason: null
            }
          } as AiLeadSearchCandidate
        ]
      },
      { user: { userId: 'u-1' } as never }
    );

    assert.equal(aiGateway.calls[0].promptKey, leadMatchAnalyzePromptKey);
    assert.match(aiGateway.calls[0].prompt, /找电梯曳引机轴承客户/);
    assert.match(aiGateway.calls[0].prompt, /Elevator traction machine bearings/);
    assert.match(aiGateway.calls[0].prompt, /6204, 6305/);
    assert.match(aiGateway.calls[0].prompt, /leadContextSnapshot/);
    assert.match(aiGateway.calls[0].prompt, /exclusionDecisionRules/);
    assert.match(aiGateway.calls[0].prompt, /中国供应商\/出口商/);
    assert.match(aiGateway.calls[0].prompt, /China brands、made in China、manufacturer in China/);
    assert.match(aiGateway.calls[0].prompt, /纯 B2C 零售站/);
    assert.match(aiGateway.calls[0].prompt, /sales@abc\.example\.com/);

    const promptPayload = JSON.parse(aiGateway.calls[0].prompt) as {
      analysisGuidance?: {
        websiteTypeGuidance?: string[];
        companyInfoChecklist?: string[];
        b2bRoleGuidance?: {
          buyerSideRoles?: string[];
        };
        contactQualityGuidance?: {
          highQualitySignals?: string[];
        };
        leadValueGuidance?: {
          highValueSignals?: string[];
        };
        productFitGuidance?: {
          fitLevels?: string[];
        };
        scoreAndOutputMapping?: {
          priorityMapping?: string[];
        };
        selectedExclusionGuidance?: Array<{
          key?: string;
          insufficientSignals?: string[];
          decisionPolicy?: string[];
        }>;
      };
    };
    const chinaGuidance = promptPayload.analysisGuidance?.selectedExclusionGuidance?.find(
      guidance => guidance.key === 'china_supplier'
    );

    assert.match(promptPayload.analysisGuidance?.websiteTypeGuidance?.join('\n') ?? '', /SEO 采集页/);
    assert.match(promptPayload.analysisGuidance?.companyInfoChecklist?.join('\n') ?? '', /注册地址/);
    assert.match(promptPayload.analysisGuidance?.b2bRoleGuidance?.buyerSideRoles?.join('\n') ?? '', /Importer/);
    assert.match(promptPayload.analysisGuidance?.contactQualityGuidance?.highQualitySignals?.join('\n') ?? '', /公司域名邮箱/);
    assert.match(promptPayload.analysisGuidance?.leadValueGuidance?.highValueSignals?.join('\n') ?? '', /进口商/);
    assert.match(promptPayload.analysisGuidance?.productFitGuidance?.fitLevels?.join('\n') ?? '', /高匹配/);
    assert.match(promptPayload.analysisGuidance?.scoreAndOutputMapping?.priorityMapping?.join('\n') ?? '', /reject/);
    assert.match(
      JSON.stringify((promptPayload as { outputContract?: unknown }).outputContract ?? {}),
      /emailWritingContext/
    );
    assert.ok(chinaGuidance);
    assert.match(chinaGuidance.insufficientSignals?.join('\n') ?? '', /Made in China/);
    assert.match(chinaGuidance.insufficientSignals?.join('\n') ?? '', /Importer from China/);
    assert.match(chinaGuidance.decisionPolicy?.join('\n') ?? '', /priority=reject/);
    assert.equal(result[0].score, 88);
    assert.equal(result[0].reason, '官网展示 elevator bearing 和 contact 邮箱');
    assert.equal(result[0].precisionAnalysis?.priority, 'high');
    assert.equal(result[0].precisionAnalysis?.customerGroup, '海外电梯配件经销商');
    assert.equal(result[0].precisionAnalysis?.companyCountry, '土耳其');
    assert.equal(result[0].precisionAnalysis?.targetMarketFit, 'target');
    assert.equal(
      result[0].emailWritingContext?.companyBackgroundSummary,
      'ABC Bearing serves elevator maintenance and component distribution customers.'
    );
    assert.deepEqual(result[0].emailWritingContext?.mainProducts, [
      'elevator bearings',
      'traction machine spare parts'
    ]);
    assert.equal(result[0].emailWritingContext?.evidenceItems[0]?.type, 'company_background');
  });

  it('marks failed-crawl candidates for manual review when AI omits a result', async () => {
    const aiGateway = createAiGateway([{ text: JSON.stringify({ candidates: [] }) }]);
    const service = new AiLeadPrecisionAnalysisService(aiGateway as unknown as AiGatewayService);

    const result = await service.analyzeCandidates(
      {
        requirement: '找轴承客户',
        keywordPlan: {},
        candidates: [
          {
            dedupeKey: 'https://broken.example.com',
            sourceType: 'organic',
            title: 'Broken',
            website: 'https://broken.example.com',
            websiteEvidence: {
              crawlStatus: 'failed',
              pageCount: 0,
              emails: [],
              phones: [],
              socialLinks: [],
              whatsappLinks: [],
              mapLinks: [],
              contactLinks: [],
              keywordHits: [],
              evidenceSnippets: [],
              companyAddressEvidence: [],
              companyCountrySignals: [],
              negativeKeywordHits: [],
              negativeEvidenceSnippets: [],
              failureReason: 'TLS failed'
            }
          } as AiLeadSearchCandidate
        ]
      },
      {}
    );

    assert.equal(result[0].score, 45);
    assert.equal(result[0].precisionAnalysis?.priority, 'medium');
    assert.equal(result[0].precisionAnalysis?.reviewRequired, true);
  });

  it('keeps collection going when AI precision output is not valid JSON', async () => {
    const aiGateway = createAiGateway([
      { text: '{"candidates":[{"dedupeKey":"https://abc.example.com","reason":"bad "quote"}]}' }
    ]);
    const service = new AiLeadPrecisionAnalysisService(aiGateway as unknown as AiGatewayService);

    const result = await service.analyzeCandidates(
      {
        requirement: '找轴承客户',
        keywordPlan: {
          productLineSnapshot: {
            id: 'line-1',
            name: 'Bearing',
            targetCustomerType: 'Distributor'
          }
        },
        candidates: [
          {
            dedupeKey: 'https://abc.example.com',
            sourceType: 'organic',
            title: 'ABC Bearing',
            website: 'https://abc.example.com',
            snippet: 'bearing distributor',
            websiteEvidence: {
              crawlStatus: 'completed',
              pageCount: 1,
              emails: [],
              phones: [],
              socialLinks: [],
              whatsappLinks: [],
              mapLinks: [],
              contactLinks: [],
              keywordHits: ['bearing'],
              evidenceSnippets: ['bearing distributor'],
              companyAddressEvidence: [],
              companyCountrySignals: [],
              negativeKeywordHits: [],
              negativeEvidenceSnippets: [],
              failureReason: null
            }
          } as AiLeadSearchCandidate
        ]
      },
      {}
    );

    assert.equal(result[0].score, 60);
    assert.equal(result[0].precisionAnalysis?.priority, 'medium');
    assert.equal(result[0].precisionAnalysis?.reviewRequired, true);
    assert.equal(result[0].reason, '模型返回的精准度 JSON 无法解析，需人工复核');
    assert.deepEqual(result[0].precisionAnalysis?.risks, ['模型返回的精准度 JSON 无法解析，需人工复核']);
    assert.equal(
      result[0].emailWritingContext?.negativeRelevanceSignals[0],
      '模型返回的精准度 JSON 无法解析，需人工复核'
    );
  });

  it('analyzes candidates in batches of three and merges results in original order', async () => {
    const aiGateway = createAiGateway([
      { text: JSON.stringify({ candidates: createAnalysisOutputs(0, 3) }) },
      { text: JSON.stringify({ candidates: createAnalysisOutputs(3, 6) }) },
      { text: JSON.stringify({ candidates: createAnalysisOutputs(6, 7) }) }
    ]);
    const service = new AiLeadPrecisionAnalysisService(aiGateway as unknown as AiGatewayService);

    const result = await service.analyzeCandidates(
      {
        requirement: '找轴承经销商',
        keywordPlan: {
          resolvedProductKeywords: 'bearing',
          resolvedTargetCustomerProfile: 'bearing distributor'
        },
        candidates: Array.from({ length: 7 }, (_, index) => createPrecisionCandidate(index))
      },
      {}
    );

    assert.equal(aiGateway.calls.length, 3);
    assert.deepEqual(
      aiGateway.calls.map(call => (JSON.parse(call.prompt) as { candidates: unknown[] }).candidates.length),
      [3, 3, 1]
    );
    assert.deepEqual(
      result.map(candidate => candidate.dedupeKey),
      [
        'https://batch-0.example.com',
        'https://batch-1.example.com',
        'https://batch-2.example.com',
        'https://batch-3.example.com',
        'https://batch-4.example.com',
        'https://batch-5.example.com',
        'https://batch-6.example.com'
      ]
    );
    assert.deepEqual(
      result.map(candidate => candidate.score),
      [80, 81, 82, 83, 84, 85, 86]
    );
  });

  it('runs up to two precision analysis batches concurrently', async () => {
    const aiGateway = createDeferredAiGateway([
      JSON.stringify({ candidates: createAnalysisOutputs(0, 3) }),
      JSON.stringify({ candidates: createAnalysisOutputs(3, 6) }),
      JSON.stringify({ candidates: createAnalysisOutputs(6, 7) })
    ]);
    const service = new AiLeadPrecisionAnalysisService(aiGateway as unknown as AiGatewayService);

    const analyzePromise = service.analyzeCandidates(
      {
        requirement: '找轴承经销商',
        keywordPlan: {
          resolvedProductKeywords: 'bearing',
          resolvedTargetCustomerProfile: 'bearing distributor'
        },
        candidates: Array.from({ length: 7 }, (_, index) => createPrecisionCandidate(index))
      },
      {}
    );

    await waitForCondition(() => aiGateway.calls.length === 2);
    assert.equal(aiGateway.activeCount, 2);
    assert.equal(aiGateway.maxActiveCount, 2);

    aiGateway.resolveCall(0);
    await waitForCondition(() => aiGateway.calls.length === 3);
    assert.equal(aiGateway.maxActiveCount, 2);

    aiGateway.resolveCall(1);
    aiGateway.resolveCall(2);
    const result = await analyzePromise;

    assert.equal(aiGateway.calls.length, 3);
    assert.deepEqual(
      result.map(candidate => candidate.score),
      [80, 81, 82, 83, 84, 85, 86]
    );
  });

  it('builds a conservative email writing context when AI omits it', async () => {
    const aiGateway = createAiGateway([
      {
        text: JSON.stringify({
          candidates: [
            {
              dedupeKey: 'https://fit.example.com',
              score: 72,
              priority: 'medium',
              buyerType: 'MRO distributor',
              customerGroup: '海外 MRO 维修渠道',
              companyCountry: '阿联酋',
              targetMarketFit: 'target',
              reason: '官网展示 maintenance sourcing 和 bearing spare parts',
              matchedSignals: ['maintenance sourcing', 'bearing spare parts'],
              risks: ['只看到维修场景，未确认库存'],
              recommendedAction: '用备件匹配角度开发',
              reviewRequired: false
            }
          ]
        })
      }
    ]);
    const service = new AiLeadPrecisionAnalysisService(aiGateway as unknown as AiGatewayService);

    const result = await service.analyzeCandidates(
      {
        requirement: '找阿联酋轴承 MRO 客户',
        keywordPlan: {
          resolvedProductKeywords: 'bearing spare parts',
          productLineSnapshot: {
            id: 'line-1',
            name: 'Deep groove bearings',
            targetCustomerType: 'MRO distributors',
            coreSellingPoints: 'designation-based replacement matching'
          }
        },
        candidates: [
          {
            dedupeKey: 'https://fit.example.com',
            sourceType: 'organic',
            title: 'Fit MRO',
            website: 'https://fit.example.com',
            snippet: 'bearing spare parts for maintenance teams',
            websiteEvidence: {
              crawlStatus: 'completed',
              pageCount: 3,
              finalUrl: 'https://fit.example.com',
              title: 'Fit MRO',
              description: 'Industrial MRO sourcing partner',
              emails: ['sales@fit.example.com'],
              phones: ['+971 4 000 0000'],
              socialLinks: ['https://www.linkedin.com/company/fit-mro/'],
              whatsappLinks: ['https://wa.me/97140000000'],
              mapLinks: [],
              contactLinks: ['https://fit.example.com/contact'],
              keywordHits: ['bearing', 'spare parts', 'maintenance'],
              evidenceSnippets: ['bearing spare parts for maintenance teams'],
              evidenceItems: [
                {
                  type: 'company_background',
                  url: 'https://fit.example.com/about',
                  text: 'Industrial MRO sourcing partner for UAE maintenance teams.'
                },
                {
                  type: 'product',
                  url: 'https://fit.example.com/products',
                  text: 'Bearing spare parts for maintenance teams.'
                },
                {
                  type: 'negative_relevance',
                  url: 'https://fit.example.com/services',
                  text: 'Only limited stock information is published.'
                }
              ],
              companyAddressEvidence: ['Address: Dubai, United Arab Emirates'],
              companyCountrySignals: ['阿联酋'],
              negativeKeywordHits: ['limited stock'],
              negativeEvidenceSnippets: ['Only limited stock information is published'],
              failureReason: null
            }
          } as AiLeadSearchCandidate
        ]
      },
      {}
    );

    assert.equal(result[0].emailWritingContext?.industryChainPosition, '海外 MRO 维修渠道');
    assert.match(result[0].emailWritingContext?.productFitSummary ?? '', /bearing spare parts/);
    assert.match(result[0].emailWritingContext?.recommendedFirstEmailAngle ?? '', /备件匹配/);
    assert.deepEqual(result[0].emailWritingContext?.negativeRelevanceSignals, [
      '只看到维修场景，未确认库存',
      'Only limited stock information is published'
    ]);
    assert.equal(
      result[0].emailWritingContext?.evidenceItems.some(item => item.text.includes('sales@fit.example.com')),
      false
    );
    assert.equal(
      result[0].emailWritingContext?.evidenceItems.some(item => item.text.includes('wa.me')),
      false
    );
  });

  it('rejects official China companies for overseas lead requirements even when product page evidence is strong', async () => {
    const aiGateway = createAiGateway([
      {
        text: JSON.stringify({
          candidates: [
            {
              dedupeKey: 'fluorined-chemical.com',
              score: 3,
              priority: 'reject',
              buyerType: '非目标海外化工/备件网站',
              reason: '官网主体是化工相关，不符合目标',
              matchedSignals: ['化工类目'],
              risks: ['中国邮箱和电话'],
              recommendedAction: '不纳入开发名单',
              reviewRequired: false
            }
          ]
        })
      }
    ]);
    const service = new AiLeadPrecisionAnalysisService(aiGateway as unknown as AiGatewayService);

    const result = await service.analyzeCandidates(
      {
        requirement: '我是河北卖轴承的，主打 6203及以上 轴承，找阿联酋进口商和经销商',
        keywordPlan: {
          resolvedProductKeywords: '6203 bearing',
          resolvedTargetRegions: '阿联酋',
          resolvedTargetCustomerProfile: 'bearing importer and distributor'
        },
        candidates: [
          {
            dedupeKey: 'fluorined-chemical.com',
            sourceType: 'organic',
            title: '6203 Deep Groove Ball Bearing Suppliers',
            website: 'https://www.fluorined-chemical.com/others/ball-bearing/radial-load-bearings-6203-deep-groove-ball.html',
            snippet: 'Professional supplier of 6203 deep groove ball bearing.',
            websiteEvidence: {
              crawlStatus: 'completed',
              pageCount: 3,
              finalUrl:
                'https://www.fluorined-chemical.com/others/ball-bearing/radial-load-bearings-6203-deep-groove-ball.html',
              title: '6203 Deep Groove Ball Bearing Suppliers',
              description: 'Professional supplier of 6203 deep groove ball bearing.',
              emails: ['susan@xmjuda.com'],
              phones: ['+86-592-5803997'],
              socialLinks: [],
              whatsappLinks: [],
              mapLinks: [],
              contactLinks: ['https://www.fluorined-chemical.com/contact-us'],
              keywordHits: ['6203 bearing', 'bearing', 'products'],
              evidenceSnippets: ['6203 deep groove ball bearing professional supplier'],
              companyAddressEvidence: [
                'العنوان:الغرفة 1102، الوحدة C، مركز Xinjing، رقم 25 طريق Jiahe، منطقة Siming، Xiamen، Fujan، الصين'
              ],
              companyCountrySignals: ['中国'],
              negativeKeywordHits: ['chemical'],
              negativeEvidenceSnippets: ['fluorinated chemical products'],
              failureReason: null
            }
          } as AiLeadSearchCandidate
        ]
      },
      {}
    );

    assert.equal(result[0].score, 25);
    assert.equal(result[0].precisionAnalysis?.priority, 'reject');
    assert.equal(result[0].precisionAnalysis?.customerGroup, '中国供应商 / 非目标海外客户');
    assert.equal(result[0].precisionAnalysis?.companyCountry, '中国');
    assert.equal(result[0].precisionAnalysis?.targetMarketFit, 'outside_target');
    assert.equal(result[0].precisionAnalysis?.reviewRequired, false);
    assert.match(result[0].reason ?? '', /官网地址显示中国公司/);
    assert.match(result[0].precisionAnalysis?.matchedSignals.join(' ') ?? '', /Xinjing/);
    assert.match(result[0].precisionAnalysis?.risks.join(' ') ?? '', /产品页命中目标产品/);
  });

  it('honors user-selected China supplier exclusion during precision analysis', async () => {
    const aiGateway = createAiGateway([
      {
        text: JSON.stringify({
          candidates: [
            {
              dedupeKey: 'cn-bearing.example.com',
              score: 78,
              priority: 'high',
              buyerType: 'bearing supplier',
              customerGroup: '轴承供应商',
              companyCountry: '',
              targetMarketFit: 'uncertain',
              reason: '官网产品页命中 6203 bearing',
              matchedSignals: ['6203 bearing'],
              risks: [],
              recommendedAction: '可开发',
              reviewRequired: false
            }
          ]
        })
      }
    ]);
    const service = new AiLeadPrecisionAnalysisService(aiGateway as unknown as AiGatewayService);

    const result = await service.analyzeCandidates(
      {
        requirement: '找轴承客户',
        keywordPlan: {
          resolvedProductKeywords: '6203 bearing',
          leadContextSnapshot: {
            exclusionRules: [
              {
                key: 'china_supplier',
                label: '中国供应商/出口商',
                description: '排除中国官网、中国制造商、Alibaba/Made-in-China 等供应商来源',
                promptHint: 'exclude China supplier'
              }
            ]
          }
        },
        candidates: [
          {
            dedupeKey: 'cn-bearing.example.com',
            sourceType: 'organic',
            title: '6203 Deep Groove Ball Bearing',
            website: 'https://cn-bearing.example.com/products/6203-bearing',
            snippet: '6203 deep groove ball bearing supplier.',
            websiteEvidence: {
              crawlStatus: 'completed',
              pageCount: 2,
              finalUrl: 'https://cn-bearing.example.com/products/6203-bearing',
              title: '6203 Deep Groove Ball Bearing',
              description: '6203 bearing supplier',
              emails: ['sales@cn-bearing.example.com'],
              phones: ['+86 592 5803997'],
              socialLinks: [],
              whatsappLinks: [],
              mapLinks: [],
              contactLinks: ['https://cn-bearing.example.com/contact'],
              keywordHits: ['6203 bearing'],
              evidenceSnippets: ['6203 deep groove ball bearing supplier'],
              companyAddressEvidence: ['Address: Xiamen, Fujian, China'],
              companyCountrySignals: ['中国'],
              negativeKeywordHits: [],
              negativeEvidenceSnippets: [],
              failureReason: null
            }
          } as AiLeadSearchCandidate
        ]
      },
      {}
    );

    assert.equal(result[0].score, 25);
    assert.equal(result[0].precisionAnalysis?.priority, 'reject');
    assert.equal(result[0].precisionAnalysis?.companyCountry, '中国');
    assert.equal(result[0].precisionAnalysis?.targetMarketFit, 'outside_target');
    assert.match(result[0].reason ?? '', /官网地址显示中国公司/);
    assert.match(result[0].precisionAnalysis?.matchedSignals.join(' ') ?? '', /Xiamen/);
  });

  it('does not force reject when China only appears as product or brand origin text', async () => {
    const aiGateway = createAiGateway([
      {
        text: JSON.stringify({
          candidates: [
            {
              dedupeKey: 'uae-bearing-distributor.example.com',
              score: 82,
              priority: 'high',
              buyerType: 'bearing distributor',
              customerGroup: '中东本地经销商',
              companyCountry: '阿联酋',
              targetMarketFit: 'target',
              reason: '官网有迪拜地址和轴承库存信息',
              matchedSignals: ['Dubai address', 'bearing stock'],
              risks: ['销售 China brands，但不是中国公司地址证据'],
              recommendedAction: '可优先开发',
              reviewRequired: false
            }
          ]
        })
      }
    ]);
    const service = new AiLeadPrecisionAnalysisService(aiGateway as unknown as AiGatewayService);

    const result = await service.analyzeCandidates(
      {
        requirement: '找中东轴承进口商和经销商',
        keywordPlan: {
          resolvedProductKeywords: 'bearing',
          resolvedTargetRegions: '中东',
          leadContextSnapshot: {
            exclusionRules: [
              {
                key: 'china_supplier',
                label: '中国供应商/出口商',
                description: '排除中国官网、中国制造商、Alibaba/Made-in-China 等供应商来源',
                promptHint: 'exclude China supplier'
              }
            ]
          }
        },
        candidates: [
          {
            dedupeKey: 'uae-bearing-distributor.example.com',
            sourceType: 'organic',
            title: 'Bearing distributor in UAE',
            website: 'https://uae-bearing-distributor.example.com',
            snippet: 'American brands, China brands, European brands and Japanese brands are available.',
            websiteEvidence: {
              crawlStatus: 'completed',
              pageCount: 2,
              finalUrl: 'https://uae-bearing-distributor.example.com/contact',
              title: 'Bearing distributor in UAE',
              description: 'bearing stockist in Dubai',
              emails: ['sales@uae-bearing-distributor.example.com'],
              phones: ['+971 4 881 5547'],
              socialLinks: [],
              whatsappLinks: [],
              mapLinks: [],
              contactLinks: ['https://uae-bearing-distributor.example.com/contact'],
              keywordHits: ['bearing'],
              evidenceSnippets: ['China brands are available', 'manufacturer in China partner line'],
              companyAddressEvidence: ['Address: Jebel Ali Free Zone, Dubai, United Arab Emirates'],
              companyCountrySignals: [],
              negativeKeywordHits: [],
              negativeEvidenceSnippets: [],
              failureReason: null
            }
          } as AiLeadSearchCandidate
        ]
      },
      {}
    );

    assert.equal(result[0].precisionAnalysis?.priority, 'high');
    assert.equal(result[0].precisionAnalysis?.companyCountry, '阿联酋');
    assert.equal(result[0].precisionAnalysis?.targetMarketFit, 'target');
    assert.doesNotMatch(result[0].reason ?? '', /官网地址显示中国公司/);
  });

  it('does not force reject when China only appears in a regional network description', async () => {
    const aiGateway = createAiGateway([
      {
        text: JSON.stringify({
          candidates: [
            {
              dedupeKey: 'ntn.com.sg',
              score: 78,
              priority: 'medium',
              buyerType: 'bearing distributor',
              customerGroup: '沙特本地经销商',
              companyCountry: '沙特阿拉伯',
              targetMarketFit: 'target',
              reason: 'Saudi Arabia 页面展示本地 Dammam 联系方式和轴承产品信息',
              matchedSignals: ['Dammam Head Office', 'sales@universalbearings-sa.com'],
              risks: ['官网 about 页面有亚洲区网络介绍，需人工确认代理关系'],
              recommendedAction: '人工复核后开发',
              reviewRequired: true
            }
          ]
        })
      }
    ]);
    const service = new AiLeadPrecisionAnalysisService(aiGateway as unknown as AiGatewayService);

    const result = await service.analyzeCandidates(
      {
        requirement: '找沙特轴承进口商和经销商',
        keywordPlan: {
          resolvedProductKeywords: 'bearing',
          resolvedTargetRegions: '沙特阿拉伯',
          leadContextSnapshot: {
            exclusionRules: [
              {
                key: 'china_supplier',
                label: '中国供应商/出口商',
                description: '排除中国供应商',
                promptHint: 'exclude China supplier'
              }
            ]
          }
        },
        candidates: [
          {
            dedupeKey: 'ntn.com.sg',
            sourceType: 'organic',
            title: 'Saudi Arabia - NTN Bearing Singapore',
            website: 'https://www.ntn.com.sg/saudi-arabia/',
            snippet: 'NTN bearing distributor in Saudi Arabia',
            websiteEvidence: {
              crawlStatus: 'completed',
              pageCount: 2,
              finalUrl: 'https://www.ntn.com.sg/saudi-arabia/',
              title: 'Saudi Arabia - NTN Bearing Singapore',
              description: 'bearing distributor',
              emails: ['sales@universalbearings-sa.com'],
              phones: ['(966) 138326164'],
              socialLinks: [],
              whatsappLinks: [],
              mapLinks: [],
              contactLinks: ['https://www.ntn.com.sg/contacts/'],
              keywordHits: ['bearing'],
              evidenceSnippets: ['Dammam Head Office', 'bearing products'],
              companyAddressEvidence: [
                'DAMMAM Head Office, 10 street, Dammam, 31421',
                'Across Asia, NTN meets regional needs with value-added products and localized operations in China, South Korea, Singapore, Thailand, and India'
              ],
              companyCountrySignals: ['中国'],
              negativeKeywordHits: [],
              negativeEvidenceSnippets: [],
              failureReason: null
            }
          } as AiLeadSearchCandidate
        ]
      },
      {}
    );

    assert.equal(result[0].precisionAnalysis?.priority, 'medium');
    assert.equal(result[0].precisionAnalysis?.companyCountry, '沙特阿拉伯');
    assert.equal(result[0].precisionAnalysis?.targetMarketFit, 'target');
    assert.doesNotMatch(result[0].reason ?? '', /官网地址显示中国公司/);
  });
});

function createAiGateway(results: Array<{ text: string }>) {
  const calls: Array<{ promptKey?: string; prompt: string }> = [];

  return {
    calls,
    async generateText(dto: { promptKey?: string; prompt: string }) {
      calls.push({ promptKey: dto.promptKey, prompt: dto.prompt });
      const result = results.shift();

      assert.ok(result, 'missing mocked AI result');

      return {
        text: result.text,
        finishReason: 'stop',
        usage: {
          inputTokens: 1,
          outputTokens: 1,
          totalTokens: 2
        }
      };
    }
  };
}

function createDeferredAiGateway(textResults: string[]) {
  const calls: Array<{ promptKey?: string; prompt: string }> = [];
  const pendingCalls: Array<{
    text: string;
    resolve: (value: {
      text: string;
      finishReason: string;
      usage: { inputTokens: number; outputTokens: number; totalTokens: number };
    }) => void;
  }> = [];
  const state = {
    calls,
    activeCount: 0,
    maxActiveCount: 0,
    async generateText(dto: { promptKey?: string; prompt: string }) {
      calls.push({ promptKey: dto.promptKey, prompt: dto.prompt });
      state.activeCount += 1;
      state.maxActiveCount = Math.max(state.maxActiveCount, state.activeCount);
      const text = textResults.shift();

      assert.ok(text, 'missing mocked AI result');

      return await new Promise<{
        text: string;
        finishReason: string;
        usage: { inputTokens: number; outputTokens: number; totalTokens: number };
      }>(resolve => {
        pendingCalls.push({
          text,
          resolve: value => {
            state.activeCount -= 1;
            resolve(value);
          }
        });
      });
    },
    resolveCall(index: number) {
      const call = pendingCalls[index];

      assert.ok(call, `missing deferred AI call ${index}`);
      call.resolve({
        text: call.text,
        finishReason: 'stop',
        usage: {
          inputTokens: 1,
          outputTokens: 1,
          totalTokens: 2
        }
      });
    }
  };

  return state;
}

async function waitForCondition(condition: () => boolean) {
  const deadline = Date.now() + 500;

  while (!condition()) {
    assert.ok(Date.now() < deadline, 'condition was not met before timeout');
    await new Promise(resolve => setTimeout(resolve, 5));
  }
}

function createPrecisionCandidate(index: number): AiLeadSearchCandidate {
  return {
    dedupeKey: `https://batch-${index}.example.com`,
    sourceType: 'organic',
    title: `Batch ${index}`,
    website: `https://batch-${index}.example.com`,
    snippet: 'bearing distributor'
  };
}

function createAnalysisOutputs(startIndex: number, endIndex: number) {
  return Array.from({ length: endIndex - startIndex }, (_, offset) => {
    const index = startIndex + offset;

    return {
      dedupeKey: `https://batch-${index}.example.com`,
      score: 80 + index,
      priority: 'high',
      buyerType: 'bearing distributor',
      customerGroup: '轴承经销商',
      companyCountry: '',
      targetMarketFit: 'target',
      reason: `第 ${index} 个客户匹配`,
      matchedSignals: ['bearing distributor'],
      risks: [],
      recommendedAction: '优先开发',
      reviewRequired: false
    };
  });
}
