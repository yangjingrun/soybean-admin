import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { CrmSequenceReviewRecord } from '../crm.types';
import { getNextDraftSkipMessage } from './crm-next-draft-rules';

describe('crm-next-draft-rules', () => {
  it('allows polite-close step five without a new signal', () => {
    const item = createReviewItem({
      sourceSnapshot: null
    });

    assert.equal(getNextDraftSkipMessage(item), null);
  });
});

function createReviewItem(input: { sourceSnapshot: Record<string, unknown> | null }): CrmSequenceReviewRecord {
  return {
    enrollment: {
      id: 'enrollment-1',
      status: 'sequence_running',
      totalSteps: 5
    },
    account: {
      sourceSnapshot: input.sourceSnapshot
    },
    messages: [
      {
        id: 'message-4',
        stepIndex: 4,
        status: 'sent'
      }
    ]
  } as unknown as CrmSequenceReviewRecord;
}
