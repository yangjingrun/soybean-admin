import type { AiLeadSearchCandidate } from './ai-lead-search-orchestrator.service';

export type AiLeadWebsiteCrawlStatus = 'completed' | 'failed' | 'skipped';

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
  failureReason: string | null;
}

export type AiLeadPrecisionPriority = 'high' | 'medium' | 'low' | 'reject';

export interface AiLeadPrecisionAnalysis {
  score: number;
  priority: AiLeadPrecisionPriority;
  buyerType: string;
  reason: string;
  matchedSignals: string[];
  risks: string[];
  recommendedAction: string;
  reviewRequired: boolean;
}

export type AiLeadWebsiteEnrichedCandidate = AiLeadSearchCandidate & {
  websiteEvidence?: AiLeadWebsiteEvidence;
  precisionAnalysis?: AiLeadPrecisionAnalysis;
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
