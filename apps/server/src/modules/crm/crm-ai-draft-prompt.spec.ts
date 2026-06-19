import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildCrmAiDraftPrompt,
  collectCrmAiDraftRiskNotes,
  normalizeCrmProductLineAiWritingConfig,
  parseCrmAiDraftOutput,
  requireEnabledCrmProductLineAiWritingConfig
} from './crm-ai-draft-prompt';
import type { CrmProductLineAiWritingConfig } from './crm.types';

describe('crm-ai-draft-prompt', () => {
  it('normalizes complete five-step AI writing config', () => {
    const config = normalizeCrmProductLineAiWritingConfig(createWritingConfig({ commonRequirements: '  Natural tone  ' }));

    assert.equal(config?.commonRequirements, 'Natural tone');
    assert.equal(config?.steps.length, 5);
    assert.equal(config?.steps[1].prompt, 'Step 2 prompt');
  });

  it('rejects enabled AI writing config with missing step prompt', () => {
    const config = createWritingConfig({
      steps: [
        { stepIndex: 1, prompt: 'Step 1 prompt' },
        { stepIndex: 2, prompt: '' },
        { stepIndex: 3, prompt: 'Step 3 prompt' },
        { stepIndex: 4, prompt: 'Step 4 prompt' },
        { stepIndex: 5, prompt: 'Step 5 prompt' }
      ]
    });

    assert.throws(() => requireEnabledCrmProductLineAiWritingConfig(config), /第 2 封/);
  });

  it('builds follow-up prompt with previous message summaries', () => {
    const prompt = buildCrmAiDraftPrompt({
      account: { name: 'ABC Trading', country: 'AE', domain: 'abc.example', customerType: 'distributor' },
      contact: { fullName: 'Alex', title: 'Buyer', maskedEmail: 'a***@abc.example', emailStatus: 'valid' },
      productLine: {
        id: 'line-1',
        name: 'Bearing Series',
        targetCustomerType: 'distributor',
        coreSellingPoints: 'Stable stock',
        moq: '100 pcs',
        leadTime: '15 days',
        paymentTerms: 'T/T',
        certifications: 'ISO 9001',
        catalogUrl: null,
        websiteUrl: null,
        commonModelsText: '6204, 6205'
      },
      writingConfig: createWritingConfig(),
      stepIndex: 2,
      previousMessages: [{ stepIndex: 1, subject: 'Bearing Series', bodyText: 'First email body.' }],
      senderName: 'Alice'
    });

    assert.match(prompt.userPrompt, /Previous messages/);
    assert.match(prompt.userPrompt, /Step 2/);
    assert.match(prompt.userPrompt, /Do not repeat/);
    assert.match(prompt.userPrompt, /First email body/);
  });

  it('collects risk notes for missing contact title and product lead time', () => {
    const notes = collectCrmAiDraftRiskNotes({
      account: { name: 'ABC Trading', country: null, domain: null, customerType: null },
      contact: { fullName: null, title: null, maskedEmail: 'a***@abc.example', emailStatus: 'valid' },
      productLine: {
        id: 'line-1',
        name: 'Bearing Series',
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
      writingConfig: createWritingConfig(),
      stepIndex: 1,
      previousMessages: [],
      senderName: 'Alice'
    });

    assert.deepEqual(notes, ['联系人职位缺失', '产品核心卖点缺失', '产品交期未配置']);
  });

  it('parses strict AI JSON draft output', () => {
    const output = parseCrmAiDraftOutput(
      JSON.stringify({
        subject: 'Bearing supply option',
        bodyText: 'Hi Alex, ...',
        reason: 'Focused on sourcing.',
        riskNotes: ['产品交期未配置']
      })
    );

    assert.equal(output.subject, 'Bearing supply option');
    assert.equal(output.riskNotes[0], '产品交期未配置');
  });

  it('rejects markdown wrapped or incomplete AI JSON output', () => {
    assert.throws(() => parseCrmAiDraftOutput('```json\n{"subject":"x"}\n```'), /JSON/);
    assert.throws(() => parseCrmAiDraftOutput('{"subject":"x"}'), /正文/);
  });
});

function createWritingConfig(
  overrides: Partial<CrmProductLineAiWritingConfig> = {}
): CrmProductLineAiWritingConfig {
  return {
    enabled: true,
    commonRequirements: 'Natural English, under 120 words.',
    forbiddenClaims: 'Do not invent price, MOQ, certificates, or lead time.',
    productEmphasis: 'Prioritize stock models and fast quotation.',
    steps: [1, 2, 3, 4, 5].map(stepIndex => ({
      stepIndex: stepIndex as 1 | 2 | 3 | 4 | 5,
      prompt: `Step ${stepIndex} prompt`
    })),
    ...overrides
  };
}
