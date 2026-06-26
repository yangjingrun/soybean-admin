import type { AiLeadSearchCandidate } from './ai-lead-search-orchestrator.service';

export type AiLeadWebsiteCrawlStatus = 'completed' | 'failed' | 'skipped';

export type AiLeadWebsiteEvidenceItemType =
  | 'company_background'
  | 'product'
  | 'application'
  | 'brand'
  | 'recent_activity'
  | 'purchase_signal'
  | 'negative_relevance'
  | 'address';

export interface AiLeadWebsiteEvidenceItem {
  type: AiLeadWebsiteEvidenceItemType;
  url: string;
  text: string;
}

export interface AiLeadWebsitePageEvidence {
  url: string;
  loadedUrl: string;
  statusCode: number;
  title: string;
  description: string;
  emails: string[];
  phones: string[];
  socialLinks: string[];
  whatsappLinks: string[];
  mapLinks: string[];
  contactLinks: string[];
  keywordHits: string[];
  evidenceSnippets: string[];
  evidenceItems: AiLeadWebsiteEvidenceItem[];
  companyAddressEvidence: string[];
  companyCountrySignals: string[];
  negativeKeywordHits: string[];
  negativeEvidenceSnippets: string[];
}

export interface AiLeadWebsiteEvidence {
  crawlStatus: AiLeadWebsiteCrawlStatus;
  pageCount: number;
  finalUrl?: string;
  title?: string;
  description?: string;
  emails: string[];
  phones: string[];
  socialLinks: string[];
  whatsappLinks: string[];
  mapLinks: string[];
  contactLinks: string[];
  keywordHits: string[];
  evidenceSnippets: string[];
  evidenceItems?: AiLeadWebsiteEvidenceItem[];
  companyAddressEvidence: string[];
  companyCountrySignals: string[];
  negativeKeywordHits: string[];
  negativeEvidenceSnippets: string[];
  failureReason: string | null;
}

export interface AiLeadWebsiteMatchProfile {
  positiveKeywords: string[];
  negativeKeywords: string[];
  productLineKeywords: string[];
}

export interface AiLeadWebsiteEvidenceKeywordOptions {
  targetKeywords?: string[];
  negativeKeywords?: string[];
  matchProfile?: AiLeadWebsiteMatchProfile;
}

export type AiLeadPrecisionPriority = 'high' | 'medium' | 'low' | 'reject';
export type AiLeadTargetMarketFit = 'target' | 'uncertain' | 'outside_target';

export interface AiLeadPrecisionAnalysis {
  score: number;
  priority: AiLeadPrecisionPriority;
  buyerType: string;
  customerGroup: string;
  companyCountry: string;
  targetMarketFit: AiLeadTargetMarketFit;
  reason: string;
  matchedSignals: string[];
  risks: string[];
  recommendedAction: string;
  reviewRequired: boolean;
}

export interface AiLeadEmailWritingContext {
  companyBackgroundSummary: string;
  industryChainPosition: string;
  mainProducts: string[];
  servedIndustries: string[];
  businessModel: string;
  productFitSummary: string;
  recentBusinessTriggers: string[];
  recommendedFirstEmailAngle: string;
  negativeRelevanceSignals: string[];
  confidenceScore: number;
  evidenceItems: AiLeadWebsiteEvidenceItem[];
}

export type AiLeadWebsiteEnrichedCandidate = AiLeadSearchCandidate & {
  websiteEvidence?: AiLeadWebsiteEvidence;
  precisionAnalysis?: AiLeadPrecisionAnalysis;
  emailWritingContext?: AiLeadEmailWritingContext;
  score?: number;
  reason?: string;
};

export interface AiLeadWebsiteCrawlRequest {
  url: string;
  uniqueKey: string;
  userData: {
    candidateIndex: number;
    dedupeKey: string;
    companyName: string;
    homepage: string;
  };
}

export interface AiLeadWebsiteCrawlPageResult {
  request: AiLeadWebsiteCrawlRequest;
  statusCode: number;
  loadedUrl: string;
  html: string;
}

export interface AiLeadWebsiteCrawlerPageFetcher {
  crawl(requests: AiLeadWebsiteCrawlRequest[]): Promise<AiLeadWebsiteCrawlPageResult[]>;
}
