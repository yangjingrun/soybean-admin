import { Inject, Injectable } from '@nestjs/common';
import { defaultAiModelConfigKey, leadMatchAnalyzePromptKey } from '../ai-gateway/ai-gateway.constants';
import { AiGatewayService } from '../ai-gateway/ai-gateway.service';
import type { AiLeadSearchContext, OptimizedKeywordPlan } from './ai-lead-search-orchestrator.service';
import type {
  AiLeadPrecisionAnalysis,
  AiLeadPrecisionPriority,
  AiLeadWebsiteEnrichedCandidate
} from './ai-lead-website-crawler.types';

const leadMatchAnalyzeMaxOutputTokens = 2600;

interface AnalyzeCandidatesInput {
  requirement: string;
  keywordPlan: OptimizedKeywordPlan;
  candidates: AiLeadWebsiteEnrichedCandidate[];
}

interface AiLeadPrecisionCandidateOutput {
  dedupeKey?: unknown;
  score?: unknown;
  priority?: unknown;
  buyerType?: unknown;
  reason?: unknown;
  matchedSignals?: unknown;
  risks?: unknown;
  recommendedAction?: unknown;
  reviewRequired?: unknown;
}

@Injectable()
export class AiLeadPrecisionAnalysisService {
  constructor(@Inject(AiGatewayService) private readonly aiGatewayService: AiGatewayService) {}

  /** Scores website-enriched candidates against the original lead requirement. */
  async analyzeCandidates(input: AnalyzeCandidatesInput, context: AiLeadSearchContext = {}) {
    if (input.candidates.length === 0) {
      return [];
    }

    const result = await this.aiGatewayService.generateText(
      {
        modelConfigKey: defaultAiModelConfigKey,
        promptKey: leadMatchAnalyzePromptKey,
        prompt: buildLeadPrecisionPrompt(input),
        maxOutputTokens: leadMatchAnalyzeMaxOutputTokens
      },
      context
    );
    const outputByKey = new Map(
      readAnalysisOutputs(result.text).map(item => [normalizeString(item.dedupeKey), toPrecisionAnalysis(item)])
    );

    return input.candidates.map(candidate => {
      const analysis = outputByKey.get(candidate.dedupeKey) ?? createDefaultAnalysis(candidate);

      return {
        ...candidate,
        score: analysis.score,
        reason: analysis.reason,
        precisionAnalysis: analysis
      };
    });
  }
}

function buildLeadPrecisionPrompt(input: AnalyzeCandidatesInput) {
  return JSON.stringify({
    instruction:
      '你是外贸获客质检助手。只根据 Serper 候选信息和官网抓取证据判断客户精准度，不要编造事实。输出严格 JSON。',
    outputContract: {
      candidates: [
        {
          dedupeKey: '必须原样返回输入 dedupeKey',
          score: '0-100 数字',
          priority: 'high | medium | low | reject',
          buyerType: '客户类型',
          reason: '一句中文原因，引用已给证据',
          matchedSignals: ['命中的官网/Serper 信号'],
          risks: ['不确定或不匹配风险'],
          recommendedAction: '下一步建议',
          reviewRequired: 'boolean；官网抓取失败或证据不足时为 true'
        }
      ]
    },
    requirement: input.requirement,
    keywordPlan: {
      resolvedProductKeywords: input.keywordPlan.resolvedProductKeywords || '',
      resolvedTargetRegions: input.keywordPlan.resolvedTargetRegions || '',
      resolvedTargetCustomerProfile: input.keywordPlan.resolvedTargetCustomerProfile || ''
    },
    candidates: input.candidates.map(candidate => ({
      dedupeKey: candidate.dedupeKey,
      title: candidate.title,
      website: candidate.website || candidate.url,
      snippet: candidate.snippet,
      address: candidate.address,
      phoneNumber: candidate.phoneNumber,
      sourceType: candidate.sourceType,
      country: candidate.country,
      websiteEvidence: candidate.websiteEvidence
    }))
  });
}

function readAnalysisOutputs(text: string): AiLeadPrecisionCandidateOutput[] {
  const parsed = JSON.parse(text) as { candidates?: unknown };

  if (!Array.isArray(parsed.candidates)) {
    return [];
  }

  return parsed.candidates.filter(item => item && typeof item === 'object') as AiLeadPrecisionCandidateOutput[];
}

function toPrecisionAnalysis(output: AiLeadPrecisionCandidateOutput): AiLeadPrecisionAnalysis {
  return {
    score: clampScore(output.score),
    priority: normalizePriority(output.priority),
    buyerType: normalizeString(output.buyerType),
    reason: normalizeString(output.reason) || '模型未返回匹配原因',
    matchedSignals: normalizeStringArray(output.matchedSignals),
    risks: normalizeStringArray(output.risks),
    recommendedAction: normalizeString(output.recommendedAction),
    reviewRequired: output.reviewRequired === true
  };
}

function createDefaultAnalysis(candidate: AiLeadWebsiteEnrichedCandidate): AiLeadPrecisionAnalysis {
  const crawlFailed = candidate.websiteEvidence?.crawlStatus !== 'completed';

  return {
    score: crawlFailed ? 45 : 60,
    priority: crawlFailed ? 'medium' : 'medium',
    buyerType: '',
    reason: crawlFailed ? '官网证据抓取失败，需人工复核' : '模型未返回该客户分析结果',
    matchedSignals: candidate.websiteEvidence?.keywordHits ?? [],
    risks: crawlFailed ? [candidate.websiteEvidence?.failureReason || '官网证据不足'] : ['模型未返回分析结果'],
    recommendedAction: '人工复核后再开发',
    reviewRequired: true
  };
}

function normalizePriority(value: unknown): AiLeadPrecisionPriority {
  return value === 'high' || value === 'medium' || value === 'low' || value === 'reject' ? value : 'medium';
}

function clampScore(value: unknown) {
  const numberValue = typeof value === 'number' && Number.isFinite(value) ? value : 50;

  return Math.max(0, Math.min(100, Math.round(numberValue)));
}

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeStringArray(value: unknown) {
  return Array.isArray(value) ? value.map(normalizeString).filter(Boolean).slice(0, 8) : [];
}
