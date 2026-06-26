import type { AiLeadProductLineSnapshot } from './ai-lead-product-line-context';
import type {
  AiLeadEmailWritingContext,
  AiLeadPrecisionAnalysis,
  AiLeadWebsiteEvidence,
  AiLeadWebsiteEvidenceItem,
  AiLeadWebsiteEvidenceItemType
} from './ai-lead-website-crawler.types';

const allowedEvidenceItemTypes: AiLeadWebsiteEvidenceItemType[] = [
  'company_background',
  'product',
  'application',
  'brand',
  'recent_activity',
  'purchase_signal',
  'negative_relevance',
  'address'
];
const contactChannelPattern =
  /(?:[\w.+%-]+@[\w.-]+\.[A-Za-z]{2,}|mailto:|tel:|wa\.me|whatsapp\.com|linkedin\.com|facebook\.com|instagram\.com|twitter\.com|x\.com\/|tiktok\.com)/i;
const nonProductSignalTerms = new Set([
  'supplier',
  'manufacturer',
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

export interface BuildAiLeadEmailWritingContextInput {
  candidate?: {
    title?: unknown;
    snippet?: unknown;
    website?: unknown;
    url?: unknown;
    websiteEvidence?: AiLeadWebsiteEvidence;
    precisionAnalysis?: AiLeadPrecisionAnalysis;
  } | null;
  websiteEvidence?: AiLeadWebsiteEvidence | null;
  precisionAnalysis?: AiLeadPrecisionAnalysis | null;
  productLineSnapshot?: AiLeadProductLineSnapshot | null;
}

/** 规范化 LLM 或历史 JSON 中的 AI 写信用客户资料。 */
export function normalizeAiLeadEmailWritingContext(value: unknown): AiLeadEmailWritingContext | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const context: AiLeadEmailWritingContext = {
    companyBackgroundSummary: normalizeContextText(record.companyBackgroundSummary),
    industryChainPosition: normalizeContextText(record.industryChainPosition),
    mainProducts: normalizeContextTextArray(record.mainProducts),
    servedIndustries: normalizeContextTextArray(record.servedIndustries),
    businessModel: normalizeContextText(record.businessModel),
    productFitSummary: normalizeContextText(record.productFitSummary),
    recentBusinessTriggers: normalizeContextTextArray(record.recentBusinessTriggers),
    recommendedFirstEmailAngle: normalizeContextText(record.recommendedFirstEmailAngle),
    negativeRelevanceSignals: normalizeContextTextArray(record.negativeRelevanceSignals),
    confidenceScore: clampConfidenceScore(record.confidenceScore),
    evidenceItems: normalizeEvidenceItems(record.evidenceItems)
  };

  return hasEmailWritingContextContent(context) ? context : null;
}

/** 基于已有官网证据和精准分析生成保守版 AI 写信用客户资料。 */
export function buildFallbackAiLeadEmailWritingContext(
  input: BuildAiLeadEmailWritingContextInput
): AiLeadEmailWritingContext | null {
  const websiteEvidence = input.websiteEvidence ?? input.candidate?.websiteEvidence ?? null;
  const precisionAnalysis = input.precisionAnalysis ?? input.candidate?.precisionAnalysis ?? null;
  const evidenceItems = normalizeEvidenceItems(websiteEvidence?.evidenceItems ?? []);
  const productEvidenceItems = evidenceItems.filter(item => item.type === 'product');
  const companyEvidenceItems = evidenceItems.filter(item => item.type === 'company_background');
  const applicationEvidenceItems = evidenceItems.filter(item => item.type === 'application');
  const recentEvidenceItems = evidenceItems.filter(item => item.type === 'recent_activity');
  const negativeEvidenceItems = evidenceItems.filter(item => item.type === 'negative_relevance');
  const companyBackgroundSummary =
    firstText(companyEvidenceItems) ||
    normalizeContextText(websiteEvidence?.description) ||
    normalizeContextText(websiteEvidence?.title) ||
    normalizeContextText(input.candidate?.snippet) ||
    normalizeContextText(input.candidate?.title);
  const productSignals = uniqueTextArray(
    [
      ...normalizeContextTextArray(websiteEvidence?.keywordHits),
      ...splitListText(readProductLineField(input.productLineSnapshot, 'name')),
      ...splitListText(readProductLineField(input.productLineSnapshot, 'commonModelsText'))
    ].filter(signal => !nonProductSignalTerms.has(toDeduplicationKey(signal))),
    6
  );
  const productFitSummary =
    normalizeContextText(precisionAnalysis?.reason) ||
    firstText(productEvidenceItems) ||
    normalizeContextText(websiteEvidence?.evidenceSnippets?.[0]);
  const negativeRelevanceSignals = uniqueTextArray(
    [
      ...normalizeContextTextArray(precisionAnalysis?.risks),
      ...normalizeContextTextArray(websiteEvidence?.negativeEvidenceSnippets),
      ...negativeEvidenceItems.map(item => item.text)
    ],
    6
  );
  const context: AiLeadEmailWritingContext = {
    companyBackgroundSummary,
    industryChainPosition:
      normalizeContextText(precisionAnalysis?.customerGroup) ||
      normalizeContextText(precisionAnalysis?.buyerType) ||
      readProductLineField(input.productLineSnapshot, 'targetCustomerType'),
    mainProducts: productSignals,
    servedIndustries: uniqueTextArray(
      [
        ...applicationEvidenceItems.map(item => item.text),
        readProductLineField(input.productLineSnapshot, 'targetCustomerType')
      ],
      6
    ),
    businessModel:
      normalizeContextText(precisionAnalysis?.buyerType) || normalizeContextText(precisionAnalysis?.customerGroup),
    productFitSummary,
    recentBusinessTriggers: uniqueTextArray(recentEvidenceItems.map(item => item.text), 6),
    recommendedFirstEmailAngle:
      normalizeContextText(precisionAnalysis?.recommendedAction) ||
      buildDefaultFirstEmailAngle(productFitSummary, productSignals),
    negativeRelevanceSignals,
    confidenceScore: clampConfidenceScore(precisionAnalysis?.score),
    evidenceItems
  };

  return hasEmailWritingContextContent(context) ? context : null;
}

export function normalizeEvidenceItems(value: unknown, limit = 24): AiLeadWebsiteEvidenceItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const output: AiLeadWebsiteEvidenceItem[] = [];

  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      continue;
    }

    const record = item as Record<string, unknown>;
    const type = normalizeEvidenceItemType(record.type);
    const url = normalizeContextText(record.url);
    const text = normalizeContextText(record.text, 260);
    const key = `${type}|${url.toLowerCase()}|${text.toLowerCase()}`;

    if (!type || !url || !text || hasContactChannel(url) || hasContactChannel(text) || seen.has(key)) {
      continue;
    }

    seen.add(key);
    output.push({ type, url, text });

    if (output.length >= limit) {
      break;
    }
  }

  return output;
}

