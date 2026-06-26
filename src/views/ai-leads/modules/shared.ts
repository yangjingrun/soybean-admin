import { buildSocialLinkViews, type SocialLinkChannel, type SocialLinkView } from '@/utils/social-links';

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

export interface ProductLineSummaryItem {
  label: string;
  value: string;
}

export interface AiLeadContextOption {
  key: string;
  label: string;
  description: string;
  promptHint: string;
}

export interface AiLeadContextSnapshotInput {
  targetRegionValue: string;
  targetRegionLabel: string;
  targetRegionCountryCode?: string | null;
  targetCustomerTypeKeys: string[];
  exclusionRuleKeys: string[];
  keywordText: string;
  supplementalRequirement: string;
  targetLeadCount: number | null;
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

export type AiLeadCandidateSocialChannel = SocialLinkChannel;

export type AiLeadCandidateSocialLink = SocialLinkView;

export interface AiLeadCandidateClassificationTag {
  key: string;
  label: string;
  type: 'default' | 'success' | 'info' | 'warning' | 'error';
  tooltip?: string;
}

export const aiLeadTargetCustomerTypeOptions: AiLeadContextOption[] = [
  {
    key: 'importer',
    label: '进口商',
    description: '海外本地进口贸易商，有跨境采购、清关和批量补货需求。',
    promptHint: 'importer, import company, import/export company'
  },
  {
    key: 'distributor_dealer',
    label: '经销商/代理商',
    description: '服务本地渠道或行业客户，常见 Products、Brands、Catalog、Distribution 信号。',
    promptHint: 'distributor, dealer, authorized dealer, local distributor'
  },
  {
    key: 'wholesaler_stockist',
    label: '批发商/库存商',
    description: '有库存、批量补货和价格/MOQ/交期敏感度，适合找稳定供货机会。',
    promptHint: 'wholesaler, stockist, wholesale supplier, stock supplier'
  },
  {
    key: 'industrial_supplier',
    label: '工业品供应商',
    description: '面向工厂、维修、工程客户供货，适合工业零部件、耗材和设备类产品。',
    promptHint: 'industrial supplier, industrial distributor, industrial supplies'
  },
  {
    key: 'mro_spare_parts',
    label: 'MRO/备件商',
    description: '维护维修和替换件采购场景明确，适合轴承、机械件、电气件、耗材。',
    promptHint: 'MRO supplier, spare parts supplier, maintenance supplier'
  },
  {
    key: 'oem_manufacturer',
    label: 'OEM/设备制造商',
    description: '把产品装进整机、BOM 或生产线，关注规格、稳定性、样品和验证。',
    promptHint: 'OEM manufacturer, equipment manufacturer, machinery manufacturer'
  },
  {
    key: 'project_contractor',
    label: '项目方/EPC/承包商',
    description: '按项目采购，适合设备、工程配套、安装维护、招标和批量交付。',
    promptHint: 'contractor, EPC, project company, engineering contractor'
  },
  {
    key: 'system_integrator_installer',
    label: '集成商/安装商',
    description: '有方案集成、安装和现场服务需求，适合设备、电子、电气和工程类产品。',
    promptHint: 'system integrator, installer, installation company'
  },
  {
    key: 'repair_service',
    label: '维修服务商',
    description: '围绕维修、翻新、替换件采购，官网常见 Services、Repair、Maintenance。',
    promptHint: 'repair service, maintenance service, service center'
  },
  {
    key: 'trading_company',
    label: '贸易公司/采购代理',
    description: '可作为补充线索，需要官网证据确认是否真的服务目标市场客户。',
    promptHint: 'trading company, procurement agent, sourcing company'
  },
  {
    key: 'brand_agent',
    label: '品牌代理/授权代理',
    description: '代理同类或竞品品牌，适合从品牌替代、备选供应角度开发。',
    promptHint: 'authorized distributor, brand agent, brand dealer'
  },
  {
    key: 'retailer_chain',
    label: '零售/连锁门店',
    description: '适合消费品和门店型批发；工业 B2B 场景通常设为低优先级。',
    promptHint: 'retailer, chain store, showroom'
  }
];

export const aiLeadExclusionRuleOptions: AiLeadContextOption[] = [
  {
    key: 'china_supplier',
    label: '中国供应商/出口商',
    description: '排除中国官网、中国制造商、Alibaba/Made-in-China 等供应商来源。',
    promptHint: 'exclude China supplier, Chinese manufacturer, Alibaba, Made-in-China'
  },
  {
    key: 'wrong_market',
    label: '非目标国家客户',
    description: '官网地址、电话、业务主体明显不在本次目标国家/地区时降级或排除。',
    promptHint: 'exclude companies outside the selected target market'
  },
  {
    key: 'b2c_only',
    label: '纯 B2C 零售站',
    description: '排除只面向个人消费者、购物车商品页、低客单零售店。',
    promptHint: 'exclude B2C-only shops and consumer-only stores'
  },
  {
    key: 'marketplace_listing',
    label: '平台/目录聚合页',
    description: '排除 Amazon、eBay、AliExpress、黄页、SEO 聚合目录等非官网结果。',
    promptHint: 'exclude marketplace listings, directory-only pages, SEO aggregators'
  },
  {
    key: 'no_official_website',
    label: '无官网或证据不足',
    description: '没有官网、官网打不开、只有社媒/地图页且无法证明 B2B 采购身份时降级。',
    promptHint: 'exclude leads without official website or enough website evidence'
  },
  {
    key: 'irrelevant_product',
    label: '产品线不匹配',
    description: '官网产品线与 CRM 产品线无关联，或只出现弱泛词时不进入开发名单。',
    promptHint: 'exclude websites whose product line does not match the selected CRM product line'
  },
  {
    key: 'job_news_blog',
    label: '招聘/新闻/博客内容',
    description: '排除招聘、媒体、新闻、百科、博客文章等非采购主体页面。',
    promptHint: 'exclude job sites, media, news, blogs and encyclopedia pages'
  },
  {
    key: 'official_brand_hq',
    label: '品牌总部/竞争品牌官网',
    description: '排除只作为品牌方总部展示的官网；若有代理/分销入口再保留。',
    promptHint: 'exclude brand headquarters unless distributor or dealer pages show buying relevance'
  }
];

const defaultTargetCustomerTypeKeys = [
  'importer',
  'distributor_dealer',
  'wholesaler_stockist',
  'industrial_supplier',
  'mro_spare_parts'
];

const defaultExclusionRuleKeys = [
  'china_supplier',
  'wrong_market',
  'b2c_only',
  'marketplace_listing',
  'no_official_website',
  'irrelevant_product',
  'job_news_blog'
];

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

/** Returns the default foreign-trade buyer groups for a new AI leads session. */
export function createDefaultAiLeadTargetCustomerTypeKeys() {
  return [...defaultTargetCustomerTypeKeys];
}

/** Returns the default exclusion rules used before user-specific history is restored. */
export function createDefaultAiLeadExclusionRuleKeys() {
  return [...defaultExclusionRuleKeys];
}

/** Builds the per-user lead context snapshot sent with keyword optimization. */
export function createAiLeadContextSnapshot(
  input: AiLeadContextSnapshotInput
): Api.AiLeads.LeadContextSnapshot {
  const targetRegionLabel = input.targetRegionLabel.trim();
  const targetRegionValue = input.targetRegionValue.trim();
  const keywordText = input.keywordText.trim();
  const supplementalRequirement = input.supplementalRequirement.trim();

  return {
    targetRegion: targetRegionLabel
      ? {
          value: targetRegionValue,
          label: targetRegionLabel,
          countryCode: input.targetRegionCountryCode?.trim() || null
        }
      : null,
    targetCustomerTypes: resolveAiLeadContextOptions(input.targetCustomerTypeKeys, aiLeadTargetCustomerTypeOptions),
    exclusionRules: resolveAiLeadContextOptions(input.exclusionRuleKeys, aiLeadExclusionRuleOptions),
    keywordText: keywordText || null,
    supplementalRequirement: supplementalRequirement || null,
    targetLeadCount: input.targetLeadCount
  };
}

/** Builds the stable requirement text persisted in the current user's keyword history. */
export function buildAiLeadStructuredRequirement(snapshot: Api.AiLeads.LeadContextSnapshot) {
  const lines = [
    `目标国家/地区：${snapshot.targetRegion?.label || ''}`,
    `目标客户类型：${snapshot.targetCustomerTypes.map(item => item.label).join('、')}`,
    `搜索关键词/型号：${snapshot.keywordText || '按产品线资料自动扩展'}`,
    `排除类型：${snapshot.exclusionRules.map(item => item.label).join('、') || '无'}`,
    snapshot.supplementalRequirement ? `补充判断规则：${snapshot.supplementalRequirement}` : '',
    snapshot.targetLeadCount ? `采集数量：${snapshot.targetLeadCount}` : ''
  ].filter(Boolean);

  return lines.join('\n');
}

/** Reads one saved lead-context snapshot from a keyword plan. */
export function resolveKeywordPlanLeadContextSnapshot(plan: Api.AiLeads.OptimizedKeywordPlan | null | undefined) {
  return plan?.leadContextSnapshot ?? null;
}

/** Restores selected option keys from a saved snapshot while ignoring removed dictionary keys. */
export function resolveAiLeadContextKeysFromSnapshot(
  items: Api.AiLeads.LeadContextOptionSnapshot[] | null | undefined,
  options: AiLeadContextOption[],
  fallbackKeys: string[]
) {
  const optionKeys = new Set(options.map(item => item.key));
  const keys = (items ?? []).map(item => item.key).filter(key => optionKeys.has(key));

  return keys.length ? keys : [...fallbackKeys];
}

function resolveAiLeadContextOptions(keys: string[], options: AiLeadContextOption[]) {
  const selectedKeys = new Set(keys);

  return options
    .filter(option => selectedKeys.has(option.key))
    .map(option => ({
      key: option.key,
      label: option.label,
      description: option.description,
      promptHint: option.promptHint
    }));
}

/** Clones a keyword plan before editing so history selection does not mutate source records. */
export function cloneKeywordPlan(plan: Api.AiLeads.OptimizedKeywordPlan): Api.AiLeads.OptimizedKeywordPlan {
  return JSON.parse(JSON.stringify(plan)) as Api.AiLeads.OptimizedKeywordPlan;
}

/** Builds the product-line snapshot sent into AI lead keyword optimization. */
export function createAiLeadProductLineSnapshot(
  productLine: Api.Crm.ProductLineRecord
): Api.AiLeads.ProductLineSnapshot {
  return {
    id: productLine.id,
    name: productLine.name,
    targetCustomerType: productLine.targetCustomerType,
    coreSellingPoints: productLine.coreSellingPoints,
    moq: productLine.moq,
    leadTime: productLine.leadTime,
    paymentTerms: productLine.paymentTerms,
    certifications: productLine.certifications,
    catalogUrl: productLine.catalogUrl,
    websiteUrl: productLine.websiteUrl,
    commonModelsText: productLine.commonModelsText
  };
}

/** Builds compact product-line facts for the AI leads form. */
export function buildProductLineSummaryItems(
  productLine: Api.Crm.ProductLineRecord | Api.AiLeads.ProductLineSnapshot | null | undefined
): ProductLineSummaryItem[] {
  if (!productLine) {
    return [];
  }

  return [
    { label: '目标客户', value: productLine.targetCustomerType || '' },
    { label: '核心卖点', value: productLine.coreSellingPoints || '' },
    { label: '常见型号', value: productLine.commonModelsText || '' },
    { label: '认证', value: productLine.certifications || '' },
    { label: 'MOQ', value: productLine.moq || '' },
    { label: '交期', value: productLine.leadTime || '' }
  ].filter(item => item.value);
}

/** Reads the product-line id embedded in a keyword plan snapshot. */
export function resolveKeywordPlanProductLineId(plan: Api.AiLeads.OptimizedKeywordPlan | null | undefined) {
  return plan?.productLineSnapshot?.id ?? null;
}

/** Checks whether a reusable keyword plan belongs to the selected product line. */
export function isKeywordPlanForProductLine(
  plan: Api.AiLeads.OptimizedKeywordPlan | null | undefined,
  productLineId: string | null | undefined
) {
  return Boolean(productLineId && resolveKeywordPlanProductLineId(plan) === productLineId);
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
  const formatVisibleText = (text: string) =>
    annotateBusinessTerms(isSuperAdmin ? text : sanitizeKeywordOptimizationVisibleText(text));

  return {
    summaryItems: [
      { label: '需求归纳', value: formatVisibleText(plan.structuredRequirement) },
      { label: '产品关键词', value: formatVisibleText(plan.resolvedProductKeywords) },
      { label: '目标市场', value: formatVisibleText(plan.resolvedTargetRegions) },
      { label: '客户画像', value: formatVisibleText(plan.resolvedTargetCustomerProfile) }
    ],
    buyerSegments: plan.buyerSegments.map(segment => normalizeBuyerSegment(segment, formatVisibleText)),
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
  const mapsQueryText = viewModel.mapsQueries
    .map(query => `${query.buyerType}｜${query.intent}｜${query.q}`)
    .join('\n');

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
  const country = candidate.country?.trim();
  const city = candidate.city?.trim();
  const address = candidate.address?.trim();

  return {
    name: title,
    websiteUrl: website,
    ...(country ? { country } : {}),
    ...(city ? { city } : {}),
    ...(address ? { address } : {}),
    customerType: candidate.sourceLabel?.trim() || 'AI线索',
    sourceTaskId: options.sourceTaskId ?? null,
    sourceSnapshot: compactSourceSnapshot({
      title,
      website,
      snippet: candidate.snippet,
      country: candidate.country,
      city: candidate.city,
      address: candidate.address,
      phoneNumber: candidate.phoneNumber,
      sourceType: candidate.sourceType,
      sourceLabel: candidate.sourceLabel,
      sourceUrl: candidate.sourceUrl,
      score: candidate.score,
      reason: candidate.reason,
      websiteEvidence: candidate.websiteEvidence,
      precisionAnalysis: candidate.precisionAnalysis
    })
  };
}

/** Builds normalized social-channel links for the candidate result table. */
export function getAiLeadCandidateSocialLinks(
  candidate: Pick<Api.AiLeads.LeadSearchCandidateView, 'websiteEvidence'>
): AiLeadCandidateSocialLink[] {
  return buildSocialLinkViews([
    ...(candidate.websiteEvidence?.socialLinks ?? []),
    ...(candidate.websiteEvidence?.whatsappLinks ?? [])
  ]);
}

/** Builds customer-group tags from match analysis and official website country evidence. */
export function getAiLeadCandidateClassificationTags(
  candidate: Pick<Api.AiLeads.LeadSearchCandidateView, 'precisionAnalysis' | 'websiteEvidence'>
): AiLeadCandidateClassificationTag[] {
  const analysis = candidate.precisionAnalysis;
  const tags: AiLeadCandidateClassificationTag[] = [];

  if (analysis?.targetMarketFit === 'outside_target') {
    tags.push({
      key: 'outside-target',
      label: '非目标市场',
      type: 'error',
      tooltip: analysis.reason
    });
  }

  const companyCountry = analysis?.companyCountry?.trim();

  if (companyCountry) {
    tags.push({
      key: 'company-country',
      label: companyCountry === '中国' ? '中国公司' : `${companyCountry}公司`,
      type: companyCountry === '中国' ? 'warning' : 'info',
      tooltip: candidate.websiteEvidence?.companyAddressEvidence?.slice(0, 2).join('；') || analysis?.reason
    });
  }

  const customerGroup = analysis?.customerGroup?.trim();

  if (customerGroup) {
    tags.push({
      key: 'customer-group',
      label: customerGroup,
      type: analysis?.targetMarketFit === 'target' ? 'success' : 'default',
      tooltip: analysis?.reason
    });
  }

  return tags;
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

/** Removes provider/query-channel wording from regular-user visible strategy summaries. */
function sanitizeKeywordOptimizationVisibleText(text: string) {
  return text
    .replace(/Serper\s+Search\s+查询(词|计划)?/gi, '搜索查询$1')
    .replace(/Serper\s+Places\s+查询(词|计划)?/gi, '本地商家查询$1')
    .replace(/Serper\s+Maps\s+查询(词|计划)?/gi, '地图查询$1')
    .replace(/Serper\s*(Search|Places|Maps)?/gi, '')
    .replace(/([\u4e00-\u9fff])\s+(搜索|本地商家|地图)查询/g, '$1$2查询')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function normalizeBuyerSegment(
  segment: Api.AiLeads.BuyerSegment,
  formatVisibleText: (text: string) => string
): Api.AiLeads.BuyerSegment {
  return {
    ...segment,
    buyerType: formatVisibleText(segment.buyerType),
    purchaseReason: formatVisibleText(segment.purchaseReason),
    websiteSignals: segment.websiteSignals.map(formatVisibleText),
    priorityContacts: segment.priorityContacts.map(formatVisibleText),
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
