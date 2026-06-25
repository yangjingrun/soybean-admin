import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mapAiLeadTaskResultToCrmImportInputs } from './ai-lead-crm-import.adapter';

describe('mapAiLeadTaskResultToCrmImportInputs', () => {
  it('maps completed task candidates to CRM import inputs and skips blank titles', () => {
    const inputs = mapAiLeadTaskResultToCrmImportInputs('task-1', {
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
          }
        },
        { title: '  ', website: 'https://blank.example' },
        { title: 'XYZ Trading', url: 'https://xyz.example' }
      ]
    });

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
          }
        }
      },
      {
        name: 'XYZ Trading',
        websiteUrl: 'https://xyz.example',
        sourceTaskId: 'task-1',
        contact: null,
        sourceSnapshot: {
          url: 'https://xyz.example'
        }
      }
    ]);
  });

  it('returns an empty list when result candidates are missing', () => {
    assert.deepEqual(mapAiLeadTaskResultToCrmImportInputs('task-1', null), []);
    assert.deepEqual(mapAiLeadTaskResultToCrmImportInputs('task-1', {}), []);
  });
});
