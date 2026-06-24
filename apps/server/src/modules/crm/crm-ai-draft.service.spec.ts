import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { RequestUserContext } from '../../shared/request-context';
import { CrmAiDraftService } from './crm-ai-draft.service';
import type { CrmAiDraftPromptInput } from './crm-ai-draft.types';
import type { CrmProductLineAiWritingConfig } from './crm.types';

describe('CrmAiDraftService', () => {
  it('generates AI draft and returns metadata snapshot', async () => {
    const calls: Array<{ input: unknown; context: unknown }> = [];
    const promptKeys: string[] = [];
    const service = new CrmAiDraftService({
      async getPrompt(promptKey: string) {
        promptKeys.push(promptKey);
        return {
          promptKey,
          title: `Prompt ${promptKey}`,
          systemPrompt: `System prompt for ${promptKey}`,
          updatedAt: '2026-06-24T00:00:00.000Z'
        };
      },
      async generateText(input: unknown, context: unknown) {
        calls.push({ input, context });

        return {
          text: JSON.stringify({
            subject: 'Bearing supply option',
            bodyText: 'Hi Alex, ...',
            reason: 'Focused on sourcing angle.',
            riskNotes: ['产品交期未配置'],
            usedAngles: ['sourcing reliability'],
            usedFacts: ['account.name'],
            nextReviewHints: ['确认职位'],
            qualityFlags: [],
            polishChanges: []
          }),
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 }
        };
      }
    } as never);

    const result = await service.generateDraft(createPromptInput(), createContext());
    const firstCall = calls[0];

    assert.equal(result.subject, 'Bearing supply option');
    assert.equal(result.metadata.reason, 'Focused on sourcing angle.');
    assert.equal(result.metadata.snapshot.productLineId, 'line-1');
    assert.equal(result.metadata.snapshot.stepIndex, 1);
    assert.equal(result.metadata.snapshot.writingConfig.steps.length, 5);
    assert.deepEqual(result.metadata.snapshot.usedFacts, ['account.name']);
    assert.deepEqual(result.metadata.snapshot.usedAngles, ['sourcing reliability']);
    assert.deepEqual(result.metadata.snapshot.nextReviewHints, ['确认职位']);
    assert.equal(
      (result.metadata.snapshot.selectedModules as Array<{ promptKey: string }> | undefined)?.some(
        item => item.promptKey === 'crm_outreach_base_rules'
      ),
      true
    );
    assert.equal(
      (result.metadata.snapshot.publicFacts as Array<{ id: string }> | undefined)?.some(
        item => item.id === 'account.name'
      ),
      true
    );
    assert.ok(firstCall);
    assert.equal(promptKeys.includes('crm_outreach_base_rules'), true);
    assert.equal((firstCall.input as { modelConfigKey?: string }).modelConfigKey, 'default');
    assert.equal((firstCall.input as { maxOutputTokens?: number }).maxOutputTokens, 1600);
    assert.equal((firstCall.context as { user?: RequestUserContext }).user?.userId, 'u-owner');
    assert.match(
      (firstCall.input as { systemPrompt?: string }).systemPrompt || '',
      /System prompt for crm_outreach_base_rules/
    );
    assert.match((firstCall.input as { prompt?: string }).prompt || '', /Base draft to customize/);
    assert.match((firstCall.input as { prompt?: string }).prompt || '', /Matched persona/);
    assert.equal(calls.length, 2);
  });

  it('loads the dedicated polish prompt modules by default', async () => {
    const calls: Array<{ input: unknown; context: unknown }> = [];
    const promptKeys: string[] = [];
    const service = new CrmAiDraftService({
      async getPrompt(promptKey: string) {
        promptKeys.push(promptKey);
        return {
          promptKey,
          title: `Prompt ${promptKey}`,
          systemPrompt: `System prompt for ${promptKey}`,
          updatedAt: '2026-06-24T00:00:00.000Z'
        };
      },
      async generateText(input: unknown, context: unknown) {
        calls.push({ input, context });

        const isPolishCall = calls.length === 2;

        return {
          text: JSON.stringify({
            subject: isPolishCall ? 'Bearing stock fit?' : 'Bearing supply option',
            bodyText: isPolishCall ? 'Hi Alex, does stable 6204 stock matter for Q3?' : 'Hi Alex, ...',
            reason: 'Focused on sourcing angle.',
            riskNotes: [],
            usedAngles: ['sourcing reliability'],
            usedFacts: ['account.name'],
            nextReviewHints: ['确认职位'],
            qualityFlags: [],
            polishChanges: isPolishCall ? ['Removed generic intro.'] : []
          }),
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 }
        };
      }
    } as never);

    const result = await service.generateDraft(createPromptInput(), createContext());
    const polishCall = calls[1];

    assert.equal(result.subject, 'Bearing stock fit?');
    assert.deepEqual(result.metadata.snapshot.polishChanges, ['Removed generic intro.']);
    assert.equal(promptKeys.includes('crm_outreach_ai_polish'), true);
    assert.equal(promptKeys.includes('crm_outreach_public_source_grounding'), true);
    assert.equal(promptKeys.includes('crm_outreach_deliverability_guard'), true);
    assert.equal(promptKeys.includes('crm_outreach_output_contract'), true);
    assert.match(
      (polishCall.input as { systemPrompt?: string }).systemPrompt || '',
      /System prompt for crm_outreach_ai_polish/
    );
  });

  it('skips one-pass polish only when explicitly disabled', async () => {
    const calls: Array<{ input: unknown; context: unknown }> = [];
    const service = new CrmAiDraftService({
      async getPrompt(promptKey: string) {
        return {
          promptKey,
          title: `Prompt ${promptKey}`,
          systemPrompt: `System prompt for ${promptKey}`,
          updatedAt: '2026-06-24T00:00:00.000Z'
        };
      },
      async generateText(input: unknown, context: unknown) {
        calls.push({ input, context });

        return {
          text: JSON.stringify({
            subject: 'Bearing supply option',
            bodyText: 'Hi Alex, ...',
            reason: 'Focused on sourcing angle.',
            riskNotes: [],
            usedAngles: ['sourcing reliability'],
            usedFacts: ['account.name'],
            nextReviewHints: ['确认职位'],
            qualityFlags: [],
            polishChanges: []
          }),
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 }
        };
      }
    } as never);

    const result = await service.generateDraft(
      createPromptInput({
        ...createWritingConfig(),
        polishPolicy: 'off'
      }),
      createContext()
    );

    assert.equal(result.subject, 'Bearing supply option');
    assert.equal(calls.length, 1);
  });

  it('rejects invalid AI JSON output', async () => {
    const service = new CrmAiDraftService({
      async getPrompt(promptKey: string) {
        return {
          promptKey,
          title: promptKey,
          systemPrompt: 'prompt',
          updatedAt: '2026-06-24T00:00:00.000Z'
        };
      },
      async generateText() {
        return {
          text: 'not json',
          finishReason: 'stop',
          usage: { inputTokens: null, outputTokens: null, totalTokens: null }
        };
      }
    } as never);

    await assert.rejects(
      () =>
        service.generateDraft(
          {
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
          },
          createContext()
        ),
      /AI 返回内容不是合法 JSON/
    );
  });
});

