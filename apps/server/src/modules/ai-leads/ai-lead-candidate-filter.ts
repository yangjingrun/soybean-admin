const blockedLeadHostPatterns = [
  /(^|\.)taobao\.com$/i,
  /(^|\.)tmall\.com$/i,
  /(^|\.)1688\.com$/i,
  /(^|\.)alibaba\.com$/i,
  /(^|\.)made-in-china\.com$/i,
  /(^|\.)ruten\.com\.tw$/i,
  /(^|\.)bid\.yahoo\.com$/i,
  /(^|\.)shopee\.(?:com|tw|sg|my|ph|id|vn|th)$/i,
  /(^|\.)pchome\.com\.tw$/i,
  /(^|\.)momo\.com\.tw$/i,
  /(^|\.)yahoo\.com$/i,
  /(^|\.)ebay\./i,
  /(^|\.)amazon\./i
];

const blockedLeadTextPatterns = [
  /淘寶/i,
  /淘宝/i,
  /拍賣/i,
  /拍卖/i,
  /auction/i,
  /marketplace/i,
  /商城/i,
  /賣場/i,
  /卖场/i
];

/** Filters marketplace and consumer platform results before expensive enrichment providers run. */
export function isBlockedLeadCandidate(input: { url?: string | null; title?: string | null }) {
  const normalizedHost = getDomain(input.url ?? '').toLowerCase();
  const title = input.title ?? '';

  return (
    blockedLeadHostPatterns.some(pattern => pattern.test(normalizedHost)) ||
    blockedLeadTextPatterns.some(pattern => pattern.test(title))
  );
}

function getDomain(url: string) {
  if (!url) {
    return '';
  }

  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}
