export interface AiLeadContextTargetRegion {
  value: string;
  label: string;
  countryCode?: string | null;
  scope?: AiLeadContextTargetRegionScope;
  marketRegionCode?: string | null;
  marketRegionLabel?: string | null;
}

export type AiLeadContextTargetRegionScope = 'market_region' | 'country' | 'admin1' | 'city';

export interface AiLeadContextOptionSnapshot {
  key: string;
  label: string;
  description?: string | null;
  promptHint?: string | null;
}

export interface AiLeadKeywordContextSnapshot {
  targetRegion: AiLeadContextTargetRegion | null;
  targetRegions: AiLeadContextTargetRegion[];
  targetCustomerTypes: AiLeadContextOptionSnapshot[];
  exclusionRules: AiLeadContextOptionSnapshot[];
  keywordText?: string | null;
  supplementalRequirement?: string | null;
  targetLeadCount?: number | null;
}

export interface AiLeadExclusionDecisionRule {
  key: string;
  label: string;
  matchCriteria: string[];
  insufficientSignals: string[];
  recommendedDecision: string;
}

const maxContextItemCount = 20;

/** Reads the structured AI leads context from user payloads without trusting unknown extra fields. */
export function normalizeAiLeadKeywordContextSnapshot(value: unknown): AiLeadKeywordContextSnapshot | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const input = value as Record<string, unknown>;
  const targetRegions = normalizeTargetRegions(input);

  return {
    targetRegion: targetRegions[0] ?? null,
    targetRegions,
    targetCustomerTypes: normalizeContextOptions(input.targetCustomerTypes),
    exclusionRules: normalizeContextOptions(input.exclusionRules),
    keywordText: normalizeNullableString(input.keywordText),
    supplementalRequirement: normalizeNullableString(input.supplementalRequirement),
    targetLeadCount: normalizeTargetLeadCount(input.targetLeadCount)
  };
}

/** Attaches the user's per-run lead context snapshot to keyword plans stored in user history. */
export function attachLeadContextSnapshotToKeywordPlan<T extends Record<string, unknown>>(
  keywordPlan: T,
  snapshot: AiLeadKeywordContextSnapshot | null
): T {
  if (!snapshot) {
    return keywordPlan;
  }

  return {
    ...keywordPlan,
    leadContextSnapshot: snapshot
  };
}

/** Formats the per-user context block injected into promptKey-driven keyword generation. */
export function formatAiLeadKeywordContextPromptBlock(snapshot: AiLeadKeywordContextSnapshot | null) {
  if (!snapshot) {
    return '';
  }

  const exclusionDecisionRules = buildAiLeadExclusionDecisionRules(snapshot.exclusionRules);
  const lines = [
    `目标国家/地区：${formatTargetRegions(snapshot) || '-'}`,
    `目标层级说明：大区/洲用于市场归类，国家用于市场判断，城市/区域用于精准开发。`,
    `市场归类：${formatMarketRegions(snapshot) || '-'}`,
    `国家市场：${formatCountryRegions(snapshot) || '-'}`,
    `城市/区域：${formatPreciseRegions(snapshot) || '-'}`,
    `搜索关键词/型号：${snapshot.keywordText || '按产品线资料自动扩展'}`,
    `客户类型：${formatContextOptions(snapshot.targetCustomerTypes) || '-'}`,
    `排除类型：${formatContextOptions(snapshot.exclusionRules) || '无'}`,
    `补充判断规则：${snapshot.supplementalRequirement || '-'}`,
    `采集数量：${snapshot.targetLeadCount ?? '-'}`
  ];
  const exclusionGuidance = exclusionDecisionRules.length
    ? `\n\n【排除类型判定细则】\n${exclusionDecisionRules.map(formatExclusionDecisionRule).join('\n')}`
    : '';

  return `\n【结构化获客条件 leadContext】\n${lines.map(line => `- ${line}`).join('\n')}
${exclusionGuidance}
- leadContext 来自当前用户本次选择或用户自己的关键词历史，不是全局提示词配置。
- 客户类型必须驱动 buyerSegments、Search/Places/Maps 查询词和优先联系岗位。
- 排除类型必须进入 searchExecutionRules.exclude，并在查询规划和精准分析中按判定细则避免对应低价值来源。
- 目标国家/地区必须作为 gl、hl、location、本地语言计划和目标市场客户判断的主约束。`;
}

/** Builds deterministic exclusion guidance shared by keyword planning and match analysis. */
export function buildAiLeadExclusionDecisionRules(
  items: AiLeadContextOptionSnapshot[] | null | undefined
): AiLeadExclusionDecisionRule[] {
  return (items ?? []).map(item => buildAiLeadExclusionDecisionRule(item));
}

