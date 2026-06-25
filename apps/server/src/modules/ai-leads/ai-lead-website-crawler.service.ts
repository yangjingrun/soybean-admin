import { Inject, Injectable, Optional } from '@nestjs/common';
import { CheerioCrawler } from 'crawlee';
import type { AiLeadSearchCandidate } from './ai-lead-search-orchestrator.service';
import {
  createFailedWebsiteEvidence,
  createSkippedWebsiteEvidence,
  extractWebsitePageEvidence,
  mergeWebsitePageEvidence
} from './ai-lead-website-crawler.extractor';
import type {
  AiLeadWebsiteCrawlPageResult,
  AiLeadWebsiteCrawlRequest,
  AiLeadWebsiteCrawlerPageFetcher,
  AiLeadWebsiteEvidenceKeywordOptions,
  AiLeadWebsiteEnrichedCandidate
} from './ai-lead-website-crawler.types';

const maxPagesPerCandidate = 8;
const websitePagePaths = [
  '/',
  '/contact',
  '/contact-us',
  '/about',
  '/about-us',
  '/products',
  '/product',
  '/elevator',
  '/en/contact',
  '/en/about',
  '/iletisim',
  '/hakkimizda'
];

@Injectable()
export class AiLeadWebsiteCrawlerService {
  constructor(
    @Optional() @Inject('AI_LEAD_WEBSITE_CRAWLER_FETCHER') private readonly fetcher?: AiLeadWebsiteCrawlerPageFetcher
  ) {}

  /** Enriches Serper candidates with public website contact and product evidence. */
  async enrichCandidates(
    candidates: AiLeadSearchCandidate[],
    options: AiLeadWebsiteEvidenceKeywordOptions = {}
  ): Promise<AiLeadWebsiteEnrichedCandidate[]> {
    const output: AiLeadWebsiteEnrichedCandidate[] = [];
    const pageFetcher = this.fetcher ?? new CrawleeWebsitePageFetcher();

    for (let index = 0; index < candidates.length; index += 1) {
      const candidate = candidates[index];
      const homepage = normalizeCandidateWebsite(candidate);

      if (!homepage) {
        output.push({
          ...candidate,
          websiteEvidence: createSkippedWebsiteEvidence('缺少官网')
        });
        continue;
      }

      const requests = buildCandidateRequests(candidate, homepage, index);

      try {
        const pages = await pageFetcher.crawl(requests);
        const pageEvidence = pages.map(page =>
          extractWebsitePageEvidence(
            {
              url: page.request.url,
              loadedUrl: page.loadedUrl,
              statusCode: page.statusCode,
              html: page.html
            },
            options
          )
        );

        output.push({
          ...candidate,
          website: candidate.website || homepage,
          websiteEvidence: pageEvidence.length
            ? mergeWebsitePageEvidence(pageEvidence)
            : createFailedWebsiteEvidence('官网未返回可解析页面')
        });
      } catch (error) {
        output.push({
          ...candidate,
          website: candidate.website || homepage,
          websiteEvidence: createFailedWebsiteEvidence(error instanceof Error ? error.message : String(error))
        });
      }
    }

    return output;
  }
}

class CrawleeWebsitePageFetcher implements AiLeadWebsiteCrawlerPageFetcher {
  async crawl(requests: AiLeadWebsiteCrawlRequest[]): Promise<AiLeadWebsiteCrawlPageResult[]> {
    const pages: AiLeadWebsiteCrawlPageResult[] = [];
    const crawler = new CheerioCrawler({
      maxRequestsPerCrawl: requests.length,
      maxConcurrency: 4,
      maxRequestRetries: 1,
      requestHandlerTimeoutSecs: 20,
      navigationTimeoutSecs: 15,
      async requestHandler({ $, request, response }) {
        const sourceRequest = request.userData.sourceRequest as AiLeadWebsiteCrawlRequest;

        pages.push({
          request: sourceRequest,
          statusCode: response.statusCode as number,
          loadedUrl: request.loadedUrl || request.url,
          html: $.html()
        });
      }
    });

    await crawler.run(
      requests.map(request => ({
        url: request.url,
        uniqueKey: request.uniqueKey,
        userData: {
          sourceRequest: request
        }
      }))
    );

    return pages;
  }
}

function buildCandidateRequests(candidate: AiLeadSearchCandidate, homepage: string, candidateIndex: number) {
  const base = new URL(homepage);
  const baseUrl = `${base.protocol}//${base.host}`;
  const dedupeKey = candidate.dedupeKey || homepage;
  const companyName = candidate.title || homepage;

  return websitePagePaths.slice(0, maxPagesPerCandidate).map(path => ({
    url: new URL(path, baseUrl).toString(),
    uniqueKey: `${candidateIndex}:${path}`,
    userData: {
      candidateIndex,
      dedupeKey,
      companyName,
      homepage
    }
  }));
}

function normalizeCandidateWebsite(candidate: AiLeadSearchCandidate) {
  const value = (candidate.website || candidate.url || '').trim();

  if (!value) {
    return '';
  }

  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);

    return `${url.protocol}//${url.host}${url.pathname === '/' ? '' : url.pathname}`;
  } catch {
    return '';
  }
}
