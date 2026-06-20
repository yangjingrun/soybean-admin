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
          address: 'Riyadh',
          phoneNumber: '+966 11 000 0000',
          sourceType: 'places',
          score: 82,
          reason: 'Matches bearing supplier intent',
          sourceUrl: 'https://google.serper.dev/places'
        },
        { title: '  ', website: 'https://blank.example' },
        { title: 'XYZ Trading', url: 'https://xyz.example' }
      ]
    });

    assert.deepEqual(inputs, [
      {
        name: 'ABC Bearing',
        websiteUrl: 'https://abc.example',
        sourceTaskId: 'task-1',
        contact: null,
        sourceSnapshot: {
          snippet: 'Bearing distributor in Riyadh',
          address: 'Riyadh',
          phoneNumber: '+966 11 000 0000',
          sourceType: 'places',
          score: 82,
          reason: 'Matches bearing supplier intent',
          sourceUrl: 'https://google.serper.dev/places',
          url: 'https://fallback.example',
          website: 'https://abc.example'
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
