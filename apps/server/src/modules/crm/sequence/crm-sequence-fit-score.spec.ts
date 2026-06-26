import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { scoreCrmSequenceFit } from './crm-sequence-fit-score';

describe('crm-sequence-fit-score', () => {
  it('recommends four cold steps for high-fit leads and never includes trigger-only step five', () => {
    const result = scoreCrmSequenceFit({
      account: {
        customerType: 'Distributor',
        country: 'SA',
        sourceSnapshot: {
          website_product_fact: 'Supplies bearings',
          recent_trigger: 'Hiring sourcing staff',
          source_url: 'https://abc.example',
          source_date: '2026-06-20',
          fact_or_inference: 'fact',
          confidence_score: 90
        }
      },
      contact: { title: 'Purchasing Manager', emailStatus: 'valid' },
      productLine: {
        name: 'Bearing Series',
        targetCustomerType: 'Distributor',
        coreSellingPoints: 'stable lead time',
        commonModelsText: '6204, 6205',
        certifications: 'ISO 9001'
      }
    });

    assert.equal(result.score, 100);
    assert.equal(result.recommendedColdSteps, 4);
    assert.equal(result.canCreateColdSequence, true);
  });

  it('blocks automatic sequence creation below fifty points', () => {
    const result = scoreCrmSequenceFit({
      account: { customerType: null, country: null, sourceSnapshot: null },
      contact: { title: null, emailStatus: 'unchecked' },
      productLine: null
    });

    assert.equal(result.canCreateColdSequence, false);
    assert.equal(result.recommendedColdSteps, 0);
  });
});