function createPromptInput(
  writingConfig: CrmProductLineAiWritingConfig = createWritingConfig()
): CrmAiDraftPromptInput {
  return {
    account: { name: 'ABC Trading', country: 'AE', domain: 'abc.example', customerType: 'distributor' },
    contact: { fullName: 'Alex', title: 'Buyer', maskedEmail: 'a***@abc.example', emailStatus: 'valid' },
    productLine: {
      id: 'line-1',
      name: 'Bearing Series',
      targetCustomerType: 'distributor',
      coreSellingPoints: 'Stable stock',
      moq: '100 pcs',
      leadTime: null,
      paymentTerms: null,
      certifications: null,
      catalogUrl: null,
      websiteUrl: null,
      commonModelsText: '6204'
    },
    writingConfig,
    stepIndex: 1 as const,
    previousMessages: [],
    senderName: 'Alice',
    templateLanguage: 'en',
    baseDraft: {
      subject: 'Bearing Series for ABC Trading',
      bodyText: 'Hi Alex,\n\nSharing one tailored intro.\n\nBest regards,\nAlice'
    },
    persona: {
      label: 'Purchasing Manager',
      focusText: '价格、MOQ、交期、付款方式',
      draftFocusText: 'price, MOQ, lead time, and payment terms',
      painPoints: 'Need stable suppliers',
      avoidText: 'Do not use generic catalog dump'
    }
  };
}

function createContext(): RequestUserContext {
  return {
    userId: 'u-owner',
    userName: 'Alice',
    roles: ['R_ADMIN'],
    buttons: [],
    organizationId: 'org-1',
    organizationRole: 'member'
  };
}

function createWritingConfig(): CrmProductLineAiWritingConfig {
  return {
    enabled: true,
    steps: [1, 2, 3, 4, 5].map(stepIndex => ({
      stepIndex: stepIndex as 1 | 2 | 3 | 4 | 5,
      prompt: `Step ${stepIndex} prompt`
    }))
  };
}
