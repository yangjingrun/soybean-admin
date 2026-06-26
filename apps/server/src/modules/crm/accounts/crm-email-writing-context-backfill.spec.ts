import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { backfillCrmEmailWritingContexts } from './crm-email-writing-context-backfill';

describe('backfillCrmEmailWritingContexts', () => {
  it('adds emailWritingContext from existing sourceSnapshot evidence only', async () => {
    const sourceSnapshot = {
      website: 'https://abc.example',
      phoneNumber: '+966 11 000 0000',
      websiteEvidence: {
        crawlStatus: 'completed',
        pageCount: 2,
        finalUrl: 'https://abc.example',
        title: 'ABC Bearings',
        description: 'Industrial bearing distributor',
        emails: ['sales@abc.example'],
        phones: ['+966 11 000 0000'],
        socialLinks: ['https://www.linkedin.com/company/abc-bearings/'],
        whatsappLinks: ['https://wa.me/966110000000'],
        mapLinks: [],
        contactLinks: ['https://abc.example/contact'],
        keywordHits: ['bearing', 'maintenance'],
        evidenceSnippets: ['bearing parts for maintenance teams'],
        evidenceItems: [
          {
            type: 'company_background',
            url: 'https://abc.example/about',
            text: 'Industrial bearing distributor in Riyadh.'
          },
          {
            type: 'product',
            url: 'https://abc.example/products',
            text: 'Bearing parts for maintenance teams.'
          }
        ],
        companyAddressEvidence: ['Address: Riyadh, Saudi Arabia'],
        companyCountrySignals: ['沙特阿拉伯'],
        negativeKeywordHits: [],
        negativeEvidenceSnippets: [],
        failureReason: null
      },
      precisionAnalysis: {
        score: 82,
        priority: 'high',
        buyerType: 'bearing distributor',
        customerGroup: '本地经销商',
        companyCountry: '沙特阿拉伯',
        targetMarketFit: 'target',
        reason: '官网展示 bearing parts for maintenance teams',
        matchedSignals: ['bearing parts for maintenance teams'],
        risks: ['未看到库存数量'],
        recommendedAction: '用维修备件匹配角度开发',
        reviewRequired: false
      },
      productLine: {
        id: 'line-1',
        name: 'Deep groove bearings',
        targetCustomerType: '进口商和经销商'
      }
    };
    const updates: Array<{ id: string; sourceSnapshot: Record<string, unknown> }> = [];

    const summary = await backfillCrmEmailWritingContexts({
      async findAccountsMissingEmailWritingContext() {
        return [{ id: 'account-1', sourceSnapshot }];
      },
      async updateAccountSourceSnapshot(id, nextSourceSnapshot) {
        updates.push({ id, sourceSnapshot: nextSourceSnapshot });
      }
    });

    assert.equal(summary.scannedAccountCount, 1);
    assert.equal(summary.updatedCount, 1);
    assert.equal(updates[0].id, 'account-1');
    assert.equal(updates[0].sourceSnapshot.websiteEvidence, sourceSnapshot.websiteEvidence);
    assert.equal(updates[0].sourceSnapshot.precisionAnalysis, sourceSnapshot.precisionAnalysis);

    const emailWritingContext = updates[0].sourceSnapshot.emailWritingContext as {
      companyBackgroundSummary?: string;
      industryChainPosition?: string;
      productFitSummary?: string;
      recommendedFirstEmailAngle?: string;
      negativeRelevanceSignals?: string[];
      evidenceItems?: Array<{ text: string }>;
    };

    assert.match(emailWritingContext.companyBackgroundSummary ?? '', /Industrial bearing distributor/);
    assert.equal(emailWritingContext.industryChainPosition, '本地经销商');
    assert.match(emailWritingContext.productFitSummary ?? '', /maintenance teams/);
    assert.match(emailWritingContext.recommendedFirstEmailAngle ?? '', /维修备件匹配/);
    assert.deepEqual(emailWritingContext.negativeRelevanceSignals, ['未看到库存数量']);
    assert.equal(emailWritingContext.evidenceItems?.some(item => item.text.includes('sales@abc.example')), false);
    assert.equal(emailWritingContext.evidenceItems?.some(item => item.text.includes('wa.me')), false);
  });
});
