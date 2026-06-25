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
              reason: '官网展示 elevator bearing 和 contact 邮箱',
              matchedSignals: ['elevator bearing', 'sales@abc.example.com'],
              risks: [],
              recommendedAction: '优先开发',
              reviewRequired: false
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
          resolvedTargetCustomerProfile: 'elevator component distributor'
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
              failureReason: null
            }
          } as AiLeadSearchCandidate
        ]
      },
      { user: { userId: 'u-1' } as never }
    );

    assert.equal(aiGateway.calls[0].promptKey, leadMatchAnalyzePromptKey);
    assert.match(aiGateway.calls[0].prompt, /找电梯曳引机轴承客户/);
    assert.match(aiGateway.calls[0].prompt, /sales@abc\.example\.com/);
    assert.equal(result[0].score, 88);
    assert.equal(result[0].reason, '官网展示 elevator bearing 和 contact 邮箱');
    assert.equal(result[0].precisionAnalysis?.priority, 'high');
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
