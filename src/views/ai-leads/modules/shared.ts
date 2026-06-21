export interface KeywordOptimizationSummaryItem {
  label: string;
  value: string;
}

export interface KeywordOptimizationQueryRow {
  buyerType: string;
  intent: string;
  q: string;
  location: string;
  ll?: string;
  city?: string;
  priority: string;
}

export interface KeywordOptimizationViewModel {
  summaryItems: KeywordOptimizationSummaryItem[];
  buyerSegments: Api.AiLeads.BuyerSegment[];
  searchQueries: KeywordOptimizationQueryRow[];
  placesQueries: KeywordOptimizationQueryRow[];
  mapsQueries: KeywordOptimizationQueryRow[];
  showQueryDetails: boolean;
}

export interface AiLeadCandidateImportState {
  key: string;
  canImport: boolean;
  domain: string | null;
  reasons: string[];
}

export interface AiLeadCandidateImportRow {
  candidate: Api.AiLeads.LeadSearchCandidateView;
  importState: AiLeadCandidateImportState;
}

const businessGlossary = [
  ['auto_parts_wholesaler', '汽配批发商'],
  ['industrial_supplier', '工业用品供应商'],
  ['local_distributor', '本地经销商'],
  ['local_wholesaler', '本地批发商'],
  ['local_supplier', '本地供应商'],
  ['local_dealer', '本地经销商'],
  ['mro_supplier', '维护维修耗材供应商'],
  ['repair_service', '维修服务商'],
  ['trading_company', '贸易公司'],
  ['trade_show', '展会'],
  ['recent_signal', '近期信号'],
  ['industrial distributor', '工业品经销商'],
  ['authorized distributor', '授权经销商'],
  ['multi-brand supplier', '多品牌供应商'],
  ['spare parts supplier', '备件供应商'],
  ['industrial supplier', '工业用品供应商'],
  ['MRO supplier', '维护维修耗材供应商'],
  ['trading company', '贸易公司'],
  ['project company', '项目采购公司'],
  ['system integrator', '系统集成商'],
  ['brand owner', '品牌方'],
  ['chain store', '连锁门店'],
  ['stockist', '库存商'],
  ['importer', '进口商'],
  ['distributor', '经销商'],
  ['wholesaler', '批发商'],
  ['dealer', '代理商'],
  ['supplier', '供应商'],
  ['contractor', '承包商'],
  ['installer', '安装商'],
  ['retailer', '零售商'],
  ['Products', '产品页'],
  ['Brands', '品牌页'],
  ['Industries', '行业页'],
  ['Services', '服务页'],
  ['Projects', '项目页'],
  ['Catalog', '目录页'],
  ['Downloads', '下载页'],
  ['About', '关于我们页'],
  ['Contact', '联系页'],
  ['Stock', '库存页'],
  ['Distribution', '分销页'],
  ['Wholesale', '批发页'],
  ['Dealership', '代理页'],
  ['Partners', '合作伙伴页'],
  ['Purchase Manager', '采购经理'],
  ['Purchasing Manager', '采购经理'],
  ['Procurement Manager', '采购经理'],
  ['General Manager', '总经理'],
  ['Sales Manager', '销售经理'],
  ['Product Manager', '产品经理'],
  ['Operations Manager', '运营经理'],
  ['Owner', '负责人']
] as const;

const aiFinishReasonLabels: Record<string, string> = {
  stop: '正常完成',
  length: '输出被截断',
  content_filter: '内容被过滤',
  'content-filter': '内容被过滤',
  tool_calls: '工具调用完成',
  'tool-calls': '工具调用完成',
  error: '生成异常',
  other: '已结束',
  unknown: '状态待确认'
};

const lowQualityCandidateTitles = new Set([
  'home',
  'homepage',
  'contact',
  'contact us',
  'about',
  'about us',
  'login',
  'untitled'
]);

/** Parses the AI keyword optimization result into the agreed structured JSON plan. */
export function parseKeywordOptimizationPlan(text: string): Api.AiLeads.OptimizedKeywordPlan {
  return JSON.parse(text) as Api.AiLeads.OptimizedKeywordPlan;
}

/** Converts raw AI finish reasons into user-facing status text. */
export function formatAiFinishReason(reason?: string | null) {
  const normalizedReason = reason?.trim();

  if (!normalizedReason) {
    return '';
  }

  return aiFinishReasonLabels[normalizedReason] || '已结束';
}

/** Restores the AI text result shape used by the result panel from one saved history. */
export function createAiResultFromKeywordHistory(record: Api.AiLeads.KeywordHistoryRecord): Api.AiGateway.AiTextResult {
  return {
    text: record.resultText,
    finishReason: record.finishReason,
    usage: record.usage
  };
}

/** Builds the API payload for saving edited keyword optimization content. */
export function buildKeywordHistoryUpdatePayload(
  requirement: string,
  keywordPlan: Api.AiLeads.OptimizedKeywordPlan
): Api.AiLeads.UpdateKeywordHistoryPayload {
  return {
    requirement: requirement.trim(),
    keywordPlan
  };
}

