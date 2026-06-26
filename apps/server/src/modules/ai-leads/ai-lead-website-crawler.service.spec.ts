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

    assert.equal(requestedUrls.length, 12);
    assert.deepEqual(requestedUrls, [
      'https://abc.example.com/',
      'https://abc.example.com/about',
      'https://abc.example.com/about-us',
      'https://abc.example.com/company',
      'https://abc.example.com/products',
      'https://abc.example.com/services',
      'https://abc.example.com/industries',
      'https://abc.example.com/solutions',
      'https://abc.example.com/brands',
      'https://abc.example.com/news',
      'https://abc.example.com/contact',
      'https://abc.example.com/contact-us'
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

  it('extracts website evidence with dynamic industry keywords', async () => {
    const service = new AiLeadWebsiteCrawlerService({
      async crawl(requests) {
        return [
          {
            request: requests[0],
            statusCode: 200,
            loadedUrl: requests[0].url,
            html: `
              <title>Bright LED Supply</title>
              <body>
                Bright LED Supply is a LED lighting distributor for commercial lighting projects.
                Contact export@bright-led.example.com for LED strip and panel light sourcing.
                We do not serve school lighting projects or consumer retail orders.
              </body>
            `
          }
        ];
      }
    });

    const candidates = await service.enrichCandidates(
      [createCandidate({ title: 'Bright LED Supply', website: 'https://bright-led.example.com' })],
      {
        matchProfile: {
          positiveKeywords: ['LED lighting', 'LED strip'],
          negativeKeywords: ['school', 'consumer retail'],
          productLineKeywords: ['panel light']
        }
      }
    );

    assert.deepEqual(candidates[0].websiteEvidence?.keywordHits, [
      'LED lighting',
      'LED strip',
      'panel light',
      'distributor',
      'export'
    ]);
    assert.deepEqual(candidates[0].websiteEvidence?.negativeKeywordHits, ['school', 'consumer retail']);
    assert.match(candidates[0].websiteEvidence?.evidenceSnippets.join(' '), /LED lighting distributor/);
    assert.match(candidates[0].websiteEvidence?.evidenceSnippets.join(' '), /LED strip and panel light/);
    assert.match(candidates[0].websiteEvidence?.negativeEvidenceSnippets.join(' '), /school lighting projects/);
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
