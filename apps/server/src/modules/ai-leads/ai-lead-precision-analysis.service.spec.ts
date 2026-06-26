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

  it('keeps strong product-page evidence reviewable when AI incorrectly rejects the candidate', async () => {
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
        requirement: '我是河北卖轴承的，主打 6203及以上 轴承，找进口商和经销商',
        keywordPlan: {
          resolvedProductKeywords: '6203 bearing',
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
              negativeKeywordHits: ['chemical'],
              negativeEvidenceSnippets: ['fluorinated chemical products'],
              failureReason: null
            }
          } as AiLeadSearchCandidate
        ]
      },
      {}
    );

    assert.equal(result[0].score, 40);
    assert.equal(result[0].precisionAnalysis?.priority, 'low');
    assert.equal(result[0].precisionAnalysis?.reviewRequired, true);
    assert.match(result[0].reason ?? '', /官网产品页命中目标产品/);
    assert.match(result[0].precisionAnalysis?.risks.join(' ') ?? '', /AI 原判 reject/);
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