/** Clones a keyword plan before editing so history selection does not mutate source records. */
export function cloneKeywordPlan(plan: Api.AiLeads.OptimizedKeywordPlan): Api.AiLeads.OptimizedKeywordPlan {
  return JSON.parse(JSON.stringify(plan)) as Api.AiLeads.OptimizedKeywordPlan;
}

/** Checks whether a target lead count can be sent to the search workflow. */
export function isValidTargetLeadCount(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 200;
}

/**
 * Syncs AI-parsed lead count into the form only when the user has not manually edited the count.
 */
export function resolveTargetLeadCountAfterOptimization(options: {
  currentValue: number | null;
  resolvedValue: number | null | undefined;
  isManuallyEdited: boolean;
  defaultValue: number;
}) {
  if (options.isManuallyEdited) {
    return options.currentValue;
  }

  if (isValidTargetLeadCount(options.resolvedValue)) {
    return options.resolvedValue;
  }

  return isValidTargetLeadCount(options.currentValue) ? options.currentValue : options.defaultValue;
}

/** Builds the UI model and keeps query details behind the super-admin permission. */
export function createKeywordOptimizationViewModel(
  plan: Api.AiLeads.OptimizedKeywordPlan,
  isSuperAdmin: boolean
): KeywordOptimizationViewModel {
  return {
    summaryItems: [
      { label: '需求归纳', value: annotateBusinessTerms(plan.structuredRequirement) },
      { label: '产品关键词', value: annotateBusinessTerms(plan.resolvedProductKeywords) },
      { label: '目标市场', value: annotateBusinessTerms(plan.resolvedTargetRegions) },
      { label: '客户画像', value: annotateBusinessTerms(plan.resolvedTargetCustomerProfile) }
    ],
    buyerSegments: plan.buyerSegments.map(normalizeBuyerSegment),
    searchQueries: isSuperAdmin ? (plan.serperSearchQueries ?? []).map(normalizeQueryRow) : [],
    placesQueries: isSuperAdmin ? getPlacesQueries(plan).map(normalizeQueryRow) : [],
    mapsQueries: isSuperAdmin ? (plan.serperMapsQueries ?? []).map(normalizeQueryRow) : [],
    showQueryDetails: isSuperAdmin
  };
}

/** Formats the currently visible keyword optimization fields for clipboard copy. */
export function formatKeywordOptimizationVisibleText(viewModel: KeywordOptimizationViewModel) {
  const summaryText = viewModel.summaryItems.map(item => `${item.label}：${item.value}`).join('\n');
  const buyerSegmentText = viewModel.buyerSegments
    .map(segment =>
      [
        `买家类型：${segment.buyerType}`,
        `采购原因：${segment.purchaseReason}`,
        `官网信号：${segment.websiteSignals.join('、')}`,
        `优先联系人：${segment.priorityContacts.join('、')}`,
        `优先级：${segment.priorityLevel}`
      ].join('\n')
    )
    .join('\n\n');

  if (!viewModel.showQueryDetails) {
    return `${summaryText}\n\n${buyerSegmentText}`;
  }

  const searchQueryText = viewModel.searchQueries
    .map(query => `${query.buyerType}｜${query.intent}｜${query.q}`)
    .join('\n');
  const placesQueryText = viewModel.placesQueries
    .map(query => `${query.buyerType}｜${query.intent}｜${query.q}`)
    .join('\n');
  const mapsQueryText = viewModel.mapsQueries.map(query => `${query.buyerType}｜${query.intent}｜${query.q}`).join('\n');

  return `${summaryText}\n\n${buyerSegmentText}\n\nSearch 查询词：\n${searchQueryText}\n\nPlaces 查询词：\n${placesQueryText}\n\nMaps 查询词：\n${mapsQueryText}`;
}

/** Build candidate rows with import eligibility derived before any backend submit. */
export function buildAiLeadCandidateImportRows(
  candidates: Api.AiLeads.LeadSearchCandidateView[]
): AiLeadCandidateImportRow[] {
  const firstIndexByDomain = collectFirstIndexByDomain(candidates);

  return candidates.map((candidate, index) => ({
    candidate,
    importState: buildAiLeadCandidateImportState(candidate, index, firstIndexByDomain)
  }));
}

/** Convert one filtered AI-lead candidate into the CRM import payload. */
export function buildAiLeadCandidateImportPayload(
  candidate: Api.AiLeads.LeadSearchCandidateView,
  options: { sourceTaskId?: string | null } = {}
): Api.Crm.LeadImportPayload {
  const title = candidate.title?.trim() ?? '';
  const website = candidate.website?.trim() ?? '';

  return {
    name: title,
    websiteUrl: website,
    customerType: candidate.sourceLabel.trim(),
    sourceTaskId: options.sourceTaskId ?? null,
    sourceSnapshot: compactSourceSnapshot({
      title,
      website,
      snippet: candidate.snippet,
      address: candidate.address,
      phoneNumber: candidate.phoneNumber,
      sourceType: candidate.sourceType,
      sourceLabel: candidate.sourceLabel,
      sourceUrl: candidate.sourceUrl,
      score: candidate.score,
      reason: candidate.reason
    })
  };
}

