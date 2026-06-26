import { Inject, Injectable } from '@nestjs/common';
import { defaultAiModelConfigKey, leadMatchAnalyzePromptKey } from '../ai-gateway/ai-gateway.constants';
import { AiGatewayService } from '../ai-gateway/ai-gateway.service';
import type { AiLeadSearchContext, OptimizedKeywordPlan } from './ai-lead-search-orchestrator.service';
import { normalizeAiLeadKeywordContextSnapshot } from './ai-lead-keyword-context';
import type {
  AiLeadPrecisionAnalysis,
  AiLeadPrecisionPriority,
  AiLeadTargetMarketFit,
  AiLeadWebsiteEvidence,
  AiLeadWebsiteEnrichedCandidate
} from './ai-lead-website-crawler.types';

const leadMatchAnalyzeMaxOutputTokens = 2600;
const minStrongProductEvidenceScore = 40;
const officialChinaCountry = '中国';
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
  customerGroup?: unknown;
  companyCountry?: unknown;
  targetMarketFit?: unknown;
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
      const aiAnalysis = outputByKey.get(candidate.dedupeKey) ?? createDefaultAnalysis(candidate);
      const analysis = enforceOfficialCountryMismatch(
        input,
        candidate,
        protectStrongWebsiteProductEvidence(input, candidate, aiAnalysis)
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
  const leadContextSnapshot = normalizeAiLeadKeywordContextSnapshot(input.keywordPlan.leadContextSnapshot);

  return JSON.stringify({
    instruction:
      '你是外贸获客质检助手。只根据 Serper 候选信息、CRM 产品线基准、用户结构化获客条件 leadContextSnapshot 和官网抓取证据判断客户精准度，不要编造事实。输出严格 JSON。必须先判断客户群体、官网归属地、目标市场匹配度、产品线匹配度；产品线是固定参照，用户输入只是本次搜索条件。若 leadContextSnapshot.exclusionRules 存在用户勾选的排除类型，必须逐条检查候选官网证据；命中排除规则时要在 risks 写明命中的排除类型和证据，严重命中时 priority=reject。若官网地址、页脚、联系页、电话或官网证据明确显示中国公司，而用户目标是海外/非中国客户，或用户排除类型包含中国供应商/出口商，必须标为 outside_target、priority=reject、score<=30，并说明官网证据。若无归属地冲突但官网当前产品页、标题、描述、URL 或页面片段明确命中产品线或目标产品，不要直接 reject，应至少给 low 并标记 reviewRequired。',
    outputContract: {
      candidates: [
        {
          dedupeKey: '必须原样返回输入 dedupeKey',
          score: '0-100 数字',
          priority: 'high | medium | low | reject',
          buyerType: '客户类型',
          customerGroup: '客户群体判断，例如海外经销商/本地进口商/中国供应商/非目标海外客户',
          companyCountry: '官网证据显示的公司归属国家；没有证据则为空字符串',
          targetMarketFit: 'target | uncertain | outside_target',
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
      resolvedTargetCustomerProfile: input.keywordPlan.resolvedTargetCustomerProfile || '',
      productLineSnapshot: input.keywordPlan.productLineSnapshot || null,
      leadContextSnapshot
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
    customerGroup: normalizeString(output.customerGroup),
    companyCountry: normalizeString(output.companyCountry),
    targetMarketFit: normalizeTargetMarketFit(output.targetMarketFit),
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
    customerGroup: '',
    companyCountry: '',
    targetMarketFit: 'uncertain',
    reason: crawlFailed ? '官网证据抓取失败，需人工复核' : '模型未返回该客户分析结果',
    matchedSignals: candidate.websiteEvidence?.keywordHits ?? [],
    risks: crawlFailed ? [candidate.websiteEvidence?.failureReason || '官网证据不足'] : ['模型未返回分析结果'],
    recommendedAction: '人工复核后再开发',
    reviewRequired: true
  };
}

function enforceOfficialCountryMismatch(
  input: AnalyzeCandidatesInput,
  candidate: AiLeadWebsiteEnrichedCandidate,
  analysis: AiLeadPrecisionAnalysis
): AiLeadPrecisionAnalysis {
  const officialCountry = detectOfficialCompanyCountry(candidate.websiteEvidence);

  if (officialCountry !== officialChinaCountry || !shouldRejectOfficialChinaCompany(input)) {
    return analysis;
  }

  const countrySignals = collectOfficialCountryEvidence(candidate.websiteEvidence);
  const matchedSignals = uniqueStrings([...countrySignals, ...analysis.matchedSignals], 8);

  return {
    ...analysis,
    score: Math.min(analysis.score, 25),
    priority: 'reject',
    buyerType: analysis.buyerType || '中国供应商',
    customerGroup: '中国供应商 / 非目标海外客户',
    companyCountry: officialChinaCountry,
    targetMarketFit: 'outside_target',
    reason: `官网地址显示中国公司，不符合当前海外客户开发目标：${countrySignals.slice(0, 2).join('；')}`,
    matchedSignals,
    risks: uniqueStrings(
      [
        '产品页命中目标产品但公司归属为中国，不能按海外客户纳入开发名单',
        ...analysis.risks
      ],
      8
    ),
    recommendedAction: '不纳入开发名单；如需中国供应商名单请单独建搜索任务',
    reviewRequired: false
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
    customerGroup: analysis.customerGroup || '产品命中但需复核客户群体',
    targetMarketFit: analysis.targetMarketFit === 'outside_target' ? 'uncertain' : analysis.targetMarketFit,
    reason: `官网产品页命中目标产品，需人工复核，不应直接剔除：${productEvidence.slice(0, 2).join('；')}`,
    matchedSignals: uniqueStrings([...productEvidence, ...analysis.matchedSignals], 8),
    risks: uniqueStrings(['AI 原判 reject，已因官网强产品证据转人工复核', ...analysis.risks], 8),
    recommendedAction: analysis.recommendedAction || '人工复核后纳入低优先级开发名单',
    reviewRequired: true
  };
}

function detectOfficialCompanyCountry(evidence: AiLeadWebsiteEvidence | undefined) {
  if (!evidence || evidence.crawlStatus !== 'completed') {
    return '';
  }

  const officialText = normalizeComparableText(
    [
      ...(evidence.companyCountrySignals ?? []),
      ...(evidence.companyAddressEvidence ?? []),
      ...evidence.phones
    ].join(' ')
  );

  if (/(中国|中國|china|الصين|xiamen|fujian|fujan|\+86)/i.test(officialText)) {
    return officialChinaCountry;
  }

  return evidence.companyCountrySignals?.[0] || '';
}

function collectOfficialCountryEvidence(evidence: AiLeadWebsiteEvidence | undefined) {
  if (!evidence) {
    return [];
  }

  return uniqueStrings(
    [
      ...(evidence.companyAddressEvidence ?? []),
      ...(evidence.companyCountrySignals ?? []).map(signal => `官网归属地：${signal}`),
      ...evidence.phones.filter(phone => /^\+86\b/.test(phone.trim()))
    ],
    8
  );
}

function isTargetingNonChinaMarket(input: AnalyzeCandidatesInput) {
  const leadContextSnapshot = normalizeAiLeadKeywordContextSnapshot(input.keywordPlan.leadContextSnapshot);
  const leadContextRegions = leadContextSnapshot
    ? [
        leadContextSnapshot.targetRegion?.label,
        leadContextSnapshot.targetRegion?.countryCode,
        ...leadContextSnapshot.targetRegions.flatMap(region => [region.label, region.countryCode])
      ]
    : [];
  const targetText = normalizeComparableText(
    [
      input.keywordPlan.resolvedTargetRegions,
      input.keywordPlan.resolvedTargetCustomerProfile,
      input.requirement,
      ...leadContextRegions
    ].join(' ')
  );

  if (!targetText) {
    return false;
  }

  if (/(中国|中國|\bchina\b|\bchinese\b)/i.test(targetText) && !/(海外|国外|外贸|\boverseas\b|\bforeign\b)/i.test(targetText)) {
    return false;
  }

  return /(?:阿联酋|迪拜|沙特|土耳其|中东|海外|国外|外贸|\buae\b|\bdubai\b|\bsaudi\b|\bturkey\b|\boverseas\b|\bforeign\b|\bimporter\b|\bdistributor\b)/i.test(
    targetText
  );
}

function shouldRejectOfficialChinaCompany(input: AnalyzeCandidatesInput) {
  return isTargetingNonChinaMarket(input) || hasSelectedLeadContextExclusion(input, 'china_supplier');
}

function hasSelectedLeadContextExclusion(input: AnalyzeCandidatesInput, ruleKey: string) {
  const leadContextSnapshot = normalizeAiLeadKeywordContextSnapshot(input.keywordPlan.leadContextSnapshot);

  return leadContextSnapshot?.exclusionRules.some(rule => rule.key === ruleKey) ?? false;
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
      ...collectProductLineKeywordSources(input.keywordPlan),
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
    input.keywordPlan.resolvedTargetCustomerProfile,
    ...collectProductLineKeywordSources(input.keywordPlan)
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

function collectProductLineKeywordSources(keywordPlan: OptimizedKeywordPlan) {
  const productLine = keywordPlan.productLineSnapshot;

  if (!productLine || typeof productLine !== 'object' || Array.isArray(productLine)) {
    return [];
  }

  return [
    'name',
    'targetCustomerType',
    'coreSellingPoints',
    'commonModelsText',
    'certifications',
    'moq',
    'leadTime'
  ]
    .map(key => (productLine as Record<string, unknown>)[key])
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
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

function normalizeTargetMarketFit(value: unknown): AiLeadTargetMarketFit {
  return value === 'target' || value === 'uncertain' || value === 'outside_target' ? value : 'uncertain';
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
