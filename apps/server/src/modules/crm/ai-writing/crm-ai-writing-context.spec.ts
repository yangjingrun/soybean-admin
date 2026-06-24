import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildCrmAiWritingContext } from './crm-ai-writing-context';
import type { CrmAiDraftPromptInput } from '../crm-ai-draft.types';

describe('crm-ai-writing-context', () => {
  it('builds public facts only from existing account, contact, product, and persona fields', () => {
    const context = buildCrmAiWritingContext(createInput());

    assert.deepEqual(
      context.publicFacts.map(item => item.id),
      [
        'account.name',
        'account.country',
        'account.city',
        'account.timeZone',
        'account.domain',
        'account.customerType',
        'contact.fullName',
        'contact.title',
        'contact.emailStatus',
        'product_line.name',
        'product_line.targetCustomerType',
        'product_line.coreSellingPoints',
        'product_line.moq',
        'product_line.leadTime',
        'product_line.paymentTerms',
        'product_line.certifications',
        'product_line.commonModelsText',
        'product_line.proofAssets',
        'product_line.regionNotes',
        'persona.label',
        'persona.focusText',
        'persona.draftFocusText',
        'persona.painPoints',
        'persona.avoidText'
      ]
    );
  });

  it('adds review notes for missing role, region, and product facts without fake facts', () => {
    const input = createInput({
      account: { name: 'ABC Trading', country: null, city: null, timeZone: null, domain: null, customerType: null },
      contact: { fullName: null, title: null, maskedEmail: 'a***@abc.example', emailStatus: 'unchecked' },
      productLine: {
        id: 'line-1',
        name: 'Bearings',
        targetCustomerType: null,
        coreSellingPoints: null,
        moq: null,
        leadTime: null,
        paymentTerms: null,
        certifications: null,
        catalogUrl: null,
        websiteUrl: null,
        commonModelsText: null
      },
      persona: null
    });
    const context = buildCrmAiWritingContext(input);

    assert.equal(
      context.publicFacts.some(item => item.id === 'contact.title'),
      false
    );
    assert.deepEqual(context.reviewNotes, ['联系人职位缺失', '客户地区信息缺失', '产品核心卖点缺失']);
  });

  it('keeps previous messages as angle context instead of product facts', () => {
    const context = buildCrmAiWritingContext(
      createInput({
        previousMessages: [{ stepIndex: 1, subject: 'Bearing fit', bodyText: 'Do you handle MRO replacement parts?' }]
      })
    );

    assert.deepEqual(
      context.previousMessages.map(item => item.factId),
      ['previous_message.step_1']
    );
    assert.equal(
      context.publicFacts.some(item => item.id === 'previous_message.step_1'),
      true
    );
    assert.equal(context.publicFacts.find(item => item.id === 'previous_message.step_1')?.source, 'previous_message');
  });
});

function createInput(overrides: Partial<CrmAiDraftPromptInput> = {}): CrmAiDraftPromptInput {
  return {
    account: {
      name: 'ABC Trading',
      country: 'SA',
      city: 'Riyadh',
      timeZone: 'Asia/Riyadh',
      domain: 'abc.example',
      customerType: 'distributor'
    },
    contact: {
      fullName: 'Alex Buyer',
      title: 'Sourcing Manager',
      maskedEmail: 'a***@abc.example',
      emailStatus: 'valid'
    },
    productLine: {
      id: 'line-1',
      name: 'Bearings',
      targetCustomerType: 'industrial distributors',
      coreSellingPoints: 'Stable stock for 6204 and 6205 bearings',
      moq: '100 pcs',
      leadTime: '15 days',
      paymentTerms: 'T/T',
      certifications: 'ISO 9001',
      catalogUrl: null,
      websiteUrl: null,
      commonModelsText: '6204, 6205'
    },
    writingConfig: {
      enabled: true,
      proofAssets: 'Exported to GCC distributors.',
      regionNotes: 'Saudi buyers often ask for stock availability.',
      steps: [1, 2, 3, 4, 5].map(stepIndex => ({
        stepIndex: stepIndex as 1 | 2 | 3 | 4 | 5,
        prompt: `Step ${stepIndex}`
      }))
    },
    stepIndex: 1,
    previousMessages: [],
    senderName: 'Alice',
    baseDraft: { subject: 'Bearing fit', bodyText: 'Hi Alex,\n\nShort note.\n\nAlice' },
    persona: {
      label: 'Procurement',
      focusText: 'MOQ and lead time',
      draftFocusText: 'stock and lead time',
      painPoints: 'Unstable suppliers',
      avoidText: 'No vague claims'
    },
    ...overrides
  };
}
