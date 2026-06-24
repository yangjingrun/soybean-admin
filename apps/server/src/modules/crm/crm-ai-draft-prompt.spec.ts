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
    const config = normalizeCrmProductLineAiWritingConfig(
      createWritingConfig({ commonRequirements: '  Natural tone  ' })
    );

    assert.equal(config?.commonRequirements, 'Natural tone');
    assert.equal(config?.steps.length, 5);
    assert.equal(config?.steps[1].prompt, 'Step 2 prompt');
  });

  it('normalizes optional product-line AI writing style fields without requiring old configs to have them', () => {
    const legacy = normalizeCrmProductLineAiWritingConfig(createWritingConfig());
    const styled = normalizeCrmProductLineAiWritingConfig(
      createWritingConfig({
        sequenceStrategy: 'core_3_step',
        languagePolicy: 'english',
        tone: 'direct',
        ctaPreference: 'quote',
        polishPolicy: 'always',
        proofAssets: '  ISO certificate and GCC distributor export history  ',
        regionNotes: '  Saudi buyers often ask about stock availability.  '
      })
    );

    assert.equal(legacy?.sequenceStrategy, undefined);
    assert.equal(styled?.sequenceStrategy, 'core_3_step');
    assert.equal(styled?.proofAssets, 'ISO certificate and GCC distributor export history');
    assert.equal(styled?.regionNotes, 'Saudi buyers often ask about stock availability.');
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
      senderName: 'Alice',
      baseDraft: {
        subject: 'Re: Bearing Series for ABC Trading',
        bodyText: 'Hi Alex,\n\nFollowing up on the last note.\n\nBest regards,\nAlice'
      }
    });

    assert.match(prompt.userPrompt, /Previous messages/);
    assert.match(prompt.userPrompt, /Step 2/);
    assert.match(prompt.userPrompt, /Do not repeat/);
    assert.match(prompt.userPrompt, /First email body/);
  });

  it('builds first-draft prompt from the template draft and matched persona context', () => {
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
      stepIndex: 1,
      previousMessages: [],
      senderName: 'Alice',
      templateLanguage: 'en',
      baseDraft: {
        subject: 'Bearing Series for ABC Trading',
        bodyText:
          'Hi Alex,\n\nI noticed ABC Trading and thought this might be relevant to your team.\n\nBest regards,\nAlice'
      },
      persona: {
        label: 'Purchasing Manager',
        focusText: '价格、MOQ、交期、付款方式',
        draftFocusText: 'price, MOQ, lead time, and payment terms',
        painPoints: 'Need stable suppliers',
        avoidText: 'Do not use generic catalog dump'
      }
    });

    assert.match(prompt.systemPrompt, /customize an existing B2B outbound email draft/i);
    assert.match(prompt.systemPrompt, /same output language as the base draft/i);
    assert.match(prompt.userPrompt, /Base draft to customize/);
    assert.match(prompt.userPrompt, /Bearing Series for ABC Trading/);
    assert.match(prompt.userPrompt, /Matched persona/);
    assert.match(prompt.userPrompt, /Purchasing Manager/);
    assert.match(prompt.userPrompt, /Need stable suppliers/);
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
      senderName: 'Alice',
      baseDraft: {
        subject: 'Bearing Series for ABC Trading',
        bodyText: 'Hi there,\n\nSharing one short intro.\n\nBest regards,\nAlice'
      }
    });

    assert.deepEqual(notes, ['联系人职位缺失', '产品核心卖点缺失', '产品交期未配置']);
  });

  it('parses strict AI JSON draft output', () => {
    const output = parseCrmAiDraftOutput(
      JSON.stringify({
        subject: 'Bearing supply option',
        bodyText: 'Hi Alex, ...',
        reason: 'Focused on sourcing.',
        riskNotes: ['产品交期未配置'],
        usedAngles: ['sourcing reliability'],
        usedFacts: ['account.name'],
        nextReviewHints: ['确认联系人职位'],
        qualityFlags: ['主题可再缩短'],
        polishChanges: ['删除模板开头']
      })
    );

    assert.equal(output.subject, 'Bearing supply option');
    assert.equal(output.riskNotes[0], '产品交期未配置');
    assert.deepEqual(output.usedAngles, ['sourcing reliability']);
    assert.deepEqual(output.usedFacts, ['account.name']);
    assert.deepEqual(output.nextReviewHints, ['确认联系人职位']);
    assert.deepEqual(output.qualityFlags, ['主题可再缩短']);
    assert.deepEqual(output.polishChanges, ['删除模板开头']);
  });

  it('rejects markdown wrapped or incomplete AI JSON output', () => {
    assert.throws(() => parseCrmAiDraftOutput('```json\n{"subject":"x"}\n```'), /JSON/);
    assert.throws(() => parseCrmAiDraftOutput('{"subject":"x"}'), /正文/);
  });
});

function createWritingConfig(overrides: Partial<CrmProductLineAiWritingConfig> = {}): CrmProductLineAiWritingConfig {
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