function buildAiLeadExclusionDecisionRule(item: AiLeadContextOptionSnapshot): AiLeadExclusionDecisionRule {
  const fallback: AiLeadExclusionDecisionRule = {
    key: item.key,
    label: item.label,
    matchCriteria: [item.description, item.promptHint].filter((value): value is string => Boolean(value)),
    insufficientSignals: ['只有泛化词或弱相关描述时不要直接按排除命中'],
    recommendedDecision: '命中强证据时降级或 reject；证据不足时 reviewRequired=true'
  };

  const rules: Record<string, Omit<AiLeadExclusionDecisionRule, 'key' | 'label'>> = {
    china_supplier: {
      matchCriteria: [
        '官网 Contact/About/footer/公司地址/工商主体明确在中国，或电话为 +86',
        '多语言地址块明确出现中国、中国城市/省份、الصين、Xiamen、Fujian、Shenzhen、Guangdong 等公司地址信号',
        'Alibaba、Made-in-China 等中国供应商店铺或平台主体'
      ],
      insufficientSignals: [
        'China brands、made in China、manufacturer in China、Chinese brand 只是产品/品牌来源，不足以证明公司归属中国',
        '页面提到中国客户、中国工厂或中国品牌，但官网主体地址和电话不在中国时不能硬判中国公司'
      ],
      recommendedDecision: '强证据命中时 priority=reject、targetMarketFit=outside_target；弱证据只写入 risks 并人工复核'
    },
    wrong_market: {
      matchCriteria: [
        '官网地址、电话、业务主体、门店或服务区域明确在用户选择的目标国家/地区之外',
        '用户选择国家时，其他国家客户应降级或排除；用户选择大区时，大区内国家不应被误杀'
      ],
      insufficientSignals: [
        '全球供货、shipping worldwide、多国家分支不能单独证明非目标市场',
        '品牌官网列出多个国家办事处时，要看当前主体或联系页归属'
      ],
      recommendedDecision: '明确非目标市场 priority=reject 或 low；大区内国家保留，标注实际国家'
    },
    b2c_only: {
      matchCriteria: [
        '页面只有个人消费购物车、单品零售、低客单价零售流程',
        '没有 wholesale、dealer、trade account、bulk order、RFQ、B2B inquiry 等商业采购入口'
      ],
      insufficientSignals: [
        '有商品页不等于 B2C；若存在批发、经销、工业客户或 RFQ 入口，应保留或复核'
      ],
      recommendedDecision: '纯 B2C priority=reject；B2B/B2C 混合站点按证据给 low/medium 并 reviewRequired'
    },
    marketplace_listing: {
      matchCriteria: [
        'Amazon、eBay、AliExpress、Tradeling 商品页、黄页、目录站、SEO 聚合页、公司列表页',
        '页面主体是平台或目录而非目标客户自己的官网'
      ],
      insufficientSignals: [
        '目录页里的公司名称、电话或官网链接可作为二次挖掘线索，但目录页本身不是客户'
      ],
      recommendedDecision: '最终客户 priority=reject；recommendedAction 写明可反挖真实官网'
    },
    no_official_website: {
      matchCriteria: [
        '缺少官网、官网抓取失败、只有社媒/地图页，且无法证明 B2B 采购身份',
        '官网无 About/Products/Contact/Brands/Services 等基本真实性证据'
      ],
      insufficientSignals: [
        '地图标题、地址、电话强命中目标买家时，不要机械 reject，应保留人工复核',
        '临时抓取失败不能证明客户无价值'
      ],
      recommendedDecision: '证据不足时 low/medium + reviewRequired；完全无主体证据时 reject'
    },
    irrelevant_product: {
      matchCriteria: [
        '官网主营产品、当前页面、标题、URL、片段与 CRM 产品线无关',
        '只出现 supplier、products、parts 等泛词，没有目标产品或同类产品证据'
      ],
      insufficientSignals: [
        '当前官网页面、标题、URL 或片段强命中产品线时，不要因为其他类目混杂直接 reject',
        '多品类工业品供应商只要有目标产品线证据，应保留或复核'
      ],
      recommendedDecision: '无产品线证据 reject；强产品证据但客户群体不确定时 low + reviewRequired'
    },
    job_news_blog: {
      matchCriteria: [
        '招聘页、新闻稿、媒体报道、百科、博客文章、论坛内容是页面主体',
        '页面无法证明它是采购主体或目标客户官网'
      ],
      insufficientSignals: [
        '公司官网包含 News/Blog/Careers 栏目不能单独作为排除依据',
        '若同域名有 Products/About/Contact 等主体页面，应按官网主体分析'
      ],
      recommendedDecision: '文章/招聘/媒体页面 reject；同域官网主体可继续分析'
    },
    official_brand_hq: {
      matchCriteria: [
        '品牌总部、制造商品牌官网、竞争品牌区域官网，主要展示自有品牌和分销网络',
        '没有作为进口商/经销商/批发商采购外部供应的证据'
      ],
      insufficientSignals: [
        '品牌官网的 dealer/distributor finder 页面可用于反挖本地经销商，不等于该品牌总部可开发',
        '授权经销商自己的官网不属于品牌总部，应按经销商分析'
      ],
      recommendedDecision: '品牌总部 priority=reject；分销商列表页作为二次线索，不直接入开发名单'
    }
  };

  const rule = rules[item.key];

  return rule ? { key: item.key, label: item.label, ...rule } : fallback;
}

