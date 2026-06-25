import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { CrmSequenceReviewRecord } from '../crm.types';
import { getAiDraftTaskItemSkipMessage } from './crm-ai-draft-task.rules';

describe('crm-ai-draft-task.rules', () => {
  it('allows enabled AI writing config to leave step prompts empty for built-in defaults', () => {
    const item = createReviewItemWithEmptyPrompts();

    assert.equal(getAiDraftTaskItemSkipMessage(item, new Set()), null);
  });
});

function createReviewItemWithEmptyPrompts(): CrmSequenceReviewRecord {
  return {
    enrollment: {
      status: 'sequence_running',
      totalSteps: 4
    },
    account: {
      sourceSnapshot: {}
    },
    contact: {
      emailStatus: 'valid',
      emailHash: 'email-hash-1'
    },
    productLine: {
      status: 'active',
      aiWritingConfig: {
        enabled: true,
        steps: [1, 2, 3, 4, 5].map(stepIndex => ({
          stepIndex,
          prompt: ''
        }))
      }
    },
    mailbox: null,
    firstMessage: null,
    messages: [
      {
        stepIndex: 1,
        status: 'sent'
      }
    ]
  } as unknown as CrmSequenceReviewRecord;
}
