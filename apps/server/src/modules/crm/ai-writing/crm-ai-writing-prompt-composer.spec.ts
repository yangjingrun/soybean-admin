import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { composeCrmAiWritingPrompt } from './crm-ai-writing-prompt-composer';
import type { CrmAiWritingContext, CrmAiWritingSelectedModule } from './crm-ai-writing-module.types';

describe('crm-ai-writing-prompt-composer', () => {
  it('combines selected module prompts, public facts, previous messages, and output contract', () => {
    const prompt = composeCrmAiWritingPrompt({
      input: {
        stepIndex: 2,
        templateLanguage: 'en',
        senderName: 'Alice',
        baseDraft: { subject: 'Re: Bearing fit', bodyText: 'Following up.' },
        writingConfig: {
          enabled: true,
          steps: [
            { stepIndex: 1, prompt: 'Step 1' },
            { stepIndex: 2, prompt: '' },
            { stepIndex: 3, prompt: 'Step 3' },
            { stepIndex: 4, prompt: 'Step 4' },
            { stepIndex: 5, prompt: 'Step 5' }
          ]
        },
        account: {
          name: 'ABC Trading',
          country: 'SA',
          city: 'Riyadh',
          timeZone: 'Asia/Riyadh',
          domain: null,
          customerType: null
        },
        contact: { fullName: 'Alex', title: 'Sourcing Manager', maskedEmail: 'a***@abc.example', emailStatus: 'valid' },
        productLine: {
          id: 'line-1',
          name: 'Bearings',
          targetCustomerType: null,
          coreSellingPoints: 'Stable stock',
          moq: null,
          leadTime: null,
          paymentTerms: null,
          certifications: null,
          catalogUrl: null,
          websiteUrl: null,
          commonModelsText: null
        },
        previousMessages: [{ stepIndex: 1, subject: 'Bearing fit', bodyText: 'First note.' }]
      },
      selectedModules: [
        {
          promptKey: 'crm_outreach_base_rules',
          title: 'Base',
          reason: 'Required',
          systemPrompt: 'Only use provided facts.'
        }
      ] as CrmAiWritingSelectedModule[],
      writingContext: {
        publicFacts: [{ id: 'account.name', label: 'Account name', value: 'ABC Trading', source: 'account' }],
        previousMessages: [
          { factId: 'previous_message.step_1', stepIndex: 1, subject: 'Bearing fit', bodySummary: 'First note.' }
        ],
        reviewNotes: ['产品交期未配置'],
        baseDraftFact: null
      } satisfies CrmAiWritingContext,
      riskNotes: ['产品交期未配置']
    });

    assert.match(prompt.systemPrompt, /Only use provided facts/);
    assert.match(prompt.userPrompt, /Public facts/);
    assert.match(prompt.userPrompt, /account.name/);
    assert.match(prompt.userPrompt, /Previous messages/);
    assert.match(prompt.userPrompt, /Change the angle/);
    assert.match(prompt.userPrompt, /system built-in guidance/);
    assert.match(prompt.userPrompt, /"stepPrompt": null/);
    assert.match(prompt.userPrompt, /usedAngles/);
    assert.doesNotMatch(prompt.userPrompt, /commonRequirements|forbiddenClaims|productEmphasis/);
  });
});
