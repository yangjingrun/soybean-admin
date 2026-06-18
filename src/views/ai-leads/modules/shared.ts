export interface KeywordOptimizationSummaryItem {
  label: string;
  value: string;
}

export interface KeywordOptimizationViewModel {
  summaryItems: KeywordOptimizationSummaryItem[];
  buyerSegments: Api.AiLeads.BuyerSegment[];
  searchQueries: Api.AiLeads.SerperSearchQuery[];
  mapsQueries: Api.AiLeads.SerperMapsQuery[];
  showQueryDetails: boolean;
}

/** Parses the AI keyword optimization result into the agreed structured JSON plan. */
export function parseKeywordOptimizationPlan(text: string): Api.AiLeads.OptimizedKeywordPlan {
  return JSON.parse(text) as Api.AiLeads.OptimizedKeywordPlan;
}

/** Builds the UI model and keeps query details behind the super-admin permission. */
export function createKeywordOptimizationViewModel(
  plan: Api.AiLeads.OptimizedKeywordPlan,
  isSuperAdmin: boolean
): KeywordOptimizationViewModel {
  return {
    summaryItems: [
      { label: '需求归纳', value: plan.structuredRequirement },
      { label: '产品关键词', value: plan.resolvedProductKeywords },
      { label: '目标市场', value: plan.resolvedTargetRegions },
      { label: '客户画像', value: plan.resolvedTargetCustomerProfile }
    ],
    buyerSegments: plan.buyerSegments,
    searchQueries: isSuperAdmin ? plan.serperSearchQueries : [],
    mapsQueries: isSuperAdmin ? plan.serperMapsQueries : [],
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
  const mapsQueryText = viewModel.mapsQueries
    .map(query => `${query.buyerType}｜${query.intent}｜${query.q}`)
    .join('\n');

  return `${summaryText}\n\n${buyerSegmentText}\n\nSearch 查询词：\n${searchQueryText}\n\nMaps 查询词：\n${mapsQueryText}`;
}
