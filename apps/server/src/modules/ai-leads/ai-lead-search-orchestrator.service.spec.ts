import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { UserInfo } from '../auth/auth.types';
import type { AiGatewayService } from '../ai-gateway/ai-gateway.service';
import { leadKeywordOptimizePromptKey, leadSearchResultDecidePromptKey } from '../ai-gateway/ai-gateway.constants';
import type { SerperClient } from '../ai-gateway/serper-client.service';
import type { SystemLogRecordInput } from '../system-log/system-log.types';
import type { LeadSearchProgressEventInput } from './ai-lead-search-progress';
import { AiLeadSearchOrchestrator } from './ai-lead-search-orchestrator.service';

describe('AiLeadSearchOrchestrator', () => {
  it('runs a bound keyword plan through a query executor without regenerating keywords', async () => {
    const aiGateway = createAiGateway([
      {
        text: JSON.stringify({
          pageQuality: 'medium',
          nextAction: 'stop',
          nextRequest: {
            endpoint: 'search',
            requestBody: {
              q: '',
              gl: 'sa',
              hl: 'en',
              location: 'Saudi Arabia',
              num: 10,
              page: 1
            }
          },
          tbs: null
        })
      }
    ]);
    const serper = createSerperClient([{ organic: [{ title: 'A', link: 'https://a.example.com' }] }]);
    const service = new AiLeadSearchOrchestrator(
      aiGateway as unknown as AiGatewayService,
      serper as unknown as SerperClient,
      createLogRecorder()
    );
    const executedKeys: string[] = [];

    const result = await service.searchWithKeywordPlan(
      {
        requirement: '找轴承进口商',
        targetLeadCount: 20,
        keywordPlan: {
          resolvedProductKeywords: '6204 bearing',
          resolvedTargetRegions: 'Saudi Arabia',
          resolvedTargetCustomerProfile: 'bearing importer',
          resolvedTargetLeadCount: 20,
          serperSearchQueries: [
            {
              q: '6204 bearing importer Saudi Arabia',
              gl: 'sa',
              hl: 'en',
              location: 'Saudi Arabia',
              priority: '高'
            }
          ],
          serperPlacesQueries: []
        }
      },
      { user: createUser() },
      undefined,
      {
        async executeQuery({ requestKey }, runDefault) {
          executedKeys.push(requestKey);

          return runDefault();
        }
      }
    );

    assert.deepEqual(
      aiGateway.calls.map(call => call.promptKey),
      [leadSearchResultDecidePromptKey]
    );
    assert.deepEqual(executedKeys, ['search|6204 bearing importer Saudi Arabia|sa|en|Saudi Arabia|10|1|']);
    assert.equal(result.serperRequests.length, 1);
    assert.equal(result.candidates[0].country, '沙特阿拉伯');
  });

  it('enriches Serper candidates with website evidence and precision analysis', async () => {
    const aiGateway = createAiGateway([
      {
        text: JSON.stringify({
          pageQuality: 'medium',
          nextAction: 'stop',
          nextRequest: {
            endpoint: 'search',
            requestBody: {
              q: '',
              gl: 'sa',
              hl: 'en',
              location: 'Saudi Arabia',
              num: 10,
              page: 1
            }
          },
          tbs: null
        })
      }
    ]);
    const serper = createSerperClient([
      {
        organic: [
          {
            title: 'ABC Bearing',
            link: 'https://abc.example.com',
            snippet: 'bearing supplier'
          }
        ]
      }
    ]);
    const progressEvents: LeadSearchProgressEventInput[] = [];
    const assertCalls: string[] = [];
    const websiteCrawler = {
      async enrichCandidates(candidates: Array<Record<string, unknown>>) {
        return candidates.map(candidate => ({
          ...candidate,
          websiteEvidence: {
            crawlStatus: 'completed',
            pageCount: 1,
            emails: ['sales@abc.example.com'],
            phones: [],
            socialLinks: [],
            whatsappLinks: [],
            mapLinks: [],
            contactLinks: ['https://abc.example.com/contact'],
            keywordHits: ['bearing'],
            evidenceSnippets: ['bearing supplier'],
            failureReason: null
          }
        }));
      }
    };
    const precisionAnalysis = {
      async analyzeCandidates(input: { candidates: Array<Record<string, unknown>> }) {
        return input.candidates.map(candidate => ({
          ...candidate,
          score: 88,
          reason: '官网命中 bearing supplier',
          precisionAnalysis: {
            score: 88,
            priority: 'high',
            buyerType: 'bearing distributor',
            reason: '官网命中 bearing supplier',
            matchedSignals: ['bearing supplier'],
            risks: [],
            recommendedAction: '优先开发',
            reviewRequired: false
          }
        }));
      }
    };
    const service = new AiLeadSearchOrchestrator(
      aiGateway as unknown as AiGatewayService,
      serper as unknown as SerperClient,
      createLogRecorder(),
      undefined,
      websiteCrawler as never,
      precisionAnalysis as never
    );

    const result = await service.searchWithKeywordPlan(
      {
        requirement: '找轴承进口商',
        targetLeadCount: 20,
        keywordPlan: {
          resolvedProductKeywords: '6204 bearing',
          resolvedTargetRegions: 'Saudi Arabia',
          resolvedTargetCustomerProfile: 'bearing importer',
          resolvedTargetLeadCount: 20,
          serperSearchQueries: [{ q: '6204 bearing importer Saudi Arabia', gl: 'sa', hl: 'en' }],
          serperPlacesQueries: []
        }
      },
      { user: createUser() },
      {
        async emit(event) {
          progressEvents.push(event);
        }
      },
      {
        async assertStillRunning() {
          assertCalls.push('assert');
        }
      }
    );

    assert.equal(result.candidates[0].score, 88);
    assert.equal(result.candidates[0].reason, '官网命中 bearing supplier');
    assert.deepEqual(result.candidates[0].websiteEvidence?.emails, ['sales@abc.example.com']);
    assert.equal(result.candidates[0].precisionAnalysis?.priority, 'high');
    assert.ok(progressEvents.some(event => event.stepKey === 'crawl_websites'));
    assert.ok(progressEvents.some(event => event.stepKey === 'analyze_precision'));
    assert.ok(assertCalls.length >= 2);
  });

  it('filters directory organic results before lead search decision analysis', async () => {
    const aiGateway = createAiGateway([
      {
        text: JSON.stringify({
          pageQuality: 'medium',
          nextAction: 'stop',
          nextRequest: {
            endpoint: 'search',
            requestBody: {
              q: '',
              gl: 'ae',
              hl: 'en',
              location: 'United Arab Emirates',
              num: 10,
              page: 1
            }
          },
          tbs: null
        })
      }
    ]);
    const serper = createSerperClient([
      {
        organic: [
          {
            title: 'Industrial Bearing Suppliers in UAE',
            link: 'https://www.yellowpages-uae.com/uae/industrial-bearing',
            snippet: 'Directory of bearing suppliers'
          },
          {
            title: 'ABC Bearing',
            link: 'https://abc.example.com',
            snippet: 'bearing supplier'
          }
        ]
      }
    ]);
    const service = new AiLeadSearchOrchestrator(
      aiGateway as unknown as AiGatewayService,
      serper as unknown as SerperClient,
      createLogRecorder()
    );

    const result = await service.searchWithKeywordPlan(
      {
        requirement: '找阿联酋轴承进口商',
        targetLeadCount: 20,
        keywordPlan: {
          resolvedProductKeywords: 'bearing',
          resolvedTargetRegions: 'United Arab Emirates',
          resolvedTargetCustomerProfile: 'bearing importer',
          resolvedTargetLeadCount: 20,
          serperSearchQueries: [{ q: 'bearing importer UAE', gl: 'ae', hl: 'en' }],
          serperPlacesQueries: []
        }
      },
      { user: createUser() }
    );

    const decisionPrompt = JSON.parse(aiGateway.calls[0].prompt) as {
      serperResult: { organic?: Array<{ link?: string }> };
      providerFilteredSummary: {
        rawOrganicCount: number;
        acceptedOrganicCount: number;
        directorySkippedCount: number;
        directorySkippedSamples: Array<{ domain: string; url: string; reason: string }>;
      };
      collectedLeadCount: number;
    };

    assert.equal(result.candidates.length, 1);
    assert.equal(result.candidates[0].url, 'https://abc.example.com');
    assert.deepEqual(decisionPrompt.serperResult.organic?.map(item => item.link), ['https://abc.example.com']);
    assert.equal(decisionPrompt.providerFilteredSummary.rawOrganicCount, 2);
    assert.equal(decisionPrompt.providerFilteredSummary.acceptedOrganicCount, 1);
    assert.equal(decisionPrompt.providerFilteredSummary.directorySkippedCount, 1);
    assert.equal(decisionPrompt.providerFilteredSummary.directorySkippedSamples[0].domain, 'yellowpages-uae.com');
    assert.equal(
      decisionPrompt.providerFilteredSummary.directorySkippedSamples[0].url,
      'https://www.yellowpages-uae.com/uae/industrial-bearing'
    );
    assert.equal(decisionPrompt.providerFilteredSummary.directorySkippedSamples[0].reason, '匹配黄页/目录来源规则');
    assert.equal(decisionPrompt.collectedLeadCount, 1);
  });

  it('passes dynamic product keywords to website crawler', async () => {
    const aiGateway = createAiGateway([
      {
        text: JSON.stringify({
          pageQuality: 'medium',
          nextAction: 'stop',
          nextRequest: {
            endpoint: 'search',
            requestBody: {
              q: '',
              gl: 'ae',
              hl: 'en',
              location: 'United Arab Emirates',
              num: 10,
              page: 1
            }
          },
          tbs: null
        })
      }
    ]);
    const serper = createSerperClient([
      {
        organic: [
          {
            title: 'Bright LED Supply',
            link: 'https://bright-led.example.com',
            snippet: 'LED lighting distributor'
          }
        ]
      }
    ]);
    let receivedMatchProfile: {
      positiveKeywords: string[];
      negativeKeywords: string[];
      productLineKeywords: string[];
    } | null = null;
    const websiteCrawler = {
      async enrichCandidates(
        candidates: Array<Record<string, unknown>>,
        options?: {
          matchProfile?: {
            positiveKeywords: string[];
            negativeKeywords: string[];
            productLineKeywords: string[];
          };
        }
      ) {
        receivedMatchProfile = options?.matchProfile ?? null;

        return candidates.map(candidate => ({
          ...candidate,
          websiteEvidence: {
            crawlStatus: 'completed',
            pageCount: 1,
            emails: [],
            phones: [],
            socialLinks: [],
            whatsappLinks: [],
            mapLinks: [],
            contactLinks: [],
            keywordHits: options?.matchProfile?.positiveKeywords ?? [],
            evidenceSnippets: ['LED lighting distributor'],
            negativeKeywordHits: options?.matchProfile?.negativeKeywords ?? [],
            negativeEvidenceSnippets: ['school project'],
            failureReason: null
          }
        }));
      }
    };
    const precisionAnalysis = {
      async analyzeCandidates(input: { candidates: Array<Record<string, unknown>> }) {
        return input.candidates;
      }
    };
    const service = new AiLeadSearchOrchestrator(
      aiGateway as unknown as AiGatewayService,
      serper as unknown as SerperClient,
      createLogRecorder(),
      undefined,
      websiteCrawler as never,
      precisionAnalysis as never
    );

    await service.searchWithKeywordPlan(
      {
        requirement: '找阿联酋 LED 灯具进口商',
        targetLeadCount: 20,
        keywordPlan: {
          resolvedProductKeywords: 'LED lighting, LED strip, panel light',
          resolvedTargetRegions: 'United Arab Emirates',
          resolvedTargetCustomerProfile: 'lighting importer',
          resolvedTargetLeadCount: 20,
          structuredRequirement: '寻找阿联酋 LED 灯具进口商，排除学校项目和零售消费者商店。',
          buyerSegments: [
            {
              buyerType: 'lighting importer',
              purchaseReason: 'imports LED lighting products for commercial projects',
              websiteSignals: ['LED catalog', 'lighting brands', 'project supply'],
              priorityContacts: ['Procurement Manager'],
              priorityLevel: '高',
              preferredSerperChannel: 'search'
            },
            {
              buyerType: 'lighting stockist',
              purchaseReason: 'stocks LED strip and panel light products',
              websiteSignals: ['stock list', 'wholesale lighting'],
              priorityContacts: ['Sales Manager'],
              priorityLevel: '中',
              preferredSerperChannel: 'search'
            }
          ],
          serperSearchQueries: [{ q: 'LED lighting importer UAE', gl: 'ae', hl: 'en' }],
          serperPlacesQueries: [],
          searchExecutionRules: {
            keep: ['LED wholesaler', 'project lighting distributor'],
            exclude: ['school', 'consumer retail', 'B2C-only shop']
          },
          productLineSnapshot: {
            name: 'Commercial LED Lighting',
            targetCustomerType: 'project lighting distributor',
            coreSellingPoints: 'LED panel light and LED strip for commercial fit-out',
            commonModelsText: 'panel light 600x600, 24V LED strip'
          }
        }
      },
      { user: createUser() }
    );

    assert.ok(receivedMatchProfile);
    assert.deepEqual(receivedMatchProfile.positiveKeywords.slice(0, 3), ['LED lighting', 'LED strip', 'panel light']);
    assert.ok(receivedMatchProfile.positiveKeywords.includes('lighting importer'));
    assert.ok(receivedMatchProfile.positiveKeywords.includes('LED catalog'));
    assert.ok(receivedMatchProfile.positiveKeywords.includes('lighting stockist'));
    assert.ok(receivedMatchProfile.positiveKeywords.includes('LED wholesaler'));
    assert.ok(receivedMatchProfile.positiveKeywords.includes('LED 灯具'));
    assert.deepEqual(receivedMatchProfile.negativeKeywords, ['school', 'consumer retail', 'B2C-only shop']);
    assert.ok(receivedMatchProfile.productLineKeywords.includes('Commercial LED Lighting'));
    assert.ok(receivedMatchProfile.productLineKeywords.includes('panel light 600x600'));
  });

  it('keeps checkpoint keys distinct for the same query with different time ranges', async () => {
    const aiGateway = createAiGateway([
      {
        text: JSON.stringify({
          pageQuality: 'medium',
          nextAction: 'stop',
          nextRequest: {
            endpoint: 'search',
            requestBody: {
              q: '',
              gl: 'sa',
              hl: 'en',
              location: 'Saudi Arabia',
              num: 10,
              page: 1
            }
          },
          tbs: null
        })
      },
      {
        text: JSON.stringify({
          pageQuality: 'medium',
          nextAction: 'stop',
          nextRequest: {
            endpoint: 'search',
            requestBody: {
              q: '',
              gl: 'sa',
              hl: 'en',
              location: 'Saudi Arabia',
              num: 10,
              page: 1
            }
          },
          tbs: null
        })
      }
    ]);
    const serper = createSerperClient([
      { organic: [{ title: 'Any time', link: 'https://any.example.com' }] },
      { organic: [{ title: 'Past year', link: 'https://year.example.com' }] }
    ]);
    const service = new AiLeadSearchOrchestrator(
      aiGateway as unknown as AiGatewayService,
      serper as unknown as SerperClient,
      createLogRecorder()
    );
    const executedKeys: string[] = [];

    const result = await service.searchWithKeywordPlan(
      {
        requirement: '找轴承进口商',
        targetLeadCount: 20,
        keywordPlan: {
          resolvedProductKeywords: '6204 bearing',
          resolvedTargetRegions: 'Saudi Arabia',
          resolvedTargetCustomerProfile: 'bearing importer',
          resolvedTargetLeadCount: 20,
          serperSearchQueries: [
            {
              requestBody: {
                q: '6204 bearing importer Saudi Arabia',
                gl: 'sa',
                hl: 'en',
                location: 'Saudi Arabia',
                num: 10,
                page: 1
              },
              priority: '高'
            },
            {
              requestBody: {
                q: '6204 bearing importer Saudi Arabia',
                gl: 'sa',
                hl: 'en',
                location: 'Saudi Arabia',
                num: 10,
                page: 1,
                tbs: 'qdr:y'
              },
              priority: '高'
            }
          ],
          serperPlacesQueries: []
        }
      },
      { user: createUser() },
      undefined,
      {
        async executeQuery({ requestKey }, runDefault) {
          executedKeys.push(requestKey);

          return runDefault();
        }
      }
    );

    assert.equal(result.serperRequests.length, 2);
    assert.equal(new Set(executedKeys).size, 2);
    assert.match(executedKeys[1], /qdr:y/);
  });

  it('filters marketplace and auction results out of search candidates', async () => {
    const aiGateway = createAiGateway([
      {
        text: JSON.stringify({
          pageQuality: 'medium',
          nextAction: 'stop',
          nextRequest: {
            endpoint: 'search',
            requestBody: {
              q: '',
              gl: 'tw',
              hl: 'zh',
              location: 'Taiwan',
              num: 10,
              page: 1
            }
          },
          tbs: null
        })
      }
    ]);
    const serper = createSerperClient([
      {
        organic: [
          {
            title: '日本進口 6203 軸承 - 淘寶',
            link: 'https://guangtao.taobao.com/item.htm',
            snippet: '平台商品頁'
          },
          {
            title: '6203 Bearing Co., Ltd.',
            link: 'https://www.bearing-example.com',
            snippet: 'Official B2B bearing supplier'
          },
          {
            title: '6203 軸承 - Yahoo 拍賣',
            link: 'https://tw.bid.yahoo.com/item/123',
            snippet: '拍賣平台'
          }
        ]
      }
    ]);
    const service = new AiLeadSearchOrchestrator(
      aiGateway as unknown as AiGatewayService,
      serper as unknown as SerperClient,
      createLogRecorder()
    );

    const result = await service.searchWithKeywordPlan(
      {
        requirement: '找台湾轴承客户',
        targetLeadCount: 10,
        keywordPlan: {
          resolvedProductKeywords: '6203 bearing',
          resolvedTargetRegions: '台湾',
          resolvedTargetCustomerProfile: '台湾 B2B 经销商',
          resolvedTargetLeadCount: 10,
          serperSearchQueries: [
            {
              requestBody: {
                q: '6203 bearing Taiwan',
                gl: 'tw',
                hl: 'en',
                location: 'Taiwan',
                num: 10,
                page: 1
              },
              priority: '高'
            }
          ],
          serperPlacesQueries: []
        }
      },
      { user: createUser() }
    );

    assert.equal(result.candidates.length, 1);
    assert.equal(result.candidates[0].url, 'https://www.bearing-example.com');
  });

  it('filters marketplace places before candidate enrichment providers can spend quota', async () => {
    const aiGateway = createAiGateway([
      {
        text: JSON.stringify({
          pageQuality: 'medium',
          nextAction: 'stop',
          nextRequest: {
            endpoint: 'places',
            requestBody: {
              q: '',
              gl: 'tw',
              hl: 'zh',
              location: 'Taiwan',
              num: 10,
              page: 1
            }
          },
          tbs: null
        })
      }
    ]);
    const serper = createSerperClient([
      {
        places: [
          {
            title: '6203 Bearing PChome 商城',
            website: 'https://24h.pchome.com.tw/prod/abc',
            address: 'Taipei'
          },
          {
            title: 'ABC Bearing Distributor',
            website: 'https://abc-bearing.example.com',
            address: 'Taichung'
          }
        ]
      }
    ]);
    const service = new AiLeadSearchOrchestrator(
      aiGateway as unknown as AiGatewayService,
      serper as unknown as SerperClient,
      createLogRecorder()
    );

    const result = await service.searchWithKeywordPlan(
      {
        requirement: '找台湾轴承客户',
        targetLeadCount: 10,
        keywordPlan: {
          resolvedProductKeywords: '6203 bearing',
          resolvedTargetRegions: '台湾',
          resolvedTargetCustomerProfile: '台湾 B2B 经销商',
          resolvedTargetLeadCount: 10,
          serperSearchQueries: [],
          serperPlacesQueries: [
            {
              requestBody: {
                q: 'bearing distributor Taiwan',
                gl: 'tw',
                hl: 'en',
                location: 'Taiwan',
                num: 10,
                page: 1
              },
              priority: '高'
            }
          ]
        }
      },
      { user: createUser() }
    );

    assert.equal(result.candidates.length, 1);
    assert.equal(result.candidates[0].website, 'https://abc-bearing.example.com');
  });

  it('continues to the next Search page when the decision action is paginate', async () => {
    const aiGateway = createAiGateway([
      {
        text: JSON.stringify({
          resolvedProductKeywords: '6204 bearing',
          resolvedTargetRegions: 'Saudi Arabia',
          resolvedTargetCustomerProfile: 'bearing importer',
          resolvedTargetLeadCount: 10,
          serperSearchQueries: [
            {
              buyerType: 'importer',
              intent: 'importer',
              q: '6204 bearing importer Saudi Arabia',
              gl: 'sa',
              hl: 'en',
              location: 'Saudi Arabia',
              priority: '高'
            }
          ],
          serperPlacesQueries: []
        })
      },
      {
        text: JSON.stringify({
          pageQuality: 'high',
          nextAction: 'paginate',
          nextRequest: {
            endpoint: 'search',
            requestBody: {
              q: '6204 bearing importer Saudi Arabia',
              gl: 'sa',
              hl: 'en',
              location: 'Saudi Arabia',
              num: 10,
              page: 2
            }
          },
          tbs: null
        })
      },
      {
        text: JSON.stringify({
          pageQuality: 'medium',
          nextAction: 'stop',
          nextRequest: {
            endpoint: 'search',
            requestBody: {
              q: '',
              gl: 'sa',
              hl: 'en',
              location: 'Saudi Arabia',
              num: 10,
              page: 1
            }
          },
          tbs: null
        })
      }
    ]);
    const serper = createSerperClient([
      { organic: [{ title: 'A', link: 'https://a.example.com', snippet: 'bearing importer' }] },
      { organic: [{ title: 'B', link: 'https://b.example.com', snippet: 'bearing distributor' }] }
    ]);
    const service = new AiLeadSearchOrchestrator(
      aiGateway as unknown as AiGatewayService,
      serper as unknown as SerperClient,
      createLogRecorder()
    );

    const result = await service.search({ requirement: '找轴承进口商', targetLeadCount: 20 }, { user: createUser() });

    assert.deepEqual(
      serper.calls.map(call => call.request.page),
      [1, 2]
    );
    assert.deepEqual(
      aiGateway.calls.map(call => call.promptKey),
      [leadKeywordOptimizePromptKey, leadSearchResultDecidePromptKey, leadSearchResultDecidePromptKey]
    );
    assert.equal(result.serperRequests.length, 2);
    assert.equal(result.candidates.length, 2);
    assert.equal(result.stopReason, '所有查询已完成');
  });

  it('uses the required target lead count from the request instead of the keyword plan', async () => {
    const aiGateway = createAiGateway([
      {
        text: JSON.stringify({
          resolvedProductKeywords: '6204 bearing',
          resolvedTargetRegions: 'Saudi Arabia',
          resolvedTargetCustomerProfile: 'bearing importer',
          resolvedTargetLeadCount: 10,
          serperSearchQueries: [
            {
              q: '6204 bearing importer Saudi Arabia',
              gl: 'sa',
              hl: 'en',
              location: 'Saudi Arabia',
              priority: '高'
            }
          ],
          serperPlacesQueries: []
        })
      }
    ]);
    const serper = createSerperClient([
      {
        organic: [
          { title: 'A', link: 'https://a.example.com', snippet: 'bearing importer' },
          { title: 'B', link: 'https://b.example.com', snippet: 'bearing distributor' }
        ]
      }
    ]);
    const service = new AiLeadSearchOrchestrator(
      aiGateway as unknown as AiGatewayService,
      serper as unknown as SerperClient,
      createLogRecorder()
    );
    const dto = { requirement: '找轴承进口商', targetLeadCount: 1 };

    const result = await service.search(dto, { user: createUser() });

    assert.equal(serper.calls.length, 1);
    assert.equal(aiGateway.calls.length, 1);
    assert.equal(result.candidates.length, 2);
    assert.equal(result.stopReason, '已达到候选池目标数量');
  });

  it('counts only CRM-accepted candidates before asking AI whether to paginate', async () => {
    const aiGateway = createAiGateway([
      {
        text: JSON.stringify({
          pageQuality: 'medium',
          nextAction: 'paginate',
          nextRequest: {
            endpoint: 'search',
            requestBody: {
              q: '6204 bearing importer Saudi Arabia',
              gl: 'sa',
              hl: 'en',
              location: 'Saudi Arabia',
              num: 10,
              page: 2
            }
          },
          tbs: null
        })
      },
      {
        text: JSON.stringify({
          pageQuality: 'medium',
          nextAction: 'stop',
          nextRequest: {
            endpoint: 'search',
            requestBody: {
              q: '',
              gl: 'sa',
              hl: 'en',
              location: 'Saudi Arabia',
              num: 10,
              page: 1
            }
          },
          tbs: null
        })
      }
    ]);
    const serper = createSerperClient([
      { organic: createOrganicCandidates('first', 10) },
      { organic: createOrganicCandidates('second', 10) }
    ]);
    const precheckSummaries: Array<{ rawCandidateCount: number; existingSkippedCount: number }> = [];
    const crmPrecheck = {
      async precheckCandidates(input: { candidates: Array<{ title?: string }>; crmPrecheckSummary?: unknown }) {
        const isFirstPage = input.candidates[0]?.title?.startsWith('first');
        const acceptedCandidates = isFirstPage ? input.candidates.slice(0, 1) : input.candidates.slice(0, 1);
        const summary = {
          rawCandidateCount: input.candidates.length,
          acceptedCandidateCount: acceptedCandidates.length,
          existingSkippedCount: isFirstPage ? 9 : 0,
          activeSkippedCount: 0,
          cooldownSkippedCount: 0,
          reactivatedCandidateCount: 0,
          domainlessCandidateCount: 0
        };
        precheckSummaries.push(summary);

        return { acceptedCandidates, summary };
      }
    };
    const service = new AiLeadSearchOrchestrator(
      aiGateway as unknown as AiGatewayService,
      serper as unknown as SerperClient,
      createLogRecorder(),
      crmPrecheck as never
    );

    const result = await service.searchWithKeywordPlan(
      {
        requirement: '找轴承进口商',
        targetLeadCount: 2,
        keywordPlan: {
          resolvedProductKeywords: '6204 bearing',
          resolvedTargetRegions: 'Saudi Arabia',
          resolvedTargetCustomerProfile: 'bearing importer',
          resolvedTargetLeadCount: 2,
          serperSearchQueries: [
            {
              q: '6204 bearing importer Saudi Arabia',
              gl: 'sa',
              hl: 'en',
              location: 'Saudi Arabia',
              priority: '高'
            }
          ],
          serperPlacesQueries: []
        }
      },
      { user: createUser() }
    );

    assert.deepEqual(
      serper.calls.map(call => call.request.page),
      [1, 2]
    );
    assert.equal(result.candidates.length, 2);
    assert.deepEqual(precheckSummaries[0], {
      rawCandidateCount: 10,
      acceptedCandidateCount: 1,
      existingSkippedCount: 9,
      activeSkippedCount: 0,
      cooldownSkippedCount: 0,
      reactivatedCandidateCount: 0,
      domainlessCandidateCount: 0
    });
    assert.equal(JSON.parse(aiGateway.calls[0].prompt).collectedLeadCount, 1);
    assert.equal(JSON.parse(aiGateway.calls[0].prompt).crmPrecheckSummary.existingSkippedCount, 9);
  });

  it('collects a buffered candidate pool without shrinking the last Serper page', async () => {
    const aiGateway = createAiGateway([
      {
        text: JSON.stringify({
          resolvedProductKeywords: '6204 bearing',
          resolvedTargetRegions: 'Saudi Arabia',
          resolvedTargetCustomerProfile: 'bearing importer',
          resolvedTargetLeadCount: 20,
          serperSearchQueries: [
            {
              q: '6204 bearing importer Saudi Arabia',
              gl: 'sa',
              hl: 'en',
              location: 'Saudi Arabia',
              priority: '高'
            }
          ],
          serperPlacesQueries: []
        })
      },
      {
        text: JSON.stringify({
          pageQuality: 'high',
          nextAction: 'paginate',
          nextRequest: {
            endpoint: 'search',
            requestBody: {
              q: '6204 bearing importer Saudi Arabia',
              gl: 'sa',
              hl: 'en',
              location: 'Saudi Arabia',
              num: 10,
              page: 2
            }
          },
          tbs: null
        })
      },
      {
        text: JSON.stringify({
          pageQuality: 'high',
          nextAction: 'paginate',
          nextRequest: {
            endpoint: 'search',
            requestBody: {
              q: '6204 bearing importer Saudi Arabia',
              gl: 'sa',
              hl: 'en',
              location: 'Saudi Arabia',
              num: 10,
              page: 3
            }
          },
          tbs: null
        })
      }
    ]);
    const serper = createSerperClient([
      { organic: createOrganicCandidates('first', 10) },
      { organic: createOrganicCandidates('second', 10) },
      { organic: createOrganicCandidates('third', 10) }
    ]);
    const service = new AiLeadSearchOrchestrator(
      aiGateway as unknown as AiGatewayService,
      serper as unknown as SerperClient,
      createLogRecorder()
    );

    const result = await service.search({ requirement: '找轴承进口商', targetLeadCount: 20 }, { user: createUser() });

    assert.deepEqual(
      serper.calls.map(call => call.request.num),
      [10, 10, 10]
    );
    assert.equal(result.candidates.length, 30);
    assert.equal(result.stopReason, '已达到候选池目标数量');
  });

  it('emits business-safe progress events while orchestrating search collection', async () => {
    const aiGateway = createAiGateway([
      {
        text: JSON.stringify({
          resolvedProductKeywords: '6204 bearing',
          resolvedTargetRegions: 'Saudi Arabia',
          resolvedTargetCustomerProfile: 'bearing importer',
          resolvedTargetLeadCount: 10,
          serperSearchQueries: [
            {
              buyerType: 'importer',
              intent: 'importer',
              q: '6204 bearing importer Saudi Arabia',
              gl: 'sa',
              hl: 'en',
              location: 'Saudi Arabia',
              priority: '高'
            }
          ],
          serperPlacesQueries: []
        })
      },
      {
        text: JSON.stringify({
          pageQuality: 'medium',
          nextAction: 'stop',
          nextRequest: {
            endpoint: 'search',
            requestBody: {
              q: '',
              gl: 'sa',
              hl: 'en',
              location: 'Saudi Arabia',
              num: 10,
              page: 1
            }
          },
          tbs: null
        })
      }
    ]);
    const serper = createSerperClient([
      { organic: [{ title: 'A', link: 'https://a.example.com', snippet: 'bearing importer' }] }
    ]);
    const service = new AiLeadSearchOrchestrator(
      aiGateway as unknown as AiGatewayService,
      serper as unknown as SerperClient,
      createLogRecorder()
    );
    const events: LeadSearchProgressEventInput[] = [];

    await service.search(
      { requirement: '找轴承进口商', targetLeadCount: 20 },
      { user: createUser() },
      {
        emit(event) {
          events.push(event);
        }
      }
    );

    assert.equal(events[0].type, 'workflow_started');
    assert.ok(
      events.some(
        event =>
          event.type === 'step_progress' &&
          event.stepKey === 'collect_public_leads' &&
          event.metrics?.some(metric => metric.label === '采集动作' && metric.value === 1)
      )
    );
    const completed = events.find(event => event.type === 'workflow_completed');
    assert.equal(completed?.result?.summary.actionCount, 1);
    assert.equal(completed?.result?.summary.candidateCount, 1);
    assert.equal(completed?.result?.candidates[0].sourceLabel, '公开线索');
    assert.deepEqual(completed?.result?.serperResults, []);
  });

  it('continues one initial query at most two extra rounds', async () => {
    const aiGateway = createAiGateway([
      {
        text: JSON.stringify({
          resolvedProductKeywords: '6204 bearing',
          resolvedTargetRegions: 'Saudi Arabia',
          resolvedTargetCustomerProfile: 'bearing distributor',
          resolvedTargetLeadCount: null,
          serperSearchQueries: [
            {
              q: '6204 bearing Saudi Arabia',
              gl: 'sa',
              hl: 'en',
              location: 'Saudi Arabia',
              priority: '高'
            }
          ],
          serperPlacesQueries: []
        })
      },
      {
        text: JSON.stringify({
          pageQuality: 'low',
          nextAction: 'requery',
          nextRequest: {
            endpoint: 'search',
            requestBody: {
              q: '6204 bearing distributor Saudi Arabia',
              gl: 'sa',
              hl: 'en',
              location: 'Saudi Arabia',
              num: 10,
              page: 1
            }
          },
          tbs: null
        })
      },
      {
        text: JSON.stringify({
          pageQuality: 'low',
          nextAction: 'requery',
          nextRequest: {
            endpoint: 'search',
            requestBody: {
              q: 'industrial bearing stockist Saudi Arabia',
              gl: 'sa',
              hl: 'en',
              location: 'Saudi Arabia',
              num: 10,
              page: 1
            }
          },
          tbs: null
        })
      },
      {
        text: JSON.stringify({
          pageQuality: 'low',
          nextAction: 'requery',
          nextRequest: {
            endpoint: 'search',
            requestBody: {
              q: 'bearing wholesaler Riyadh',
              gl: 'sa',
              hl: 'en',
              location: 'Riyadh, Saudi Arabia',
              num: 10,
              page: 1
            }
          },
          tbs: null
        })
      }
    ]);
    const serper = createSerperClient([{ organic: [] }, { organic: [] }, { organic: [] }, { organic: [] }]);
    const service = new AiLeadSearchOrchestrator(
      aiGateway as unknown as AiGatewayService,
      serper as unknown as SerperClient,
      createLogRecorder()
    );
    const dto = { requirement: '找轴承经销商', targetLeadCount: 20 };

    await service.search(dto, { user: createUser() });

    assert.deepEqual(
      serper.calls.map(call => call.request.q),
      ['6204 bearing Saudi Arabia', '6204 bearing distributor Saudi Arabia', 'industrial bearing stockist Saudi Arabia']
    );
    assert.equal(aiGateway.calls.length, 4);
  });

  it('adds generic local-language query requirements before search orchestration keyword optimization', async () => {
    const aiGateway = createAiGateway([
      {
        text: JSON.stringify({
          resolvedProductKeywords: '6203 bearing',
          resolvedTargetRegions: 'South Korea, Mexico',
          resolvedTargetCustomerProfile: 'bearing importer and distributor',
          resolvedTargetLeadCount: null,
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
        })
      }
    ]);
    const service = new AiLeadSearchOrchestrator(
      aiGateway as unknown as AiGatewayService,
      createSerperClient([]) as unknown as SerperClient,
      createLogRecorder()
    );

    await service.search(
      {
        requirement: '我是河北卖轴承的，主打 6203及以上 轴承，找韩国和墨西哥进口商和经销商',
        targetLeadCount: 20,
        maxSearchRequests: 0
      },
      { user: createUser() }
    );

    assert.match(aiGateway.calls[0]?.prompt || '', /目标市场本地语言查询强约束/);
    assert.match(aiGateway.calls[0]?.prompt || '', /韩国=韩语，hl=ko/);
    assert.match(aiGateway.calls[0]?.prompt || '', /墨西哥=西班牙语，hl=es/);
    assert.match(aiGateway.calls[0]?.prompt || '', /serperSearchQueries[\s\S]*至少输出 2 条当地语言查询/);
    assert.match(aiGateway.calls[0]?.prompt || '', /前 6 条 Search 查询/);
  });

  it('returns quality warnings and still calls Serper when local-language Search queries are missing', async () => {
    const invalidKeywordPlan = {
      resolvedProductKeywords: '6203 bearing',
      resolvedTargetRegions: 'South Korea',
      resolvedTargetCustomerProfile: 'bearing importer and distributor',
      resolvedTargetLeadCount: null,
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
    const aiGateway = createAiGateway([
      {
        text: JSON.stringify(invalidKeywordPlan)
      },
      {
        text: JSON.stringify(invalidKeywordPlan)
      },
      {
        text: JSON.stringify({
          pageQuality: 'medium',
          nextAction: 'stop',
          nextRequest: {
            endpoint: 'search',
            requestBody: {
              q: '',
              gl: 'kr',
              hl: 'en',
              location: 'South Korea',
              num: 10,
              page: 1
            }
          },
          tbs: null
        })
      }
    ]);
    const serper = createSerperClient([{ organic: [] }]);
    const service = new AiLeadSearchOrchestrator(
      aiGateway as unknown as AiGatewayService,
      serper as unknown as SerperClient,
      createLogRecorder()
    );

    const result = await service.search(
      { requirement: '我是河北卖轴承的，主打 6203及以上 轴承，找韩国进口商和经销商', targetLeadCount: 20 },
      { user: createUser() }
    );

    assert.equal(serper.calls.length, 1);
    assert.match(result.qualityWarnings?.[0] || '', /关键词优化结果缺少韩国韩语 Search 查询/);
  });

  it('repairs keyword plans once before running Serper when local-language validation fails', async () => {
    const invalidGeorgiaPlan = {
      resolvedProductKeywords: '6203 bearing',
      resolvedTargetRegions: 'Georgia',
      resolvedTargetCustomerProfile: 'bearing importer and distributor',
      resolvedTargetLeadCount: null,
      searchExecutionRules: {
        marketLanguagePlan: [
          {
            marketName: '格鲁吉亚',
            languageName: '格鲁吉亚语',
            languageCode: 'ka',
            localQueryRequired: true
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
    const repairedGeorgiaPlan = {
      ...invalidGeorgiaPlan,
      serperSearchQueries: [
        ...invalidGeorgiaPlan.serperSearchQueries,
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
    const aiGateway = createAiGateway([
      { text: JSON.stringify(invalidGeorgiaPlan) },
      { text: JSON.stringify(repairedGeorgiaPlan) },
      {
        text: JSON.stringify({
          pageQuality: 'medium',
          nextAction: 'stop',
          nextRequest: {
            endpoint: 'search',
            requestBody: {
              q: '',
              gl: 'ge',
              hl: 'en',
              location: 'Georgia',
              num: 10,
              page: 1
            }
          },
          tbs: null
        })
      },
      {
        text: JSON.stringify({
          pageQuality: 'medium',
          nextAction: 'stop',
          nextRequest: {
            endpoint: 'search',
            requestBody: {
              q: '',
              gl: 'ge',
              hl: 'ka',
              location: 'Georgia',
              num: 10,
              page: 1
            }
          },
          tbs: null
        })
      },
      {
        text: JSON.stringify({
          pageQuality: 'medium',
          nextAction: 'stop',
          nextRequest: {
            endpoint: 'search',
            requestBody: {
              q: '',
              gl: 'ge',
              hl: 'ka',
              location: 'Tbilisi, Georgia',
              num: 10,
              page: 1
            }
          },
          tbs: null
        })
      }
    ]);
    const serper = createSerperClient([{ organic: [] }, { organic: [] }, { organic: [] }]);
    const service = new AiLeadSearchOrchestrator(
      aiGateway as unknown as AiGatewayService,
      serper as unknown as SerperClient,
      createLogRecorder()
    );

    const result = await service.search(
      { requirement: '我是河北卖轴承的，找格鲁吉亚进口商和经销商', targetLeadCount: 20 },
      { user: createUser() }
    );

    assert.match(aiGateway.calls[1]?.prompt || '', /关键词优化结果需要修复/);
    assert.match(aiGateway.calls[1]?.prompt || '', /缺少格鲁吉亚格鲁吉亚语 Search 查询/);
    assert.equal(serper.calls.length, 3);
    assert.deepEqual(result.keywordOptimization, repairedGeorgiaPlan);
  });

  it('resets to page one when the decision action is requery', async () => {
    const aiGateway = createAiGateway([
      {
        text: JSON.stringify({
          resolvedProductKeywords: '6204 bearing',
          resolvedTargetRegions: 'Saudi Arabia',
          resolvedTargetCustomerProfile: 'bearing importer',
          resolvedTargetLeadCount: null,
          serperSearchQueries: [
            {
              q: '6204 bearing Saudi Arabia',
              gl: 'sa',
              hl: 'en',
              location: 'Saudi Arabia',
              priority: '高'
            }
          ],
          serperPlacesQueries: []
        })
      },
      {
        text: JSON.stringify({
          pageQuality: 'low',
          nextAction: 'requery',
          nextRequest: {
            endpoint: 'search',
            requestBody: {
              q: '6204 bearing distributor Saudi Arabia',
              gl: 'sa',
              hl: 'en',
              location: 'Saudi Arabia',
              num: 10,
              page: 1
            }
          },
          tbs: null
        })
      },
      {
        text: JSON.stringify({
          pageQuality: 'medium',
          nextAction: 'stop',
          nextRequest: {
            endpoint: 'search',
            requestBody: {
              q: '',
              gl: 'sa',
              hl: 'en',
              location: 'Saudi Arabia',
              num: 10,
              page: 1
            }
          },
          tbs: null
        })
      }
    ]);
    const serper = createSerperClient([{ organic: [] }, { organic: [] }]);
    const service = new AiLeadSearchOrchestrator(
      aiGateway as unknown as AiGatewayService,
      serper as unknown as SerperClient,
      createLogRecorder()
    );

    await service.search({ requirement: '找轴承进口商', targetLeadCount: 20 }, { user: createUser() });

    assert.deepEqual(
      serper.calls.map(call => call.request),
      [
        {
          q: '6204 bearing Saudi Arabia',
          gl: 'sa',
          hl: 'en',
          location: 'Saudi Arabia',
          num: 10,
          page: 1
        },
        {
          q: '6204 bearing distributor Saudi Arabia',
          gl: 'sa',
          hl: 'en',
          location: 'Saudi Arabia',
          num: 10,
          page: 1
        }
      ]
    );
  });

  it('reads nested Serper request bodies from keyword optimization queries', async () => {
    const aiGateway = createAiGateway([
      {
        text: JSON.stringify({
          resolvedProductKeywords: '6204 bearing',
          resolvedTargetRegions: 'Saudi Arabia',
          resolvedTargetCustomerProfile: 'bearing importer',
          resolvedTargetLeadCount: null,
          serperSearchQueries: [
            {
              endpoint: 'search',
              requestBody: {
                q: '6204 bearing importer Saudi Arabia',
                gl: 'sa',
                hl: 'en',
                location: 'Saudi Arabia',
                num: 10,
                page: 1,
                tbs: 'qdr:y'
              },
              meta: {
                priority: '中'
              }
            }
          ],
          serperPlacesQueries: [
            {
              endpoint: 'places',
              requestBody: {
                q: 'bearing supplier Riyadh',
                gl: 'sa',
                hl: 'en',
                location: 'Riyadh, Saudi Arabia',
                num: 10,
                page: 1
              },
              meta: {
                priority: '高'
              }
            }
          ]
        })
      },
      {
        text: JSON.stringify({
          pageQuality: 'medium',
          nextAction: 'stop',
          nextRequest: {
            endpoint: 'search',
            requestBody: {
              q: '',
              gl: 'sa',
              hl: 'en',
              location: 'Saudi Arabia',
              num: 10,
              page: 1
            }
          },
          tbs: null
        })
      },
      {
        text: JSON.stringify({
          pageQuality: 'medium',
          nextAction: 'stop',
          nextRequest: {
            endpoint: 'places',
            requestBody: {
              q: '',
              gl: 'sa',
              hl: 'en',
              location: 'Riyadh, Saudi Arabia',
              num: 10,
              page: 1
            }
          },
          tbs: null
        })
      }
    ]);
    const serper = createSerperClient([{ organic: [] }, { places: [] }]);
    const service = new AiLeadSearchOrchestrator(
      aiGateway as unknown as AiGatewayService,
      serper as unknown as SerperClient,
      createLogRecorder()
    );

    await service.search({ requirement: '找轴承进口商', targetLeadCount: 20 }, { user: createUser() });

    assert.deepEqual(
      serper.calls.map(call => call.endpoint),
      ['search', 'places']
    );
    assert.deepEqual(serper.calls[0].request, {
      q: '6204 bearing importer Saudi Arabia',
      gl: 'sa',
      hl: 'en',
      location: 'Saudi Arabia',
      num: 10,
      page: 1,
      tbs: 'qdr:y'
    });
    assert.deepEqual(serper.calls[1].request, {
      q: 'bearing supplier Riyadh',
      gl: 'sa',
      hl: 'en',
      location: 'Riyadh, Saudi Arabia',
      num: 10,
      page: 1
    });
  });

  it('executes Serper Maps queries as maps requests and extracts map place candidates', async () => {
    const aiGateway = createAiGateway([
      {
        text: JSON.stringify({
          pageQuality: 'medium',
          nextAction: 'stop',
          nextRequest: {
            endpoint: 'maps',
            requestBody: {
              q: '',
              hl: 'en',
              ll: '@41.6469296,-73.2681778,8z',
              page: 1
            }
          },
          tbs: null
        })
      }
    ]);
    const serper = createSerperClient([
      {
        places: [
          {
            title: 'Bearing Depot & Supply Inc',
            website: 'https://bearingdepot.com',
            address: '420 Saw Mill River Rd, Yonkers, NY',
            phoneNumber: '+1 914-555-0199',
            latitude: 40.9397,
            longitude: -73.8896,
            placeId: 'places/abc',
            cid: '12345'
          }
        ]
      }
    ]);
    const service = new AiLeadSearchOrchestrator(
      aiGateway as unknown as AiGatewayService,
      serper as unknown as SerperClient,
      createLogRecorder()
    );

    const result = await service.searchWithKeywordPlan(
      {
        requirement: '用地图找美国轴承经销商',
        targetLeadCount: 20,
        keywordPlan: {
          resolvedProductKeywords: 'bearing',
          resolvedTargetRegions: 'United States',
          resolvedTargetCustomerProfile: 'local bearing distributors',
          resolvedTargetLeadCount: 20,
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
              meta: {
                priority: '高'
              }
            }
          ]
        }
      },
      { user: createUser() }
    );

    assert.deepEqual(
      serper.calls.map(call => call.endpoint),
      ['maps']
    );
    assert.deepEqual(serper.calls[0].request, {
      q: 'bearing distributor',
      hl: 'en',
      ll: '@41.6469296,-73.2681778,8z',
      page: 1
    });
    assert.equal(result.serperRequests[0].endpoint, 'maps');
    assert.equal(result.candidates[0].sourceType, 'maps');
    assert.equal(result.candidates[0].title, 'Bearing Depot & Supply Inc');
    assert.equal(result.candidates[0].latitude, 40.9397);
    assert.equal(result.candidates[0].longitude, -73.8896);
  });

  it('stops the current query when the next request repeats an executed request', async () => {
    const aiGateway = createAiGateway([
      {
        text: JSON.stringify({
          resolvedProductKeywords: '6204 bearing',
          resolvedTargetRegions: 'Saudi Arabia',
          resolvedTargetCustomerProfile: 'bearing importer',
          resolvedTargetLeadCount: null,
          serperSearchQueries: [
            {
              q: '6204 bearing Saudi Arabia',
              gl: 'sa',
              hl: 'en',
              location: 'Saudi Arabia',
              priority: '高'
            }
          ],
          serperPlacesQueries: []
        })
      },
      {
        text: JSON.stringify({
          pageQuality: 'high',
          nextAction: 'paginate',
          nextRequest: {
            endpoint: 'search',
            requestBody: {
              q: '6204 bearing Saudi Arabia',
              gl: 'sa',
              hl: 'en',
              location: 'Saudi Arabia',
              num: 10,
              page: 1
            }
          },
          tbs: null
        })
      }
    ]);
    const serper = createSerperClient([{ organic: [] }]);
    const service = new AiLeadSearchOrchestrator(
      aiGateway as unknown as AiGatewayService,
      serper as unknown as SerperClient,
      createLogRecorder()
    );

    const result = await service.search({ requirement: '找轴承进口商', targetLeadCount: 20 }, { user: createUser() });

    assert.equal(serper.calls.length, 1);
    assert.equal(result.stopReason, '所有查询已完成');
    assert.equal(result.decisions[0]?.decision.nextAction, 'paginate');
  });
});

function createAiGateway(results: Array<{ text: string }>) {
  const calls: Array<{ promptKey?: string; prompt: string }> = [];

  return {
    calls,
    async getRequiredUserSerperConfig(user: { userId: string }) {
      assert.equal(user.userId, 'u-1');

      return {
        configKey: 'user:u-1',
        title: 'Serper 搜索',
        apiBase: 'https://google.serper.dev',
        apiKey: 'serper-key',
        updatedAt: ''
      };
    },
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

function createSerperClient(results: unknown[]) {
  const calls: Array<{ endpoint: 'search' | 'places' | 'maps'; request: Record<string, unknown> }> = [];

  return {
    calls,
    async search(_config: unknown, request: Record<string, unknown>) {
      calls.push({ endpoint: 'search', request });

      return results.shift() || {};
    },
    async places(_config: unknown, request: Record<string, unknown>) {
      calls.push({ endpoint: 'places', request });

      return results.shift() || {};
    },
    async maps(_config: unknown, request: Record<string, unknown>) {
      calls.push({ endpoint: 'maps', request });

      return results.shift() || {};
    }
  };
}

function createOrganicCandidates(prefix: string, count: number) {
  return Array.from({ length: count }, (_, index) => ({
    title: `${prefix} buyer ${index + 1}`,
    link: `https://${prefix}-${index + 1}.example.com`,
    snippet: 'bearing importer'
  }));
}

function createLogRecorder() {
  return {
    records: [] as SystemLogRecordInput[],
    async record(input: SystemLogRecordInput) {
      this.records.push(input);

      return { ...input, id: String(this.records.length), createdAt: new Date() };
    }
  };
}

function createUser(): UserInfo {
  return {
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
}
