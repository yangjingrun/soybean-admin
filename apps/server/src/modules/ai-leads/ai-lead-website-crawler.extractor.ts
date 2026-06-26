import type {
  AiLeadWebsiteEvidence,
  AiLeadWebsiteEvidenceItem,
  AiLeadWebsiteEvidenceItemType,
  AiLeadWebsiteEvidenceKeywordOptions,
  AiLeadWebsitePageEvidence
} from './ai-lead-website-crawler.types';

const defaultProductKeywords = [
  'bearing',
  'traction',
  'elevator',
  'lift',
  'asansör',
  'asansor',
  'machine',
  'motor',
  'gearless',
  'geared',
  'escalator',
  'spare',
  'component'
];

const buyerSignalKeywords = [
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
  'products'
];

const whatsappPattern = /(?:wa\.me|whatsapp\.com)/i;
const mapPattern = /(?:maps\.google|goo\.gl\/maps|google\.[^/]+\/maps)/i;
const contactPathPattern = /(?:contact|about|iletisim|hakkimizda|support|sales|dealer|distributor|export)/i;
const companyBackgroundPathPattern = /(?:^\/$|\/(?:about|about-us|company|hakkimizda)(?:\/?$|[/?#]))/i;
const productPathPattern = /\/(?:products?|catalog|spare-parts?)(?:\/?$|[/?#])/i;
const applicationPathPattern = /\/(?:services?|industries|solutions?|applications?)(?:\/?$|[/?#])/i;
const brandPathPattern = /\/(?:brands?|partners?)(?:\/?$|[/?#])/i;
const recentActivityPathPattern = /\/(?:news|blog|events?|projects?|cases?)(?:\/?$|[/?#])/i;
const companyBackgroundPattern =
  /(?:company|about|founded|established|since|family-owned|headquartered|located|serving|speciali[sz]es|distributor|dealer|stockist|supplier)/i;
const applicationSignalPattern =
  /(?:application|industr(?:y|ies)|sector|market|maintenance|repair|mro|project|workshop|service|customers?|teams?)/i;
const brandSignalPattern = /(?:brand|authorized|authorised|dealer|partner|distributor|代理|授权)/i;
const recentActivitySignalPattern =
  /(?:news|opened|expanded|new warehouse|launch|launched|exhibition|trade show|project|recent|latest|hiring|新增|扩建|展会)/i;
const purchaseSignalPattern =
  /(?:importer|import|stockist|wholesaler|distributor|dealer|procurement|sourcing|purchasing|spare parts|replacement|mro|库存|采购)/i;
const addressLabelPattern =
  /(?:address|office|head\s*office|registered\s*office|地址|公司地址|联系地址|办公地址|总部|所在地|العنوان|عنوان|المكتب|مقر|contact\s*us)/i;
const chinaAddressLocationPattern =
  /(?:中国|中國|中华人民共和国|الصين|جمهورية\s*الصين|الصين\s*الشعبية|китай|кнр|중국|चीन|\bchina\b|\bprc\b|\bxiamen\b|\bfujian\b|\bfujan\b|\bjiahe\b|\bsiming\b|\bxinjing\b|\bshenzhen\b|\bguangzhou\b|\bguangdong\b|\bningbo\b|\bzhejiang\b|\bshanghai\b|\bbeijing\b|\bjiangsu\b|\bhebei\b|\bshandong\b|\bwenzhou\b|\bfoshan\b|\bdongguan\b|\bcixi\b|\byuyao\b|\bquanzhou\b)/i;
const turkeyAddressLocationPattern = /(?:\bturkey\b|\bturkiye\b|\btürkiye\b|\bistanbul\b|\+90[\s().-]*)/i;
const addressEvidencePattern = new RegExp(
  `(?:${addressLabelPattern.source}|${chinaAddressLocationPattern.source}|${turkeyAddressLocationPattern.source})`,
  'i'
);
const weakChinaOriginPattern =
  /(?:china\s+brands?|chinese\s+brands?|made\s+in\s+china|from\s+china|manufacturer\s+in\s+china|china\s+manufacturer|china\s+made|brands?\s+from\s+china|#\s*\d+\s+.*\bin\s+china)/i;
const regionNetworkPattern =
  /(?:across|regional|localized|operations?|network|global|worldwide|asia|countries|subsidiar|distributors?|partners?)/i;
const nonChinaCountryPattern =
  /(?:south\s+korea|korea|singapore|thailand|india|japan|malaysia|indonesia|vietnam|uae|united\s+arab\s+emirates|saudi\s+arabia|turkey|europe|america)/gi;
const socialHostDomains = [
  'linkedin.com',
  'facebook.com',
  'instagram.com',
  'youtube.com',
  'youtu.be',
  'x.com',
  'twitter.com',
  'tiktok.com',
  'pinterest.com'
];
const companyCountrySignalRules = [
  {
    label: '中国',
    countryPattern: /(?:\bchina\b|中国|中國|中华人民共和国|الصين|جمهورية\s*الصين|الصين\s*الشعبية|китай|кнр|중국|चीन)/i,
    locationPattern: chinaAddressLocationPattern,
    phonePattern: /\+86[\s().-]*/
  },
  {
    label: '土耳其',
    countryPattern: /(?:\bturkey\b|\bturkiye\b|\btürkiye\b)/i,
    locationPattern: turkeyAddressLocationPattern,
    phonePattern: /\+90[\s().-]*/
  }
];
const maxPageEvidenceItems = 8;
const maxMergedEvidenceItems = 24;

interface ExtractWebsitePageEvidenceInput {
  url: string;
  loadedUrl: string;
  statusCode: number;
  html: string;
}

/** Extracts contact channels and product evidence from one fetched website HTML page. */
export function extractWebsitePageEvidence(
  input: ExtractWebsitePageEvidenceInput,
  options: AiLeadWebsiteEvidenceKeywordOptions = {}
): AiLeadWebsitePageEvidence {
  const links = extractLinks(input.html, input.loadedUrl || input.url);
  const text = normalizeText(stripHtml(input.html));
  const title = extractTitle(input.html);
  const description = extractDescription(input.html);
  const combined = normalizeText(`${title} ${description} ${text} ${links.join(' ')}`);
  const targetKeywords = resolveTargetKeywords(options);
  const negativeKeywords = resolveNegativeKeywords(options);
  const evidenceSnippets = unique(extractEvidenceSnippets(text, targetKeywords), 6);
  const companyAddressEvidence = extractCompanyAddressEvidence(text);
  const negativeEvidenceSnippets = unique(extractEvidenceSnippets(text, negativeKeywords), 6);

  return {
    url: input.url,
    loadedUrl: input.loadedUrl,
    statusCode: input.statusCode,
    title,
    description,
    emails: unique(extractEmails(combined)),
    phones: uniquePhones(extractPhones(combined)),
    socialLinks: unique(links.filter(isSocialLink)),
    whatsappLinks: unique(links.filter(link => whatsappPattern.test(link))),
    mapLinks: unique(links.filter(link => mapPattern.test(link))),
    contactLinks: unique(
      links.filter(link => sameHost(input.loadedUrl || input.url, link) && contactPathPattern.test(link))
    ),
    keywordHits: targetKeywords.filter(keyword => matchesKeyword(combined, keyword)),
    evidenceSnippets,
    evidenceItems: extractStructuredEvidenceItems({
      sourceUrl: input.loadedUrl || input.url,
      title,
      description,
      text,
      targetKeywords,
      evidenceSnippets,
      companyAddressEvidence,
      negativeEvidenceSnippets
    }),
    companyAddressEvidence,
    companyCountrySignals: extractCompanyCountrySignals(combined),
    negativeKeywordHits: negativeKeywords.filter(keyword => matchesKeyword(combined, keyword)),
    negativeEvidenceSnippets
  };
}

/** Merges multiple page-level records into one compact candidate-level website evidence record. */
export function mergeWebsitePageEvidence(pages: AiLeadWebsitePageEvidence[]): AiLeadWebsiteEvidence {
  const firstPage = pages[0];

  return {
    crawlStatus: 'completed',
    pageCount: pages.length,
    finalUrl: firstPage?.loadedUrl,
    title: firstPage?.title,
    description: firstPage?.description,
    emails: unique(
      pages.flatMap(page => page.emails),
      12
    ),
    phones: unique(
      pages.flatMap(page => page.phones),
      10
    ),
    socialLinks: unique(
      pages.flatMap(page => page.socialLinks),
      12
    ),
    whatsappLinks: unique(
      pages.flatMap(page => page.whatsappLinks),
      8
    ),
    mapLinks: unique(
      pages.flatMap(page => page.mapLinks),
      8
    ),
    contactLinks: unique(
      pages.flatMap(page => page.contactLinks),
      20
    ),
    keywordHits: unique(
      pages.flatMap(page => page.keywordHits),
      24
    ),
    evidenceSnippets: unique(
      pages.flatMap(page => page.evidenceSnippets),
      8
    ),
    evidenceItems: uniqueEvidenceItems(
      pages.flatMap(page => page.evidenceItems ?? []),
      maxMergedEvidenceItems
    ),
    companyAddressEvidence: unique(
      pages.flatMap(page => page.companyAddressEvidence),
      8
    ),
    companyCountrySignals: unique(
      pages.flatMap(page => page.companyCountrySignals),
      8
    ),
    negativeKeywordHits: unique(
      pages.flatMap(page => page.negativeKeywordHits),
      24
    ),
    negativeEvidenceSnippets: unique(
      pages.flatMap(page => page.negativeEvidenceSnippets),
      8
    ),
    failureReason: null
  };
}

export function createSkippedWebsiteEvidence(reason: string): AiLeadWebsiteEvidence {
  return createEmptyWebsiteEvidence('skipped', reason);
}

export function createFailedWebsiteEvidence(reason: string): AiLeadWebsiteEvidence {
  return createEmptyWebsiteEvidence('failed', reason);
}

function createEmptyWebsiteEvidence(crawlStatus: 'failed' | 'skipped', reason: string): AiLeadWebsiteEvidence {
  return {
    crawlStatus,
    pageCount: 0,
    emails: [],
    phones: [],
    socialLinks: [],
    whatsappLinks: [],
    mapLinks: [],
    contactLinks: [],
    keywordHits: [],
    evidenceSnippets: [],
    evidenceItems: [],
    companyAddressEvidence: [],
    companyCountrySignals: [],
    negativeKeywordHits: [],
    negativeEvidenceSnippets: [],
    failureReason: reason
  };
}

interface ExtractStructuredEvidenceItemsInput {
  sourceUrl: string;
  title: string;
  description: string;
  text: string;
  targetKeywords: string[];
  evidenceSnippets: string[];
  companyAddressEvidence: string[];
  negativeEvidenceSnippets: string[];
}

function extractStructuredEvidenceItems(input: ExtractStructuredEvidenceItemsInput) {
  const pageText = normalizeText([input.title, input.description, input.text].filter(Boolean).join('. '));
  const path = readUrlPath(input.sourceUrl);
  const items: AiLeadWebsiteEvidenceItem[] = [];

  if (companyBackgroundPathPattern.test(path)) {
    addEvidenceItem(items, 'company_background', input.sourceUrl, findCompanyBackgroundEvidence(pageText));
  }

  if (productPathPattern.test(path) || input.evidenceSnippets.length > 0) {
    addEvidenceItem(items, 'product', input.sourceUrl, input.evidenceSnippets[0] || findKeywordEvidence(pageText, input.targetKeywords));
  }

  if (applicationPathPattern.test(path) || applicationSignalPattern.test(pageText)) {
    addEvidenceItem(items, 'application', input.sourceUrl, findEvidenceSentence(pageText, applicationSignalPattern));
  }

  if (brandPathPattern.test(path) || brandSignalPattern.test(pageText)) {
    addEvidenceItem(items, 'brand', input.sourceUrl, findEvidenceSentence(pageText, brandSignalPattern));
  }

  if (recentActivityPathPattern.test(path) || recentActivitySignalPattern.test(pageText)) {
    addEvidenceItem(items, 'recent_activity', input.sourceUrl, findEvidenceSentence(pageText, recentActivitySignalPattern));
  }

  if (purchaseSignalPattern.test(pageText)) {
    addEvidenceItem(items, 'purchase_signal', input.sourceUrl, findEvidenceSentence(pageText, purchaseSignalPattern));
  }

  for (const address of input.companyAddressEvidence.slice(0, 2)) {
    addEvidenceItem(items, 'address', input.sourceUrl, address);
  }

  for (const snippet of input.negativeEvidenceSnippets.slice(0, 2)) {
    addEvidenceItem(items, 'negative_relevance', input.sourceUrl, snippet);
  }

  return uniqueEvidenceItems(items, maxPageEvidenceItems);
}

function addEvidenceItem(
  items: AiLeadWebsiteEvidenceItem[],
  type: AiLeadWebsiteEvidenceItemType,
  url: string,
  text: string
) {
  const normalizedText = trimStructuredEvidenceText(text);
  if (!normalizedText) return;

  items.push({
    type,
    url,
    text: normalizedText
  });
}

function readUrlPath(url: string) {
  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}${parsed.hash}`.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

function findKeywordEvidence(text: string, keywords: string[]) {
  return keywords
    .map(keyword => text.match(new RegExp(`.{0,90}${toKeywordPattern(keyword)}.{0,120}`, 'i'))?.[0] ?? '')
    .map(normalizeText)
    .find(Boolean) ?? '';
}

function findCompanyBackgroundEvidence(text: string) {
  const chunks = splitEvidenceChunks(text);
  const substantialMatch = chunks.find(chunk => chunk.length >= 40 && companyBackgroundPattern.test(chunk));

  return substantialMatch || chunks.find(chunk => companyBackgroundPattern.test(chunk)) || chunks[0] || '';
}

function findEvidenceSentence(text: string, pattern: RegExp) {
  const chunks = splitEvidenceChunks(text);
  const matched = chunks.find(chunk => pattern.test(chunk));

  return matched || chunks[0] || '';
}

function splitEvidenceChunks(text: string) {
  return text
    .split(/(?<=[。.!?؛;])\s+|\s{2,}/)
    .map(normalizeText)
    .filter(Boolean);
}

function extractLinks(html: string, baseUrl: string) {
  const links: string[] = [];
  const hrefPattern = /href\s*=\s*["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;

  while ((match = hrefPattern.exec(html))) {
    const href = decodeHtml(match[1] || '').trim();
    if (!href || href.startsWith('#') || href.toLowerCase().startsWith('javascript:')) {
      continue;
    }

    if (/^(mailto:|tel:)/i.test(href)) {
      links.push(href);
      continue;
    }

    try {
      links.push(new URL(href, baseUrl).toString());
    } catch {
      // Ignore malformed hrefs; they are not usable customer channels.
    }
  }

  return links;
}

function extractTitle(html: string) {
  return normalizeText(decodeHtml(readFirstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i)));
}

function extractDescription(html: string) {
  return normalizeText(
    decodeHtml(readFirstMatch(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i))
  );
}

function extractEmails(text: string) {
  return text.match(/[\w.+%-]+@[\w.-]+\.[A-Za-z]{2,}/g) ?? [];
}

function extractPhones(text: string) {
  return text.match(/(?:\+\d{1,3}[\s().-]*)?(?:\(?\d{2,5}\)?[\s().-]*){2,}\d{2,6}/g) ?? [];
}

function extractEvidenceSnippets(text: string, targetKeywords: string[]) {
  return targetKeywords.flatMap(keyword => {
    const match = text.match(new RegExp(`.{0,90}${toKeywordPattern(keyword)}.{0,120}`, 'i'));

    return match ? [normalizeText(match[0])] : [];
  });
}

function extractCompanyAddressEvidence(text: string) {
  const chunks = text
    .split(/(?<=[。.!?؛;])\s+|\s{2,}/)
    .map(normalizeText)
    .filter(Boolean);
  const matchedChunks = chunks.filter(isAddressEvidenceChunk);

  if (matchedChunks.length > 0) {
    return unique(matchedChunks.map(chunk => trimEvidenceChunk(chunk)), 8);
  }

  return [];
}

function extractCompanyCountrySignals(text: string) {
  const addressText = extractCompanyAddressEvidence(text).join(' ');

  return companyCountrySignalRules
    .filter(rule => {
      if (rule.phonePattern.test(text)) {
        return true;
      }

      if (rule.label === '中国') {
        return hasChinaCompanyAddressSignal(addressText);
      }

      return Boolean(addressText && (rule.countryPattern.test(addressText) || rule.locationPattern.test(addressText)));
    })
    .map(rule => rule.label);
}

function hasChinaCompanyAddressSignal(value: string) {
  if (!value) {
    return false;
  }

  return value
    .split(/(?<=[。.!?؛;])\s+|\s{2,}| \| /)
    .map(normalizeText)
    .filter(Boolean)
    .some(chunk => chinaAddressLocationPattern.test(chunk) && !weakChinaOriginPattern.test(chunk) && !isRegionNetworkChunk(chunk));
}

function isAddressEvidenceChunk(chunk: string) {
  if (!addressEvidencePattern.test(chunk)) {
    return false;
  }

  if (addressLabelPattern.test(chunk)) {
    return true;
  }

  if (weakChinaOriginPattern.test(chunk)) {
    return false;
  }

  if (isRegionNetworkChunk(chunk)) {
    return false;
  }

  return chinaAddressLocationPattern.test(chunk) || turkeyAddressLocationPattern.test(chunk);
}

/** 判断是否只是多国家网络/区域介绍，不作为公司归属地证据。 */
function isRegionNetworkChunk(chunk: string) {
  const countryMatches = chunk.match(nonChinaCountryPattern) ?? [];

  return regionNetworkPattern.test(chunk) && countryMatches.length > 0;
}

function resolveTargetKeywords(options: AiLeadWebsiteEvidenceKeywordOptions) {
  const profileKeywords = options.matchProfile
    ? [...options.matchProfile.positiveKeywords, ...options.matchProfile.productLineKeywords]
    : [];
  const customKeywords = profileKeywords.length > 0 ? profileKeywords : (options.targetKeywords ?? []);
  const productKeywords = customKeywords.length > 0 ? customKeywords : defaultProductKeywords;

  return unique([...productKeywords, ...buyerSignalKeywords], 48);
}

function resolveNegativeKeywords(options: AiLeadWebsiteEvidenceKeywordOptions) {
  return unique(options.matchProfile?.negativeKeywords ?? options.negativeKeywords ?? [], 48);
}

function stripHtml(html: string) {
  return decodeHtml(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  );
}

function readFirstMatch(value: string, pattern: RegExp) {
  return value.match(pattern)?.[1] ?? '';
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function trimEvidenceChunk(value: string) {
  const normalized = normalizeText(value);

  return normalized.length > 220 ? `${normalized.slice(0, 220)}...` : normalized;
}

function trimStructuredEvidenceText(value: string) {
  const normalized = normalizeText(value);

  return normalized.length > 260 ? `${normalized.slice(0, 257)}...` : normalized;
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function unique(values: string[], limit = 12) {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    const normalized = normalizeText(value).replace(/[),.;:]+$/, '');
    const key = normalized.toLowerCase();

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

function uniqueEvidenceItems(values: AiLeadWebsiteEvidenceItem[], limit: number) {
  const seen = new Set<string>();
  const output: AiLeadWebsiteEvidenceItem[] = [];

  for (const value of values) {
    const type = value.type;
    const url = normalizeText(value.url);
    const text = trimStructuredEvidenceText(value.text);
    const key = `${type}|${url.toLowerCase()}|${text.toLowerCase()}`;

    if (!type || !url || !text || seen.has(key)) {
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

function uniquePhones(values: string[], limit = 10) {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    const normalized = normalizeText(value).replace(/[),.;:]+$/, '');
    const key = normalized.replace(/\D/g, '');

    if (!normalized || !key || seen.has(key)) {
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

function sameHost(baseUrl: string, link: string) {
  if (/^(mailto:|tel:)/i.test(link)) {
    return false;
  }

  try {
    const baseHost = new URL(baseUrl).hostname.replace(/^www\./i, '').toLowerCase();
    const linkHost = new URL(link).hostname.replace(/^www\./i, '').toLowerCase();

    return baseHost === linkHost;
  } catch {
    return false;
  }
}

function isSocialLink(link: string) {
  const hostname = parseHostname(link);

  return Boolean(hostname && socialHostDomains.some(domain => hostname === domain || hostname.endsWith(`.${domain}`)));
}

function parseHostname(link: string) {
  try {
    return new URL(link).hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return '';
  }
}

function matchesKeyword(text: string, keyword: string) {
  if (/[\u4e00-\u9fff]/.test(keyword)) {
    return new RegExp(toKeywordPattern(keyword), 'i').test(text);
  }

  return new RegExp(`\\b${toKeywordPattern(keyword)}\\b`, 'i').test(text);
}

function toKeywordPattern(keyword: string) {
  const escaped = escapeRegExp(keyword).replace(/\s+/g, '\\s+');
  const pluralSuffix = /[A-Za-z]$/.test(keyword) ? '(?:s|es)?' : '';

  return `${escaped}${pluralSuffix}`;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
