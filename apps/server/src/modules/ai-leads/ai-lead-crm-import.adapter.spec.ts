import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mapAiLeadTaskResultToCrmImportInputs } from './ai-lead-crm-import.adapter';

describe('mapAiLeadTaskResultToCrmImportInputs', () => {
  it('maps completed task candidates to CRM import inputs and skips blank titles', () => {
    const productLineSnapshot = {
      id: 'product-line-1',
      name: 'Deep groove ball bearings',
      targetCustomerType: '进口商和经销商',
      commonModelsText: '6203, 6204'
    };
    const inputs = mapAiLeadTaskResultToCrmImportInputs(
      {
        id: 'task-1',
        productLineSnapshot
      },
      {
        candidates: [
          {
            title: 'ABC Bearing',
            website: 'https://abc.example',
            url: 'https://fallback.example',
            snippet: 'Bearing distributor in Riyadh',
            city: ' Riyadh ',
            address: 'Riyadh',
            phoneNumber: '+966 11 000 0000',
            latitude: 24.7136,
            longitude: 46.6753,
            sourceType: 'places',
            country: 'SA',
            score: 82,
            reason: 'Matches bearing supplier intent',
            sourceUrl: 'https://google.serper.dev/places',
            websiteEvidence: {
              crawlStatus: 'completed',
              pageCount: 1,
              emails: ['sales@abc.example'],
              phones: [],
              socialLinks: [],
              whatsappLinks: [],
              mapLinks: [],
              contactLinks: ['https://abc.example/contact'],
              keywordHits: ['bearing'],
              evidenceSnippets: ['Bearing distributor'],
              evidenceItems: [
                {
                  type: 'product',
                  url: 'https://abc.example/products',
                  text: 'Bearing distributor'
                }
              ],
              failureReason: null
            },
            precisionAnalysis: {
              score: 82,
              priority: 'high',
              buyerType: 'bearing distributor',
              reason: 'Matches bearing supplier intent',
              matchedSignals: ['bearing'],
              risks: [],
              recommendedAction: '优先开发',
              reviewRequired: false
            },
            emailWritingContext: {
              companyBackgroundSummary: 'ABC Bearing is a local bearing distributor in Riyadh.',
              industryChainPosition: '进口商和经销商',
              mainProducts: ['bearings'],
              servedIndustries: ['industrial maintenance'],
              businessModel: 'Local distributor',
              productFitSummary: 'Matches deep groove bearing distribution intent.',
              recentBusinessTriggers: [],
              recommendedFirstEmailAngle: 'Ask whether one bearing designation comparison is useful.',
              negativeRelevanceSignals: [],
              confidenceScore: 82,
              evidenceItems: [
                {
                  type: 'product',
                  url: 'https://abc.example/products',
                  text: 'Bearing distributor'
                }
              ]
            }
          },
          { title: '  ', website: 'https://blank.example' },
          { title: 'XYZ Trading', url: 'https://xyz.example' }
        ]
      }
    );

    assert.deepEqual(inputs, [
      {
        name: 'ABC Bearing',
        websiteUrl: 'https://abc.example',
        country: '沙特阿拉伯',
        city: 'Riyadh',
        address: 'Riyadh',
        latitude: 24.7136,
        longitude: 46.6753,
        sourceTaskId: 'task-1',
        contact: null,
        sourceSnapshot: {
          snippet: 'Bearing distributor in Riyadh',
          city: 'Riyadh',
          address: 'Riyadh',
          phoneNumber: '+966 11 000 0000',
          latitude: 24.7136,
          longitude: 46.6753,
          sourceType: 'places',
          country: 'SA',
          score: 82,
          reason: 'Matches bearing supplier intent',
          sourceUrl: 'https://google.serper.dev/places',
          url: 'https://fallback.example',
          website: 'https://abc.example',
          websiteEvidence: {
            crawlStatus: 'completed',
            pageCount: 1,
            emails: ['sales@abc.example'],
            phones: [],
            socialLinks: [],
            whatsappLinks: [],
            mapLinks: [],
            contactLinks: ['https://abc.example/contact'],
              keywordHits: ['bearing'],
              evidenceSnippets: ['Bearing distributor'],
              evidenceItems: [
                {
                  type: 'product',
                  url: 'https://abc.example/products',
                  text: 'Bearing distributor'
                }
              ],
              failureReason: null
            },
            precisionAnalysis: {
            score: 82,
            priority: 'high',
            buyerType: 'bearing distributor',
            reason: 'Matches bearing supplier intent',
            matchedSignals: ['bearing'],
              risks: [],
              recommendedAction: '优先开发',
              reviewRequired: false
            },
            emailWritingContext: {
              companyBackgroundSummary: 'ABC Bearing is a local bearing distributor in Riyadh.',
              industryChainPosition: '进口商和经销商',
              mainProducts: ['bearings'],
              servedIndustries: ['industrial maintenance'],
              businessModel: 'Local distributor',
              productFitSummary: 'Matches deep groove bearing distribution intent.',
              recentBusinessTriggers: [],
              recommendedFirstEmailAngle: 'Ask whether one bearing designation comparison is useful.',
              negativeRelevanceSignals: [],
              confidenceScore: 82,
              evidenceItems: [
                {
                  type: 'product',
                  url: 'https://abc.example/products',
                  text: 'Bearing distributor'
                }
              ]
            },
            productLine: productLineSnapshot
          }
      },
      {
        name: 'XYZ Trading',
        websiteUrl: 'https://xyz.example',
        sourceTaskId: 'task-1',
        contact: null,
        sourceSnapshot: {
          url: 'https://xyz.example',
          productLine: productLineSnapshot
        }
      }
    ]);
  });

  it('returns an empty list when result candidates are missing', () => {
    assert.deepEqual(mapAiLeadTaskResultToCrmImportInputs({ id: 'task-1' }, null), []);
    assert.deepEqual(mapAiLeadTaskResultToCrmImportInputs({ id: 'task-1' }, {}), []);
  });

  it('does not import directory source pages as company websites', () => {
    const inputs = mapAiLeadTaskResultToCrmImportInputs(
      { id: 'task-1' },
      {
        candidates: [
          {
            title: 'Industrial Bearing Suppliers in UAE',
            url: 'https://www.yellowpages-uae.com/uae/industrial-bearing',
            sourceType: 'organic',
            websiteEvidence: {
              crawlStatus: 'skipped',
              pageCount: 0,
              emails: [],
              phones: [],
              socialLinks: [],
              whatsappLinks: [],
              mapLinks: [],
              contactLinks: [],
              keywordHits: [],
              evidenceSnippets: [],
              companyAddressEvidence: [],
              companyCountrySignals: [],
              negativeKeywordHits: [],
              negativeEvidenceSnippets: [],
              failureReason: '目录/黄页来源页，不作为公司官网采集'
            }
          }
        ]
      },
      [{ value: 'yellowpages-uae.com', matchMode: 'domain_suffix' }]
    );

    assert.equal(inputs[0].websiteUrl, '');
    assert.equal(inputs[0].sourceSnapshot?.url, 'https://www.yellowpages-uae.com/uae/industrial-bearing');
  });
});
