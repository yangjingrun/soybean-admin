export interface KeywordOptimizationSummaryItem {
  label: string;
  value: string;
}

export interface KeywordOptimizationQueryRow {
  buyerType: string;
  intent: string;
  q: string;
  location: string;
  city?: string;
  priority: string;
}

export interface KeywordOptimizationViewModel {
  summaryItems: KeywordOptimizationSummaryItem[];
  buyerSegments: Api.AiLeads.BuyerSegment[];
  searchQueries: KeywordOptimizationQueryRow[];
  placesQueries: KeywordOptimizationQueryRow[];
  showQueryDetails: boolean;
}

const businessGlossary = [
  ['auto_parts_wholesaler', '汽配批发商'],
  ['industrial_supplier', '工业用品供应商'],
  ['local_supplier', '本地供应商'],
  ['local_dealer', '本地经销商'],
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

  return `${summaryText}\n\n${buyerSegmentText}\n\nSearch 查询词：\n${searchQueryText}\n\nPlaces 查询词：\n${placesQueryText}`;
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
  query: Api.AiLeads.SerperSearchQuery | Api.AiLeads.SerperPlacesQuery
): KeywordOptimizationQueryRow {
  return {
    buyerType: annotateBusinessTerms(readQueryMetaValue(query, 'buyerType')),
    intent: annotateBusinessTerms(readQueryMetaValue(query, 'intent')),
    q: query.requestBody?.q || query.q || '',
    location: query.requestBody?.location || query.location || '',
    city: query.meta?.city || ('city' in query ? query.city : undefined),
    priority: readQueryMetaValue(query, 'priority')
  };
}

function readQueryMetaValue(
  query: Api.AiLeads.SerperSearchQuery | Api.AiLeads.SerperPlacesQuery,
  key: 'buyerType' | 'intent' | 'priority'
) {
  return query.meta?.[key] || query[key] || '';
}

function getPlacesQueries(plan: Api.AiLeads.OptimizedKeywordPlan) {
  return plan.serperPlacesQueries ?? plan.serperMapsQueries ?? [];
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
