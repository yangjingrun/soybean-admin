import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { UserInfo } from '../auth/auth.types';
import type { AiGatewayService } from '../ai-gateway/ai-gateway.service';
import { leadKeywordOptimizePromptKey, leadSearchResultDecidePromptKey } from '../ai-gateway/ai-gateway.constants';
import type { SerperClient } from '../ai-gateway/serper-client.service';
import type { SystemLogRecordInput } from '../system-log/system-log.types';
import { AiLeadSearchOrchestrator } from './ai-lead-search-orchestrator.service';

describe('AiLeadSearchOrchestrator', () => {
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

    const result = await service.search({ requirement: '找轴承进口商' }, { user: createUser() });

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
      { requirement: '我是河北卖轴承的，主打 6203及以上 轴承，找韩国和墨西哥进口商和经销商', maxSearchRequests: 0 },
      { user: createUser() }
    );

    assert.match(aiGateway.calls[0]?.prompt || '', /目标市场本地语言查询强约束/);
    assert.match(aiGateway.calls[0]?.prompt || '', /韩国=韩语，hl=ko/);
    assert.match(aiGateway.calls[0]?.prompt || '', /墨西哥=西班牙语，hl=es/);
    assert.match(aiGateway.calls[0]?.prompt || '', /serperSearchQueries[\s\S]*至少输出 2 条当地语言查询/);
    assert.match(aiGateway.calls[0]?.prompt || '', /前 6 条 Search 查询/);
  });

  it('rejects keyword plans missing required local-language Search queries before calling Serper', async () => {
    const aiGateway = createAiGateway([
      {
        text: JSON.stringify({
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

    await assert.rejects(
      () =>
        service.search(
          { requirement: '我是河北卖轴承的，主打 6203及以上 轴承，找韩国进口商和经销商' },
          { user: createUser() }
        ),
      /关键词优化结果缺少韩国韩语 Search 查询/
    );
    assert.equal(serper.calls.length, 0);
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

    await service.search({ requirement: '找轴承进口商' }, { user: createUser() });

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

    await service.search({ requirement: '找轴承进口商' }, { user: createUser() });

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

    const result = await service.search({ requirement: '找轴承进口商' }, { user: createUser() });

    assert.equal(serper.calls.length, 1);
    assert.equal(result.stopReason, '所有查询已完成');
    assert.equal(result.decisions[0]?.decision.nextAction, 'paginate');
  });
});

function createAiGateway(results: Array<{ text: string }>) {
  const calls: Array<{ promptKey?: string; prompt: string }> = [];

  return {
    calls,
    async getSerperConfig() {
      return {
        configKey: 'default',
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
  const calls: Array<{ endpoint: 'search' | 'places'; request: Record<string, unknown> }> = [];

  return {
    calls,
    async search(_config: unknown, request: Record<string, unknown>) {
      calls.push({ endpoint: 'search', request });

      return results.shift() || {};
    },
    async places(_config: unknown, request: Record<string, unknown>) {
      calls.push({ endpoint: 'places', request });

      return results.shift() || {};
    }
  };
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
    roles: ['R_SUPER'],
    buttons: []
  };
}
