import { Inject, Injectable } from '@nestjs/common';
import { defaultAiModelConfigKey, leadMatchAnalyzePromptKey } from '../ai-gateway/ai-gateway.constants';
import { AiGatewayService } from '../ai-gateway/ai-gateway.service';
import type { AiLeadSearchContext, OptimizedKeywordPlan } from './ai-lead-search-orchestrator.service';
import type {
  AiLeadPrecisionAnalysis,
  AiLeadPrecisionPriority,
  AiLeadWebsiteEvidence,
  AiLeadWebsiteEnrichedCandidate
} from './ai-lead-website-crawler.types';

const leadMatchAnalyzeMaxOutputTokens = 2600;
const minStrongProductEvidenceScore = 40;
const buyerSignalKeywords = new Set([
  'supplier',
  'manufacturer',
  'factory',
  'import',
  'importer',
  'distributor',
  'dealer',
  'stockist',
  'wholesaler',
  'export',
  'catalog',
  'products',
  'product',
  'contact',
  'about'
]);
const commonRequirementTokens = new Set([
  'customer',
  'customers',
  'client',
  'clients',
  'buyer',
  'buyers',
  'target',
  'market',
  'overseas',
  'foreign',
  'china',
  'chinese',
  'import',
  'importer',
  'distributor',
  'dealer',
  'supplier',
  'manufacturer'
]);

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
      const analysis = protectStrongWebsiteProductEvidence(
        input,
        candidate,
        outputByKey.get(candidate.dedupeKey) ?? createDefaultAnalysis(candidate)
      );

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
      '你是外贸获客质检助手。只根据 Serper 候选信息和官网抓取证据判断客户精准度，不要编造事实。输出严格 JSON。若官网当前产品页、标题、描述、URL 或页面片段明确命中目标产品，不得仅因为网站还有其他大类、公司在中国或联系方式是中国邮箱/电话就直接判 reject；这类情况应至少给 low 并标记 reviewRequired。',
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

function protectStrongWebsiteProductEvidence(
  input: AnalyzeCandidatesInput,
  candidate: AiLeadWebsiteEnrichedCandidate,
  analysis: AiLeadPrecisionAnalysis
): AiLeadPrecisionAnalysis {
  if (analysis.priority !== 'reject' || !candidate.websiteEvidence) {
    return analysis;
  }

  const productEvidence = collectStrongProductEvidence(input, candidate);

  if (productEvidence.length === 0) {
    return analysis;
  }

  return {
    ...analysis,
    score: Math.max(analysis.score, minStrongProductEvidenceScore),
    priority: 'low',
    buyerType: analysis.buyerType || '官网产品页命中目标产品',
    reason: `官网产品页命中目标产品，需人工复核，不应直接剔除：${productEvidence.slice(0, 2).join('；')}`,
    matchedSignals: uniqueStrings([...productEvidence, ...analysis.matchedSignals], 8),
    risks: uniqueStrings(['AI 原判 reject，已因官网强产品证据转人工复核', ...analysis.risks], 8),
    recommendedAction: analysis.recommendedAction || '人工复核后纳入低优先级开发名单',
    reviewRequired: true
  };
}

function collectStrongProductEvidence(input: AnalyzeCandidatesInput, candidate: AiLeadWebsiteEnrichedCandidate) {
  const evidence = candidate.websiteEvidence;

  if (!evidence || evidence.crawlStatus !== 'completed') {
    return [];
  }

  const phrases = collectProductPhrases(input);
  const tokens = collectProductTokens(input);
  const evidenceText = normalizeComparableText(
    [
      candidate.title,
      candidate.snippet,
      candidate.url,
      candidate.website,
      evidence.finalUrl,
      evidence.title,
      evidence.description,
      ...evidence.keywordHits,
      ...evidence.evidenceSnippets
    ].join(' ')
  );
  const matchedPhrases = phrases.filter(phrase => evidenceText.includes(phrase));
  const matchedTokens = tokens.filter(token => evidenceText.includes(token));
  const signals = uniqueStrings([...matchedPhrases, ...matchedTokens], 6);

  if (matchedPhrases.length > 0 || matchedTokens.length >= 2 || hasProductKeywordHit(evidence, tokens)) {
    return signals.length > 0 ? signals : uniqueStrings(evidence.keywordHits, 6);
  }

  return [];
}

function collectProductPhrases(input: AnalyzeCandidatesInput) {
  return uniqueStrings(
    [
      input.keywordPlan.resolvedProductKeywords,
      ...splitKeywordText(input.keywordPlan.resolvedProductKeywords),
      ...splitKeywordText(input.requirement)
    ]
      .map(normalizeComparableText)
      .filter(phrase => phrase.length >= 4 && !buyerSignalKeywords.has(phrase) && !commonRequirementTokens.has(phrase)),
    24
  );
}

function collectProductTokens(input: AnalyzeCandidatesInput) {
  const sourceText = [
    input.requirement,
    input.keywordPlan.resolvedProductKeywords,
    input.keywordPlan.resolvedTargetCustomerProfile
  ].join(' ');

  return uniqueStrings(
    normalizeComparableText(sourceText)
      .split(/[^a-z0-9]+/i)
      .filter(token => token.length >= 4 || /^\d{3,}$/.test(token))
      .filter(token => !buyerSignalKeywords.has(token) && !commonRequirementTokens.has(token)),
    32
  );
}

function splitKeywordText(value: string | undefined) {
  return (value ?? '')
    .split(/[,，;；|、/]+/)
    .map(item => item.trim())
    .filter(Boolean);
}

function hasProductKeywordHit(evidence: AiLeadWebsiteEvidence, productTokens: string[]) {
  if (productTokens.length === 0) {
    return false;
  }

  return evidence.keywordHits.some(hit => {
    const normalizedHit = normalizeComparableText(hit);

    return productTokens.some(token => normalizedHit.includes(token));
  });
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

function normalizeComparableText(value: unknown) {
  return normalizeString(value)
    .toLowerCase()
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function uniqueStrings(values: string[], limit: number) {
  return Array.from(new Set(values.map(normalizeString).filter(Boolean))).slice(0, limit);
}
