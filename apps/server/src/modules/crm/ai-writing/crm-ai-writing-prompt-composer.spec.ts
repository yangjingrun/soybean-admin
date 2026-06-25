import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { composeCrmAiWritingPrompt } from './crm-ai-writing-prompt-composer';
import type { CrmAiDraftPromptInput } from '../crm-ai-draft.types';
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
    assert.match(prompt.systemPrompt, /Use the base draft as a fact, CTA, and signoff seed/);
    assert.match(prompt.systemPrompt, /B2B foreign-trade sales email optimization consultant/);
    assert.match(prompt.systemPrompt, /experienced export salesperson/);
    assert.match(prompt.systemPrompt, /Write one clear relevance hypothesis per email/);
    assert.match(prompt.systemPrompt, /Follow this drafting algorithm/);
    assert.match(prompt.systemPrompt, /sendDecision, subject, bodyText/);
    assert.match(
      prompt.systemPrompt,
      /Use product identifiers, series, categories, and application examples only from the provided product facts/
    );
    assert.match(prompt.systemPrompt, /Infer the product category from productLine\.name/);
    assert.match(prompt.systemPrompt, /BBQ tools or retail\/consumer goods/);
    assert.match(prompt.systemPrompt, /standard bearing identifiers/);
    assert.match(prompt.systemPrompt, /Generic list\/overview CTAs/);
    assert.match(prompt.systemPrompt, /Do not use vague wording such as "product line"/);
    assert.match(prompt.systemPrompt, /Do not address customerType as a label/);
    assert.match(prompt.systemPrompt, /supplier comparison, designation checks/);
    assert.match(prompt.systemPrompt, /Avoid weak personalization based only on geography/);
    assert.match(prompt.systemPrompt, /Never make the five-email sequence commit these mistakes/);
    assert.match(prompt.systemPrompt, /A\/B\/C\/D\/E/);
    assert.match(prompt.systemPrompt, /close the automatic sequence politely/);
    assert.match(prompt.systemPrompt, /CTA types must come from/);
    assert.match(prompt.systemPrompt, /silently check: provided facts only/);
    assert.match(prompt.userPrompt, /select only the most relevant details/);
    assert.match(prompt.userPrompt, /Role-action guide/);
    assert.match(prompt.userPrompt, /owner\/executive=backup supply/);
    assert.match(prompt.userPrompt, /Title alias guide/);
    assert.match(prompt.userPrompt, /MRO Buyer or Maintenance Lead means maintenance/);
    assert.match(prompt.userPrompt, /Use contact\.normalizedRole when present/);
    assert.match(prompt.userPrompt, /Product terminology guide/);
    assert.match(prompt.userPrompt, /For step 2, add one concrete decision object/);
    assert.match(prompt.userPrompt, /Do not use a short list\/options\/overview CTA/);
    assert.match(prompt.userPrompt, /For step 4, use role-specific A\/B\/C\/D\/E choices/);
    assert.match(prompt.userPrompt, /For step 5, politely close the automatic sequence/);
    assert.match(prompt.userPrompt, /Low-friction action guide/);
    assert.match(prompt.userPrompt, /do not tell the person "you are a distributor/);
    assert.match(prompt.userPrompt, /system built-in guidance/);
    assert.match(prompt.userPrompt, /"stepPrompt": null/);
    assert.match(prompt.userPrompt, /"sendDecision": "send"/);
    assert.match(prompt.userPrompt, /"ctaType": "string"/);
    assert.match(prompt.userPrompt, /"sequenceNovelty"/);
    assert.match(prompt.userPrompt, /usedAngles/);
    assert.doesNotMatch(prompt.userPrompt, /commonRequirements|forbiddenClaims|productEmphasis/);
  });

  it('includes the current step task and forbids blind generation', () => {
    const prompt = composeCrmAiWritingPrompt({
      input: createPromptInputForSpec({
        stepIndex: 3,
        stepStrategy: {
          taskDescription: '建立信任：质量、认证、试单',
          newValue: '认证和供应商资格资料',
          wordRange: { min: 50, max: 90 },
          requiredFactGroups: ['quality_documents', 'certifications'],
          mustAvoid: ['Do not invent ISO, CE, customer references, or case studies.'],
          ctaInstruction: 'Offer a short qualification summary.'
        }
      }),
      selectedModules: [{ promptKey: 'crm_outreach_sequence_strategy', title: 'Sequence', reason: 'Required' }],
      writingContext: createWritingContextForSpec(),
      riskNotes: []
    });

    assert.match(prompt.userPrompt, /Current step execution rules/);
    assert.match(prompt.userPrompt, /建立信任/);
    assert.match(prompt.userPrompt, /Do not invent ISO/);
    assert.match(prompt.userPrompt, /Offer a short qualification summary/);
    assert.match(prompt.userPrompt, /50-90 English words/);
    assert.match(prompt.systemPrompt, /Do not turn inference into fact/);
  });
});

function createPromptInputForSpec(overrides: Partial<CrmAiDraftPromptInput> = {}): CrmAiDraftPromptInput {
  return {
    stepIndex: 1,
    templateLanguage: 'en',
    senderName: 'Alice',
    baseDraft: { subject: 'Bearing fit', bodyText: 'Hi Alex,\n\nShort note.\n\nAlice' },
    writingConfig: {
      enabled: true,
      steps: [1, 2, 3, 4, 5].map(stepIndex => ({
        stepIndex: stepIndex as 1 | 2 | 3 | 4 | 5,
        prompt: `Step ${stepIndex}`
      }))
    },
    account: {
      name: 'ABC Trading',
      country: 'SA',
      city: 'Riyadh',
      timeZone: 'Asia/Riyadh',
      domain: null,
      customerType: 'Distributor'
    },
    contact: { fullName: 'Alex', title: 'Sourcing Manager', maskedEmail: 'a***@abc.example', emailStatus: 'valid' },
    productLine: {
      id: 'line-1',
      name: 'Bearings',
      targetCustomerType: 'Distributor',
      coreSellingPoints: 'Stable stock',
      moq: '100 pcs',
      leadTime: '15 days',
      paymentTerms: null,
      certifications: 'ISO 9001',
      catalogUrl: null,
      websiteUrl: null,
      commonModelsText: '6204, 6205'
    },
    previousMessages: [],
    ...overrides
  };
}

function createWritingContextForSpec(): CrmAiWritingContext {
  return {
    publicFacts: [{ id: 'account.name', label: 'Account name', value: 'ABC Trading', source: 'account' }],
    previousMessages: [],
    reviewNotes: [],
    baseDraftFact: null
  };
}
