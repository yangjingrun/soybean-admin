import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { RequestUserContext } from '../../shared/request-context';
import { CrmAiDraftService } from './crm-ai-draft.service';
import type { CrmAiDraftPromptInput } from './crm-ai-draft.types';
import type { CrmProductLineAiWritingConfig } from './crm.types';

describe('CrmAiDraftService', () => {
  it('generates AI draft and returns metadata snapshot', async () => {
    const calls: Array<{ input: unknown; context: unknown }> = [];
    const service = new CrmAiDraftService({
      async generateText(input: unknown, context: unknown) {
        calls.push({ input, context });

        return {
          text: JSON.stringify({
            subject: 'Bearing supply option',
            bodyText: 'Hi Alex, ...',
            reason: 'Focused on sourcing angle.',
            riskNotes: ['产品交期未配置']
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
    assert.ok(firstCall);
    assert.equal((firstCall.input as { modelConfigKey?: string }).modelConfigKey, 'default');
    assert.equal((firstCall.context as { user?: RequestUserContext }).user?.userId, 'u-owner');
    assert.match((firstCall.input as { prompt?: string }).prompt || '', /Base draft to customize/);
    assert.match((firstCall.input as { prompt?: string }).prompt || '', /Matched persona/);
  });

  it('rejects invalid AI JSON output', async () => {
    const service = new CrmAiDraftService({
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

function createPromptInput(): CrmAiDraftPromptInput {
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
    writingConfig: createWritingConfig(),
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
    commonRequirements: 'Natural English.',
    forbiddenClaims: 'No fake claims.',
    productEmphasis: 'Stock models.',
    steps: [1, 2, 3, 4, 5].map(stepIndex => ({
      stepIndex: stepIndex as 1 | 2 | 3 | 4 | 5,
      prompt: `Step ${stepIndex} prompt`
    }))
  };
}
