import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AiLeadWebsiteCrawlerService } from './ai-lead-website-crawler.service';
import type { AiLeadSearchCandidate } from './ai-lead-search-orchestrator.service';

describe('AiLeadWebsiteCrawlerService', () => {
  it('crawls candidate websites with a fixed same-domain page set', async () => {
    const requestedUrls: string[] = [];
    const service = new AiLeadWebsiteCrawlerService({
      async crawl(requests) {
        requestedUrls.push(...requests.map(request => request.url));

        return requests.slice(0, 2).map(request => ({
          request,
          statusCode: 200,
          loadedUrl: request.url,
          html: `<title>${request.userData.companyName}</title><body>${request.url} elevator bearing sales@abc.example.com</body>`
        }));
      }
    });

    const candidates = await service.enrichCandidates([
      createCandidate({ title: 'ABC Bearing', website: 'https://abc.example.com' })
    ]);

    assert.equal(requestedUrls.length, 8);
    assert.deepEqual(requestedUrls, [
      'https://abc.example.com/',
      'https://abc.example.com/contact',
      'https://abc.example.com/contact-us',
      'https://abc.example.com/about',
      'https://abc.example.com/about-us',
      'https://abc.example.com/products',
      'https://abc.example.com/product',
      'https://abc.example.com/elevator'
    ]);
    assert.equal(candidates[0].websiteEvidence?.crawlStatus, 'completed');
    assert.equal(candidates[0].websiteEvidence?.pageCount, 2);
    assert.deepEqual(candidates[0].websiteEvidence?.emails, ['sales@abc.example.com']);
  });

  it('marks candidates without websites as skipped', async () => {
    const service = new AiLeadWebsiteCrawlerService({
      async crawl() {
        throw new Error('should not crawl');
      }
    });

    const candidates = await service.enrichCandidates([createCandidate({ title: 'No Site', website: '' })]);

    assert.equal(candidates[0].websiteEvidence?.crawlStatus, 'skipped');
    assert.equal(candidates[0].websiteEvidence?.failureReason, '缺少官网');
  });

  it('records crawler failure without blocking other candidates', async () => {
    const service = new AiLeadWebsiteCrawlerService({
      async crawl() {
        throw new Error('TLS handshake failed');
      }
    });

    const candidates = await service.enrichCandidates([
      createCandidate({ title: 'Broken', website: 'https://broken.example.com' })
    ]);

    assert.equal(candidates[0].websiteEvidence?.crawlStatus, 'failed');
    assert.equal(candidates[0].websiteEvidence?.failureReason, 'TLS handshake failed');
  });
});

function createCandidate(overrides: Partial<AiLeadSearchCandidate>): AiLeadSearchCandidate {
  return {
    dedupeKey: overrides.website || overrides.url || overrides.title || 'candidate',
    sourceType: 'organic',
    title: 'Candidate',
    website: 'https://candidate.example.com',
    snippet: 'bearing supplier',
    ...overrides
  };
}
