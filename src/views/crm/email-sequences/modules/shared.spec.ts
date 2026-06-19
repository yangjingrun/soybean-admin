import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildDraftReviewOperationPayload,
  getNextScheduledReviewMessage,
  getPendingReviewMessage,
  getSequenceProgressText
} from './shared';

function createMessage(overrides: Partial<Api.Crm.MessageRecord>): Api.Crm.MessageRecord {
  return {
    id: overrides.id ?? 'message-1',
    organizationId: 'org-1',
    ownerUserId: 'user-1',
    accountId: 'account-1',
    contactId: 'contact-1',
    enrollmentId: 'enrollment-1',
    mailboxId: 'mailbox-1',
    stepIndex: overrides.stepIndex ?? 1,
    threadMode: overrides.threadMode ?? 'new_subject',
    subject: overrides.subject ?? 'Subject',
    bodyText: overrides.bodyText ?? 'Body',
    status: overrides.status ?? 'draft_pending_review',
    scheduledAt: overrides.scheduledAt ?? null,
    sentAt: overrides.sentAt ?? null,
    bullJobId: overrides.bullJobId ?? null,
    providerMessageId: overrides.providerMessageId ?? null,
    providerThreadId: overrides.providerThreadId ?? null,
    createdAt: overrides.createdAt ?? '2026-06-19T01:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-06-19T01:00:00.000Z'
  };
}

describe('email sequence review shared helpers', () => {
  it('builds draft operation payload with the selected message id', () => {
    const payload = buildDraftReviewOperationPayload('message-2', {
      subject: ' Follow up ',
      bodyText: ' Hi '
    });

    assert.deepEqual(payload, {
      messageId: 'message-2',
      draft: {
        subject: 'Follow up',
        bodyText: 'Hi'
      }
    });
  });

  it('selects the current pending review message instead of always using the first message', () => {
    const messages = [
      createMessage({ id: 'message-1', stepIndex: 1, status: 'sent' }),
      createMessage({ id: 'message-2', stepIndex: 2, status: 'draft_pending_review' })
    ];

    assert.equal(getPendingReviewMessage(messages)?.id, 'message-2');
    assert.equal(getSequenceProgressText({ currentStep: 2, totalSteps: 5 }), '第 2 / 5 封');
  });

  it('selects the nearest scheduled pending or queued message', () => {
    const messages = [
      createMessage({
        id: 'message-1',
        stepIndex: 1,
        status: 'sent',
        scheduledAt: '2026-06-19T06:00:00.000Z'
      }),
      createMessage({
        id: 'message-2',
        stepIndex: 2,
        status: 'queued',
        scheduledAt: '2026-06-20T06:00:00.000Z'
      }),
      createMessage({
        id: 'message-3',
        stepIndex: 3,
        status: 'draft_pending_review',
        scheduledAt: '2026-06-19T08:00:00.000Z'
      })
    ];

    assert.equal(getNextScheduledReviewMessage(messages)?.id, 'message-3');
  });
});