/** Normalize the candidate website into a comparable domain key. */
export function normalizeAiLeadCandidateDomain(candidate: Pick<Api.AiLeads.LeadSearchCandidateView, 'website'>) {
  const website = candidate.website?.trim();

  if (!website) {
    return null;
  }

  try {
    const url = new URL(/^https?:\/\//i.test(website) ? website : `https://${website}`);

    return url.hostname.toLowerCase().replace(/^www\./, '') || null;
  } catch {
    return null;
  }
}

/** Adds Chinese notes for common B2B English terms without changing executable query text. */
function annotateBusinessTerms(text: string) {
  return businessGlossary.reduce((result, [term, translation]) => {
    const pattern = new RegExp(`(^|[^A-Za-z0-9])(${escapeRegExp(term)})(?![A-Za-z0-9]|（)`, 'gi');

    return result.replace(pattern, (_match, prefix: string, matchedTerm: string) => {
      return `${prefix}${matchedTerm}（${translation}）`;
    });
  }, text);
}

function normalizeBuyerSegment(segment: Api.AiLeads.BuyerSegment): Api.AiLeads.BuyerSegment {
  return {
    ...segment,
    buyerType: annotateBusinessTerms(segment.buyerType),
    purchaseReason: annotateBusinessTerms(segment.purchaseReason),
    websiteSignals: segment.websiteSignals.map(annotateBusinessTerms),
    priorityContacts: segment.priorityContacts.map(annotateBusinessTerms),
    preferredSerperChannel: segment.preferredSerperChannel
  };
}

function normalizeQueryRow(
  query: Api.AiLeads.SerperSearchQuery | Api.AiLeads.SerperPlacesQuery | Api.AiLeads.SerperMapsQuery
): KeywordOptimizationQueryRow {
  return {
    buyerType: annotateBusinessTerms(readQueryMetaValue(query, 'buyerType')),
    intent: annotateBusinessTerms(readQueryMetaValue(query, 'intent')),
    q: query.requestBody?.q || query.q || '',
    location: 'location' in query ? query.requestBody?.location || query.location || '' : '',
    ll: query.requestBody?.ll || ('ll' in query ? query.ll : undefined),
    city: query.meta?.city || ('city' in query ? query.city : undefined),
    priority: readQueryMetaValue(query, 'priority')
  };
}

function readQueryMetaValue(
  query: Api.AiLeads.SerperSearchQuery | Api.AiLeads.SerperPlacesQuery | Api.AiLeads.SerperMapsQuery,
  key: 'buyerType' | 'intent' | 'priority'
) {
  return query.meta?.[key] || query[key] || '';
}

function buildAiLeadCandidateImportState(
  candidate: Api.AiLeads.LeadSearchCandidateView,
  index: number,
  firstIndexByDomain: Map<string, number>
): AiLeadCandidateImportState {
  const domain = normalizeAiLeadCandidateDomain(candidate);
  const reasons: string[] = [];
  const title = candidate.title?.trim() ?? '';

  if (!title) {
    reasons.push('缺少公司名');
  }

  if (!domain) {
    reasons.push('缺少官网或域名');
  } else if (firstIndexByDomain.get(domain) !== index) {
    reasons.push('重复域名');
  }

  if (isObviousLowQualityCandidate(candidate)) {
    reasons.push('候选质量偏低');
  }

  return {
    key: `${domain || candidate.website || title || 'candidate'}-${index}`,
    canImport: reasons.length === 0,
    domain,
    reasons
  };
}

function collectFirstIndexByDomain(candidates: Api.AiLeads.LeadSearchCandidateView[]) {
  const firstIndexByDomain = new Map<string, number>();

  candidates.forEach((candidate, index) => {
    const domain = normalizeAiLeadCandidateDomain(candidate);

    if (domain && !firstIndexByDomain.has(domain)) {
      firstIndexByDomain.set(domain, index);
    }
  });

  return firstIndexByDomain;
}

function isObviousLowQualityCandidate(candidate: Api.AiLeads.LeadSearchCandidateView) {
  const title = candidate.title?.trim().toLowerCase() ?? '';
  const hasContext = Boolean(candidate.snippet?.trim() || candidate.address?.trim() || candidate.phoneNumber?.trim());

  return (
    lowQualityCandidateTitles.has(title) || (typeof candidate.score === 'number' && candidate.score < 40) || !hasContext
  );
}

function compactSourceSnapshot(record: Record<string, unknown>) {
  const entries = Object.entries(record).filter(([, value]) => {
    if (typeof value === 'string') {
      return Boolean(value.trim());
    }

    return value !== null && value !== undefined;
  });

  return Object.fromEntries(entries);
}

function getPlacesQueries(plan: Api.AiLeads.OptimizedKeywordPlan) {
  return plan.serperPlacesQueries ?? [];
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
