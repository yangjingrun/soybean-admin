import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { RequestUserContext } from '../../shared/request-context';
import { CrmAiReplyDraftService } from './crm-ai-reply-draft.service';
import type { CrmAiReplyDraftPromptInput } from './crm-ai-reply-draft.types';

describe('CrmAiReplyDraftService', () => {
  it('passes request user context to AI gateway when polishing reply draft', async () => {
    const calls: Array<{ input: unknown; context: unknown }> = [];
    const service = new CrmAiReplyDraftService({
      async generateText(input: unknown, context: unknown) {
        calls.push({ input, context });

        return {
          text: JSON.stringify({
            bodyText: 'Hi Alex, thanks for your update.',
            reason: 'Expanded user outline into a concise reply.',
            riskNotes: ['未选择产品线，请人工确认产品信息']
          }),
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 }
        };
      }
    } as never);

    const result = await service.polishReplyDraft(createPromptInput(), createContext());

    assert.equal(result.bodyText, 'Hi Alex, thanks for your update.');
    assert.equal((calls[0]?.input as { modelConfigKey?: string }).modelConfigKey, 'default');
    assert.equal((calls[0]?.context as { user?: RequestUserContext }).user?.userId, 'u-owner');
  });
});

function createPromptInput(): CrmAiReplyDraftPromptInput {
  return {
    account: { name: 'ABC Trading', country: 'AE', domain: 'abc.example', customerType: 'distributor' },
    contact: { fullName: 'Alex', title: 'Buyer', maskedEmail: 'a***@abc.example' },
    thread: { subject: 'Bearing inquiry', status: 'open' },
    latestInboundMessage: {
      subject: 'Re: Bearing inquiry',
      bodyText: 'Please send the catalog.',
      receivedAt: '2026-06-21T00:00:00.000Z'
    },
    history: [],
    productLine: null,
    userTopicOrOutline: 'Thank customer and say we will send catalog.',
    senderName: 'Alice'
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
