const targetRegionNames: Record<string, string> = {
  'saudi arabia': '沙特阿拉伯',
  ksa: '沙特阿拉伯',
  'united arab emirates': '阿联酋',
  uae: '阿联酋',
  emirates: '阿联酋',
  'south korea': '韩国',
  korea: '韩国',
  mexico: '墨西哥',
  usa: '美国',
  'united states': '美国',
  'united states of america': '美国',
  germany: '德国',
  france: '法国',
  italy: '意大利',
  spain: '西班牙',
  'united kingdom': '英国',
  uk: '英国',
  russia: '俄罗斯',
  turkey: '土耳其',
  india: '印度',
  vietnam: '越南',
  indonesia: '印度尼西亚',
  thailand: '泰国',
  malaysia: '马来西亚',
  brazil: '巴西',
  egypt: '埃及',
  'south africa': '南非',
  iran: '伊朗',
  iraq: '伊拉克',
  qatar: '卡塔尔',
  kuwait: '科威特',
  oman: '阿曼',
  bahrain: '巴林',
  jordan: '约旦',
  israel: '以色列'
};

type HistorySubjectTokenType = 'product' | 'region' | 'customer';

export interface HistorySubjectToken {
  type: HistorySubjectTokenType;
  text: string;
}

const productCategoryMatchers: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /轴承|bearing/i, label: '轴承' },
  { pattern: /轮胎|tire|tyre/i, label: '轮胎' },
  { pattern: /阀门|valve/i, label: '阀门' },
  { pattern: /水泵|泵|pump/i, label: '泵' },
  { pattern: /电机|motor/i, label: '电机' }
];

const customerTypeMatchers: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /进口商|importer/i, label: '进口商' },
  { pattern: /经销商|distributor/i, label: '经销商' },
  { pattern: /批发商|wholesaler|wholesale/i, label: '批发商' },
  { pattern: /代理商|dealer|agent/i, label: '代理商' },
  { pattern: /库存商|stockist/i, label: '库存商' },
  { pattern: /供应商|supplier/i, label: '供应商' },
  { pattern: /零售商|retailer/i, label: '零售商' },
  { pattern: /承包商|contractor/i, label: '承包商' },
  { pattern: /安装商|installer/i, label: '安装商' }
];

/** Formats saved target regions for the history list, keeping the country signal readable. */
export function formatHistoryTargetRegions(regions?: string | null) {
  const regionText = regions?.trim();

  if (!regionText) {
    return '';
  }

  // 分号/冒号后通常是城市、产业等说明，历史标题只保留国家信号。
  const regionTitleText = regionText.split(/[;；:：]/)[0]?.trim() || regionText;

  return regionTitleText
    .split(/[,，、/|;；]+|\s+and\s+/i)
    .map(region => region.trim())
    .filter(Boolean)
    .map(resolveTargetRegionName)
    .join('、');
}

/** Formats the history title as product, country and buyer type for quick scanning. */
export function formatHistorySubject(plan: Api.AiLeads.OptimizedKeywordPlan) {
  return formatHistorySubjectTokens(plan)
    .map(token => token.text)
    .join('  ');
}

/** Splits the history subject into UI tokens so key fields can be styled independently. */
export function formatHistorySubjectTokens(plan: Api.AiLeads.OptimizedKeywordPlan): HistorySubjectToken[] {
  return [
    { type: 'product', text: resolveProductCategory(plan) },
    { type: 'region', text: formatHistoryTargetRegions(plan.resolvedTargetRegions) },
    { type: 'customer', text: resolveCustomerTypes(plan) }
  ].filter((token): token is HistorySubjectToken => Boolean(token.text));
}

function resolveTargetRegionName(region: string) {
  const regionLower = region.toLowerCase();
  const exactName = targetRegionNames[regionLower];

  if (exactName) {
    return exactName;
  }

  const includedTargetName = Object.values(targetRegionNames).find(name => region.includes(name));

  if (includedTargetName) {
    return includedTargetName;
  }

  const includedAlias = Object.entries(targetRegionNames).find(([alias]) => regionLower.includes(alias));

  return includedAlias?.[1] || region;
}

function resolveProductCategory(plan: Api.AiLeads.OptimizedKeywordPlan) {
  const productText = [plan.resolvedProductKeywords, plan.structuredRequirement].filter(Boolean).join(' ');
  const matchedCategory = productCategoryMatchers.find(item => item.pattern.test(productText));

  if (matchedCategory) {
    return matchedCategory.label;
  }

  // 没匹配到已知类目时，取第一个关键词，避免历史标题过长。
  return plan.resolvedProductKeywords
    .split(/[,，、/|]+/)
    .map(keyword => keyword.trim())
    .find(Boolean);
}

function resolveCustomerTypes(plan: Api.AiLeads.OptimizedKeywordPlan) {
  const customerText = [plan.resolvedTargetCustomerProfile, ...plan.buyerSegments.map(segment => segment.buyerType)]
    .filter(Boolean)
    .join(' ');

  return customerTypeMatchers
    .filter(item => item.pattern.test(customerText))
    .map(item => item.label)
    .join('/');
}
