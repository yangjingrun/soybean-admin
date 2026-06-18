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

    const result = await service.search({ requirement: '找沙特轴承进口商' }, { user: createUser() });

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

    await service.search({ requirement: '找沙特轴承进口商' }, { user: createUser() });

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

    await service.search({ requirement: '找沙特轴承进口商' }, { user: createUser() });

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

    const result = await service.search({ requirement: '找沙特轴承进口商' }, { user: createUser() });

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
