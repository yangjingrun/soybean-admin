import type { CrmAiWritingFact } from './crm-ai-writing-module.types';

const sourceFactFields = [
  'website_product_fact',
  'recent_trigger',
  'products_sold',
  'applications_served',
  'brands_carried',
  'purchase_signal',
  'source_url',
  'source_date',
  'fact_or_inference',
  'confidence_score'
] as const;
const emailWritingFactFields = [
  ['companyBackgroundSummary', 'company_background_summary', 'AI 写信用客户资料 - 公司背景'],
  ['industryChainPosition', 'industry_chain_position', 'AI 写信用客户资料 - 产业链位置'],
  ['mainProducts', 'main_products', 'AI 写信用客户资料 - 主要产品'],
  ['servedIndustries', 'served_industries', 'AI 写信用客户资料 - 服务行业'],
  ['businessModel', 'business_model', 'AI 写信用客户资料 - 经营模式'],
  ['productFitSummary', 'product_fit_summary', 'AI 写信用客户资料 - 产品匹配点'],
  ['recentBusinessTriggers', 'recent_business_triggers', 'AI 写信用客户资料 - 近期触发点'],
  ['recommendedFirstEmailAngle', 'recommended_first_email_angle', 'AI 写信用客户资料 - 首封切入角度'],
  ['negativeRelevanceSignals', 'negative_relevance_signals', 'AI 写信用客户资料 - 负面相关性信号'],
  ['confidenceScore', 'confidence_score', 'AI 写信用客户资料 - 可信度']
] as const;
const contactChannelPattern =
  /(?:[\w.+%-]+@[\w.-]+\.[A-Za-z]{2,}|mailto:|tel:|wa\.me|whatsapp\.com|linkedin\.com|facebook\.com|instagram\.com|twitter\.com|x\.com\/|tiktok\.com)/i;

/** Reads trusted CRM source snapshot fields into fact-id based AI writing facts. */
export function buildCrmSourceSnapshotFacts(value?: Record<string, unknown> | null): CrmAiWritingFact[] {
  if (!value) return [];

  const legacyFacts = sourceFactFields.flatMap(field => {
    const normalized = normalizeSourceFactValue(value[field]);

    return normalized
      ? [
          {
            id: `source_snapshot.${field}`,
            label: field,
            value: normalized,
            source: 'source_snapshot' as const
          }
        ]
      : [];
  });

  return [...legacyFacts, ...buildEmailWritingContextFacts(value.emailWritingContext)];
}

function normalizeSourceFactValue(value: unknown): string {
  if (typeof value === 'string') return normalizeSafeText(value);
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (Array.isArray(value))
    return value
      .map(item => normalizeSourceFactValue(item))
      .filter(Boolean)
      .join(', ');
  return '';
}

function buildEmailWritingContextFacts(value: unknown): CrmAiWritingFact[] {
  const context = readRecord(value);
  if (!context) return [];

  const facts: CrmAiWritingFact[] = emailWritingFactFields.flatMap(([field, factId, label]) => {
    const normalized = normalizeSourceFactValue(context[field]);

    return normalized
      ? [
          {
            id: `source_snapshot.email_writing.${factId}`,
            label,
            value: normalized,
            source: 'source_snapshot' as const
          }
        ]
      : [];
  });
  const evidenceItems = normalizeEmailWritingEvidenceItems(context.evidenceItems);

  if (evidenceItems) {
    facts.push({
      id: 'source_snapshot.email_writing.evidence_items',
      label: 'AI 写信用客户资料 - 短证据',
      value: evidenceItems,
      source: 'source_snapshot'
    });
  }

  return facts;
}

function normalizeEmailWritingEvidenceItems(value: unknown) {
  if (!Array.isArray(value)) return '';

  return value
    .flatMap(item => {
      const record = readRecord(item);
      if (!record) return [];

      const type = normalizeSafeText(record.type);
      const text = normalizeSafeText(record.text);
      const url = normalizeSafeText(record.url);
      if (!type || !text) return [];

      return [`${type}: ${text}${url ? ` (${url})` : ''}`];
    })
    .slice(0, 8)
    .join('\n');
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function normalizeSafeText(value: unknown) {
  if (typeof value !== 'string') return '';

  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized || contactChannelPattern.test(normalized)) return '';

  return normalized;
}