function formatExclusionDecisionRule(rule: AiLeadExclusionDecisionRule) {
  return `- ${rule.label}（${rule.key}）：命中标准=${rule.matchCriteria.join('；')}；不足以直接排除=${rule.insufficientSignals.join('；')}；处理=${rule.recommendedDecision}`;
}

function normalizeTargetRegion(value: unknown): AiLeadContextTargetRegion | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const input = value as Record<string, unknown>;
  const label = normalizeString(input.label);

  if (!label) {
    return null;
  }

  return {
    value: normalizeString(input.value),
    label,
    countryCode: normalizeNullableString(input.countryCode),
    scope: normalizeTargetRegionScope(input.scope),
    marketRegionCode: normalizeNullableString(input.marketRegionCode),
    marketRegionLabel: normalizeNullableString(input.marketRegionLabel)
  };
}

function normalizeTargetRegions(input: Record<string, unknown>) {
  const regions = normalizeTargetRegionList(input.targetRegions);
  const legacyRegion = normalizeTargetRegion(input.targetRegion);

  if (regions.length) {
    return regions;
  }

  return legacyRegion ? [legacyRegion] : [];
}

function normalizeTargetRegionList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.slice(0, maxContextItemCount).flatMap(item => {
    const region = normalizeTargetRegion(item);

    return region ? [region] : [];
  });
}

function normalizeContextOptions(value: unknown): AiLeadContextOptionSnapshot[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.slice(0, maxContextItemCount).flatMap(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return [];
    }

    const input = item as Record<string, unknown>;
    const key = normalizeString(input.key);
    const label = normalizeString(input.label);

    if (!key || !label) {
      return [];
    }

    return [
      {
        key,
        label,
        description: normalizeNullableString(input.description),
        promptHint: normalizeNullableString(input.promptHint)
      }
    ];
  });
}

function formatContextOptions(items: AiLeadContextOptionSnapshot[]) {
  return items
    .map(item => {
      const details = [item.description, item.promptHint ? `搜索表达：${item.promptHint}` : null].filter(Boolean);

      return details.length ? `${item.label}（${details.join('；')}）` : item.label;
    })
    .join('；');
}

function formatTargetRegions(snapshot: AiLeadKeywordContextSnapshot) {
  const regions = snapshot.targetRegions.length ? snapshot.targetRegions : snapshot.targetRegion ? [snapshot.targetRegion] : [];

  return regions.map(item => item.label).join('、');
}

function formatMarketRegions(snapshot: AiLeadKeywordContextSnapshot) {
  return uniqueStrings(
    getSnapshotRegions(snapshot).flatMap(item => [
      item.scope === 'market_region' ? item.label : '',
      item.marketRegionLabel ?? ''
    ])
  ).join('、');
}

function formatCountryRegions(snapshot: AiLeadKeywordContextSnapshot) {
  return uniqueStrings(
    getSnapshotRegions(snapshot).flatMap(item => {
      if (item.scope === 'market_region') {
        return [];
      }

      return [item.scope === 'country' ? item.label : readCountryLabelFromRegionLabel(item.label)];
    })
  ).join('、');
}

function formatPreciseRegions(snapshot: AiLeadKeywordContextSnapshot) {
  return uniqueStrings(
    getSnapshotRegions(snapshot).flatMap(item =>
      item.scope === 'admin1' || item.scope === 'city' ? [item.label] : []
    )
  ).join('、');
}

function getSnapshotRegions(snapshot: AiLeadKeywordContextSnapshot) {
  return snapshot.targetRegions.length ? snapshot.targetRegions : snapshot.targetRegion ? [snapshot.targetRegion] : [];
}

function readCountryLabelFromRegionLabel(label: string) {
  return label.split('/')[0]?.trim() || label;
}

function normalizeTargetLeadCount(value: unknown) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 200 ? value : null;
}

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeNullableString(value: unknown) {
  const normalized = normalizeString(value);

  return normalized || null;
}

function normalizeTargetRegionScope(value: unknown): AiLeadContextTargetRegionScope {
  return value === 'market_region' || value === 'admin1' || value === 'city' ? value : 'country';
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map(item => item.trim()).filter(Boolean)));
}