function normalizeEvidenceItemType(value: unknown): AiLeadWebsiteEvidenceItemType | null {
  return typeof value === 'string' && allowedEvidenceItemTypes.includes(value as AiLeadWebsiteEvidenceItemType)
    ? (value as AiLeadWebsiteEvidenceItemType)
    : null;
}

function hasEmailWritingContextContent(context: AiLeadEmailWritingContext) {
  return Boolean(
    context.companyBackgroundSummary ||
      context.industryChainPosition ||
      context.mainProducts.length ||
      context.servedIndustries.length ||
      context.businessModel ||
      context.productFitSummary ||
      context.recentBusinessTriggers.length ||
      context.recommendedFirstEmailAngle ||
      context.negativeRelevanceSignals.length ||
      context.evidenceItems.length
  );
}

function firstText(items: AiLeadWebsiteEvidenceItem[]) {
  return items.find(item => item.text)?.text ?? '';
}

function buildDefaultFirstEmailAngle(productFitSummary: string, productSignals: string[]) {
  if (productFitSummary) {
    return `围绕已确认的产品匹配点做一次低摩擦确认：${productFitSummary}`;
  }

  if (productSignals.length > 0) {
    return `围绕 ${productSignals[0]} 做一次低摩擦相关性确认。`;
  }

  return '';
}

function readProductLineField(productLine: AiLeadProductLineSnapshot | null | undefined, field: string) {
  if (!productLine || typeof productLine !== 'object') {
    return '';
  }

  return normalizeContextText((productLine as unknown as Record<string, unknown>)[field]);
}

function normalizeContextTextArray(value: unknown, limit = 8) {
  const source = Array.isArray(value) ? value : typeof value === 'string' ? splitListText(value) : [];

  return uniqueTextArray(
    source
      .map(item => normalizeContextText(item))
      .filter(Boolean),
    limit
  );
}

function splitListText(value: string) {
  return value
    .split(/[,，;；|、\n]+/)
    .map(item => item.trim())
    .filter(Boolean);
}

function uniqueTextArray(values: string[], limit: number) {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    const normalized = normalizeContextText(value);
    const key = toDeduplicationKey(normalized);

    if (!normalized || seen.has(key)) {
      continue;
    }

    seen.add(key);
    output.push(normalized);

    if (output.length >= limit) {
      break;
    }
  }

  return output;
}

function toDeduplicationKey(value: string) {
  return value
    .toLowerCase()
    .replace(/[。.!?；;:：]+$/g, '')
    .trim();
}

function normalizeContextText(value: unknown, maxLength = 320) {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return '';
  }

  const normalized = String(value).replace(/\s+/g, ' ').trim();
  if (!normalized || hasContactChannel(normalized)) {
    return '';
  }

  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 3)}...` : normalized;
}

function clampConfidenceScore(value: unknown) {
  const numberValue = typeof value === 'number' && Number.isFinite(value) ? value : 50;

  return Math.max(0, Math.min(100, Math.round(numberValue)));
}

function hasContactChannel(value: string) {
  return contactChannelPattern.test(value);
}
